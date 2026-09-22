---
'@mastra/playground-ui': minor
---

Unified every control surface on one fill ladder, so an input, a button, a select or dropdown trigger, a chip and a list panel read as the same material on any background.

**Why**

Controls painted their own alpha (`bg-foreground/10`), while containers picked an opaque step from the `surface1..6` ramp. The two ladders drifted: on the Workflows and Traces list pages the search input sat visibly lighter than the list panel right next to it, and the same control changed apparent weight depending on whether it sat on the sidebar, the canvas or a card.

**What changed**

New role tokens, all alphas of `--foreground` off the existing gray ramp, so a rung means "one step up from whatever is behind me":

- `fill` — rest of a filled control (input, button, select/dropdown trigger, chip) and of a raised container
- `fill-hover` — hover on that rest fill; rest of a selection control (checkbox, switch, radio)
- `fill-active` — press, open, selected
- `fill-subtle` — state layer on a transparent base: ghost hover, list-row hover, disabled fill
- `fill-strong` — selection-control press

`--surface-panel` is the opaque twin of `fill` for cases that cannot be translucent — the level a selected list row rests on, and the sticky cells that scroll over other cells. `DataList` rows step down to `--background` as wells inside the panel and up to `--surface-panel` when featured or selected.

Values are unchanged, so existing controls look the same; the list panel is what moves to meet them.

**Removed**

Dead tokens `--button-default-bg`, `--button-default-hover`, `--button-default-active`, `--button-default-border`, `--surface-header`, `--surface-header-hover` and `--surface-row-featured`, plus the `--color-surface-row-featured` utility. Use `bg-fill`, `bg-surface-panel` and `bg-card` instead.
