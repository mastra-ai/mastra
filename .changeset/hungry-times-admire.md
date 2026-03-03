---
'mastracode': patch
---

Added Ctrl+V clipboard paste support for both images and text. Images from the clipboard are detected and sent to the AI agent. Text pastes flow through the editor's paste handling, which condenses large pastes (>10 lines) into a compact `[paste #N +X lines]` marker instead of dumping raw content.
