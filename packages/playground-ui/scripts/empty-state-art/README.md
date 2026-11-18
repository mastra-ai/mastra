# EmptyStateArt drawings

The source of the animated drawings in `EmptyStateArt`: isometric line objects for create, set-up, and upgrade states, each with a hover loop and its own failure. `src/ds/components/EmptyStateArt/art/` and `empty-state-art.css` are generated from this folder, so never edit them by hand.

| Command            | Does                                                                                                                                                         |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `pnpm art:preview` | Writes the review page to `$TMPDIR/empty-state-art/illustrations.html`: every drawing in every state, with state, layout, and theme toggles.                 |
| `pnpm art:build`   | Regenerates the scene files, `art/scenes.ts`, and `empty-state-art.css`. It leaves `empty-state-art.tsx`, `art-motion.ts`, the stories, and the tests alone. |

Both need Node 24, which runs `build.mts` without a build step.

## Files

| File             | Job                                                                                                             |
| ---------------- | --------------------------------------------------------------------------------------------------------------- |
| `build.mts`      | The projection, drawing primitives, and motion helpers, then one function per drawing.                          |
| `page.html`      | The review page template: sample cards, the drawing library (`LIB`), and the hover runtime.                     |
| `runtime.css`    | Hover, state, and reduced-motion rules for the component, keyed to `[data-slot=empty-state-art]`.               |
| `restbox.json`   | Each drawing's resting bounds, so the component frames the rest pose and not the motion.                        |
| `logos.json`     | Marks drawn onto objects, such as the provider cartridges.                                                      |
| `tools/scrub.sh` | Pauses one drawing at given points of its loop and screenshots each frame. Uses `agent-browser`, or `$BROWSER`. |
| `tools/grid.py`  | Lays those frames out as one review image.                                                                      |

## Geometry

- One camera for every drawing: `x' = (y - x) * 0.884`, `y' = (x + y) * 0.442 - z * 1.25`, mirrored so openings face lower left. Never change the angle or `SCALE` for one drawing; resize the object instead. The component scales every drawing to the same visual area.
- Build from `box`, `cyl`, `quad`, and `lines`, back to front, with one plinth under each object.
- Color only through `--line`, `--face`, `--detail`, and `--hole`. Wrap the part the action creates in `acc`; it alone takes the feature's hue on hover. A mark on an `acc` part passes `var(--line)` as its fill so it follows the hue.

## Motion

- Nothing moves at rest. Hover, or the `working` state, starts the loop, and leaving eases every part back to rest.
- Anything that moves comes from somewhere and goes somewhere. No popping in and no fading in place: a part resets out of view or fades in while already moving.
- Parts that open for the action open once and hold while hovered.

## Failure

Every drawing fails in its own physical way, under `d.fail(…)`, with the failed part red:

- No shaking, rattling, or blinking stand-ins. The object tries its job and breaks the way it would: a drawer jams, a thread snaps, a plug is thrown out.
- The broken part stays put. Anything that falls lands with `land`, then fades out.
- `burst`, `puff`, and `ink` mark the moment of failure and nothing else.

Upgrade states use the feature's own drawing; the upgrade button does the selling.

## Adding a drawing

1. Write `function <name>() { const d = new D(); … return d.svg(300, 230, '<name>'); }` in `build.mts`, starting from the closest existing drawing. Working-only parts go in `d.ok(…)`, the failure in `d.fail(…)`.
2. Add it to the `art` map and its hue to `HUES` at the bottom of `build.mts`, and add a `LIB` row in `page.html`.
3. Run `pnpm art:preview`, open the page, and check it at rest, on hover, and failed, in both themes. For a frame-by-frame check, run `tools/scrub.sh <name> empty a-<name>-e 0 10 22 34 46 58 70 85`, the same with `failed` and `a-<name>-f`, then `python3 tools/grid.py <name>`.
4. Add its resting bounds to `restbox.json`, measured on the review page, then run `pnpm art:build` and the `EmptyStateArt` tests.

Eight frames can miss a pop that lasts a fraction of a second, so watch the loop at full speed before calling it done.
