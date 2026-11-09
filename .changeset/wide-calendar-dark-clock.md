---
'@mastra/playground-ui': patch
---

`DatePicker` now fills the width of its container. Previously it kept its content width and left an empty strip inside a wider popover. Popovers that size to their content look the same as before.

`Input` now uses a dark color-scheme in dark mode, so native glyphs such as the clock icon on `type="time"` are visible and no longer black on the dark surface.
