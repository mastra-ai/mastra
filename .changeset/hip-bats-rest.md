---
'@mastra/playground-ui': patch
---

Added `toggle()` to `CollapsiblePanelHandle` so callers can flip a resizable panel between collapsed and expanded without tracking its state. `CollapsiblePanel` accepts an optional `expandShortcut` to show a key hint in the expand button tooltip, and the sidebar toggle button tooltip now shows its `[` keyboard shortcut.
