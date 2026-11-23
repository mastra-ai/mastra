---
'@mastra/playground-ui': patch
---

Fixed key symbols in shortcut hints looking smaller than the letters beside them. ⌘, ↵, ⌫, arrows and the other key symbols now match the letters' height in `Kbd`, `CommandShortcut`, `DropdownMenu.Shortcut`, `ContextMenu.Shortcut` and `Sidebar.SearchTrigger`, the same on every operating system. The gap between keys is also the same for any pair of symbols, letters and words, with or without a space (`⌘K`, `⌘ K`, `Ctrl K`), and the space on both sides of a keycap is even. Screen readers announce the keys by name ("Command K"). No changes needed where shortcuts are rendered.
