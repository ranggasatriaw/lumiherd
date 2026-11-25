"""Frames of a white-background video -> one transparent looping WebP.

Each frame's background is flood-filled from the border (only near-pure white,
so the shaded white hair stays); every frame is cropped to the union of their
boxes, so the character doesn't jump; then resized and saved as an animated WebP.
"""
import glob, sys
from collections import deque
from PIL import Image

src, out, fps, size = sys.argv[1], sys.argv[2], int(sys.argv[3]), int(sys.argv[4])
BG, SOFT = 246, 232  # >= BG: background; between SOFT and BG: edge, partly clear


def clear(im):
    w, h = im.size
    px = im.load()
    seen = bytearray(w * h)
    q = deque([(x, 0) for x in range(w)] + [(x, h - 1) for x in range(w)] + [(0, y) for y in range(h)] + [(w - 1, y) for y in range(h)])
    while q:
        x, y = q.popleft()
        k = y * w + x
        if seen[k]:
            continue
        r, g, b, _ = px[x, y]
        lo = min(r, g, b)
        if lo < SOFT or max(r, g, b) - lo > 18:
            continue
        seen[k] = 1
        a = 0 if lo >= BG else int(255 * (BG - lo) / (BG - SOFT))
        px[x, y] = (r, g, b, a)
        if lo < BG:  # an edge pixel: don't spread past it
            continue
        for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
            if 0 <= nx < w and 0 <= ny < h and not seen[ny * w + nx]:
                q.append((nx, ny))
    return im


ISLANDS = len(sys.argv) > 5 and sys.argv[5] == "--one-piece"


def one_piece(im):
    # Keep only the largest opaque piece: specks the fill couldn't reach go.
    w, h = im.size
    px = im.load()
    label = [0] * (w * h)
    sizes = {}
    n = 0
    for y in range(h):
        for x in range(w):
            if px[x, y][3] < 40 or label[y * w + x]:
                continue
            n += 1
            q = deque([(x, y)]); label[y * w + x] = n; c = 0
            while q:
                cx_, cy = q.popleft(); c += 1
                for nx, ny in ((cx_ + 1, cy), (cx_ - 1, cy), (cx_, cy + 1), (cx_, cy - 1)):
                    if 0 <= nx < w and 0 <= ny < h and not label[ny * w + nx] and px[nx, ny][3] >= 40:
                        label[ny * w + nx] = n; q.append((nx, ny))
            sizes[n] = c
    keep = max(sizes, key=sizes.get)
    for y in range(h):
        for x in range(w):
            if label[y * w + x] not in (0, keep) or (label[y * w + x] == 0 and px[x, y][3] < 40 and px[x, y][3] > 0):
                r, g, b, _ = px[x, y]; px[x, y] = (r, g, b, 0)
    return im


frames = [clear(Image.open(f).convert("RGBA")) for f in sorted(glob.glob(f"{src}/*.png"))]
if ISLANDS:
    frames = [one_piece(f) for f in frames]
boxes = [f.getbbox() for f in frames]
box = (min(b[0] for b in boxes), min(b[1] for b in boxes), max(b[2] for b in boxes), max(b[3] for b in boxes))
side = max(box[2] - box[0], box[3] - box[1])
done = []
for f in frames:
    c = f.crop(box)
    canvas = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    canvas.paste(c, ((side - c.width) // 2, side - c.height), c)
    done.append(canvas.resize((size, size), Image.LANCZOS))
done[0].save(out, save_all=True, append_images=done[1:], duration=round(1000 / fps), loop=0, quality=88, method=6)
# A strip of every 6th frame on a dark background, to check the cut.
step = done[::6]
strip = Image.new("RGBA", (size * len(step), size), (40, 44, 52, 255))
for i, f in enumerate(step):
    strip.paste(f, (i * size, 0), f)
strip.save(out.replace(".webp", "-check.png"))
print(len(done), "frames", box)
