# Timeline: a Files view

## Why
Rangga checks an agent's Tasks first, then which files it changed. The Timeline
shows changed files only inside each prompt's card; there is no list of
everything an agent changed. Claude Desktop's "Outputs" section prompted the idea.

## What
The Timeline panel (lumiherd-prompts) gets two views, picked in its header:
`Prompts N` (today's cards, unchanged) and `Files N`.

Files: every file the agent changed in this conversation, once each, the most
recently changed first. Each row: the file's name, its folder (`~` for home),
and how long ago it was last changed. Clicking a row switches to Prompts with the
card of the prompt that last changed it open and picked.

## Non-goals
- Tasks stays its own panel; nothing about it changes.
- No new data source: the list is built from the `edits` prompts.py already
  returns per prompt (Write/Edit/NotebookEdit). Files made by shell commands
  aren't in it, as they aren't in the cards today.
- No file preview or editor opening (could come later).

## Constraints
- Privacy mode (`lumiherd.private`): the Timeline already hides its whole
  content while it's on; Files sits inside that and is hidden the same way.
- Windows paths (backslashes) split correctly for name and folder.
- The view picked is remembered while the panel lives; a new agent starts on Prompts.

## Approaches
- **A. Two views in the panel header (picked).** Same pattern as Branch/Repo
  in the PRs panel and Space/Status in the sidebar; each view gets the full height.
- B. A foldable Files section above the cards: one scroll, but many files push
  the cards down, and folded it hides the list.
- C. Only make file names in the cards clickable: smallest, but no per-agent list.

## Left to the builder
The header's exact look (match the PRs panel's segmented control), the empty
state text, and keyboard handling (↑/↓/Enter as in Prompts).
