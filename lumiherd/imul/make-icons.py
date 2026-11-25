"""Imul sheet (3 robots in a row on magenta) -> transparent icons: the head as each
agent's icon (imul-<agent>.png), the whole robot, and a preview at 14/18/32 px.
Run: uv run --with pillow python3 make-icons.py sheet.png"""
import sys
from PIL import Image

sheet = Image.open(sys.argv[1]).convert("RGBA")
# The bottom of the sheet can fade from the background: below the robots, cut it off.
sheet = sheet.crop((0, 0, sheet.width, int(sheet.height * 0.86)))
W, H = sheet.size
px = sheet.load()
for y in range(H):
    for x in range(W):
        r, g, b, a = px[x, y]
        # How magenta it is: red and blue high, green low.
        m = min(r, b) - g
        if m > 150:
            px[x, y] = (0, 0, 0, 0)
        elif m > 60:
            k = (m - 60) / 90  # 0..1 toward background
            # Take the magenta out of the edge colour, then fade it.
            g2 = g
            r2 = int(max(0, r - k * (r - g2)))
            b2 = int(max(0, b - k * (b - g2)))
            px[x, y] = (r2, g2, b2, int(255 * (1 - k)))

names = ["claude", "codex", "omp"]


def square(im, size):
    im = im.crop(im.getbbox())
    side = max(im.size)
    c = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    c.paste(im, ((side - im.width) // 2, (side - im.height) // 2), im)
    return c.resize((size, size), Image.LANCZOS)


full, head = {}, {}
for i, n in enumerate(names):
    cell = sheet.crop((i * W // 3, 0, (i + 1) * W // 3, H))
    box = cell.getbbox()
    cell = cell.crop(box)
    full[n] = square(cell, 256)
    # Head: the helmet down to just under the visor (~57% of the robot's height).
    top = cell.crop((0, 0, cell.width, int(cell.height * 0.57)))
    # Only the helmet: the dark pixels' box (the white body behind it left out).
    dark = Image.new("L", top.size, 0)
    tp, dp = top.load(), dark.load()
    for yy in range(top.height):
        for xx in range(top.width):
            r, g, b, a = tp[xx, yy]
            if a > 200 and (max(r, g, b) < 110 or max(r, g, b) - min(r, g, b) > 70):
                dp[xx, yy] = 255
    bx = dark.getbbox()
    m = 6
    helmet = top.crop((max(0, bx[0] - m), 0, min(top.width, bx[2] + m), top.height))
    # Clear what's outside the helmet's outline in that box: keep only pixels in rows'
    # dark span, so the body's edge doesn't peek in at the sides.
    hp = helmet.load()
    for yy in range(helmet.height):
        xs = [xx for xx in range(helmet.width) if hp[xx, yy][3] > 200 and (max(hp[xx, yy][:3]) < 110 or max(hp[xx, yy][:3]) - min(hp[xx, yy][:3]) > 70)]
        if not xs:
            continue
        lo, hi = min(xs) - 3, max(xs) + 3
        for xx in range(helmet.width):
            if xx < lo or xx > hi:
                r, g, b, _ = hp[xx, yy]; hp[xx, yy] = (r, g, b, 0)
    head[n] = square(helmet, 256)
    full[n].save(f"imul-full-{n}.png")
    head[n].save(f"imul-{n}.png")

sizes = [14, 18, 32]
tiles = []
for set_ in (full, head):
    for bg in ((242, 241, 237, 255), (30, 32, 38, 255)):
        t = Image.new("RGBA", (3 * (14 + 18 + 32 + 18) + 30, 44), bg)
        x = 8
        for n in names:
            for s in sizes:
                ic = set_[n].resize((s, s), Image.LANCZOS)
                t.paste(ic, (x, 22 - s // 2), ic)
                x += s + 6
            x += 12
        tiles.append(t)
pv = Image.new("RGBA", (tiles[0].width * 2, 88))
pv.paste(tiles[0], (0, 0)); pv.paste(tiles[1], (tiles[0].width, 0))
pv.paste(tiles[2], (0, 44)); pv.paste(tiles[3], (tiles[0].width, 44))
pv.resize((pv.width * 4, pv.height * 4), Image.NEAREST).save("imul-sizes.png")
print("ok")
