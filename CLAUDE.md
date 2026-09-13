# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

A classic Tetris implementation in vanilla JavaScript using HTML5 Canvas. No dependencies, no build step, no package.json — just `index.html`, `style.css`, and `game.js`.

## Running the game

There's no build/lint/test tooling. To run:

```bash
start index.html        # Windows: open directly in browser
# or serve locally (recommended for consistent behavior):
npx serve .
python3 -m http.server 8000
```

There are no automated tests in this repo.

## Architecture

Everything lives in three files that cooperate directly (no modules/bundler):

- **`index.html`** — DOM structure: main `<canvas id="board">` (300×600, i.e. `COLS×BLOCK` by `ROWS×BLOCK`), a side panel with score/lines/level and a `<canvas id="next-canvas">` preview, and a shared `#overlay` div used for both Pause and Game Over states.
- **`style.css`** — dark/retro arcade visual theme.
- **`game.js`** — all game logic, single global scope, no classes. Key parts:
  - **Board model**: `board` is a `ROWS × COLS` array; each cell is `0` (empty) or a piece-color index `1–7`.
  - **Pieces**: `PIECES` are square matrices (I, O, T, S, Z, J, L). Rotation is computed on the fly via `rotateCW` (transpose + reverse), not pre-stored rotation states.
  - **Collision**: `collide(shape, ox, oy)` checks board bounds and overlap with locked cells.
  - **Wall kicks**: `tryRotate()` tries offsets `[0, -1, 1, -2, 2]` columns after rotating, before giving up.
  - **Game loop**: `loop(ts)` runs via `requestAnimationFrame`, accumulates elapsed time in `dropAccum`, and advances the piece when `dropAccum >= dropInterval`.
  - **Line clearing**: `clearLines()` scans bottom-up, splices full rows out and unshifts empty rows in; recomputes `level` (every 10 lines) and `dropInterval` (`max(100, 1000 - (level-1)*90)` ms).
  - **Scoring**: `LINE_SCORES = [0, 100, 300, 500, 800]` × level for clears; hard drop = 2 pts/cell traveled, soft drop = 1 pt/row.
  - **Ghost piece**: `ghostY()` projects the current piece straight down to its landing row; drawn at `globalAlpha = 0.2`.
  - Game state (`board`, `current`, `next`, `score`, `lines`, `level`, `paused`, `gameOver`, etc.) is held in module-level `let` bindings and reset in `init()`.

### Control flow

```
init() → createBoard(), spawn first piece, requestAnimationFrame(loop)te
loop(ts) → advance drop timer → move piece down or lockPiece() → draw() → next frame
lockPiece() → merge() into board → clearLines() → spawn() next piece
spawn() → if new piece immediately collides → endGame()
keydown → move/rotate/soft-drop/hard-drop/pause (ignored while paused or game over, except P)
```

### Tunable constants (top of `game.js`)

`COLS`, `ROWS`, `BLOCK`, `COLORS`, `LINE_SCORES`, `dropInterval` (initial). If `COLS`/`ROWS`/`BLOCK` change, update the `#board` canvas `width`/`height` in `index.html` to match (`COLS×BLOCK` and `ROWS×BLOCK`).
