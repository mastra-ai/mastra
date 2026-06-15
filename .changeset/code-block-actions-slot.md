---
'@mastra/playground-ui': minor
---

Added an `actions` prop to `CodeBlock` for consumer controls that belong with the code surface — e.g. a mode toggle next to the language tabs. The slot renders at the inline end of the header row in all three header modes (tabs, select, file name), and gets its own header row when no other header is present. Also fixed the `SearchWithDropdown` ButtonsGroup story: the `SelectTrigger` now passes `size="lg"` (h-form-default) so it matches the `InputGroup size="default"` segment height after the Button size rework.
