---
'@mastra/playground-ui': patch
---

Removed the FilterBar container background and border so filter chips sit directly on the page surface, styled the filter input like other comboboxes (filter icon inside the pill), sized chips to match the input, and added a left-to-right entrance animation where each chip segment grows in turn. The in-progress draft chip is now rendered by `FilterBar.Chips` (new `renderChip` prop for custom chip lists) so it stays the same element when its value is committed instead of flashing out and back in.
