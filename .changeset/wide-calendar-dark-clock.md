---
'@mastra/playground-ui': patch
---

`DatePicker` now fills the width of its container. Before, it kept its content width and left an empty strip inside a wider popover. Popovers that size to their content look the same. A width class passed through `className` (for example `w-fit`) still replaces the default.

`<Input type="time">` now shows a design-system clock icon in every browser and theme, replacing Chromium's native picker icon and picker. The value is typed or stepped with the arrow keys. `DateTimePicker` and the custom range editor in `DateTimeRangePicker` no longer need to hide the native icon themselves.
