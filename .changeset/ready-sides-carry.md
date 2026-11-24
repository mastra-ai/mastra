---
'@mastra/playground-ui': patch
---

Fixed key symbols in shortcut hints looking smaller than the letters beside them. ⌘, ↵, ⌫, arrows and the other key symbols now match the letters' height in `Kbd`, `CommandShortcut`, `DropdownMenu.Shortcut`, `ContextMenu.Shortcut` and `Sidebar.SearchTrigger`, the same on every operating system. The gaps between keys are balanced too, and `⌘K` and `⌘ K` look the same. Screen readers announce the keys by name ("Command K"). No changes needed where shortcuts are rendered.
