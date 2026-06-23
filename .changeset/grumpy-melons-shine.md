---
'mastracode': patch
---

Add a slash-command autocomplete menu to the web composer. Typing `/` now shows a filtered list of available commands (with argument hints and descriptions) that narrows as you type, with ↑/↓ to navigate, Tab/Enter to complete, and Esc to dismiss. Enter runs no-arg commands (e.g. `/yolo`) directly. The command list is shared with `/help` so the two never drift apart.
