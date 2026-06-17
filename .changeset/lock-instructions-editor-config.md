---
'@internal/playground': patch
---

Fixed Studio leaving a code-defined agent's instructions editable when the editor config locks them. An agent with `editor: { instructions: false }` still showed an editable system prompt with a Preview/Edit toggle, even though the server drops those edits on save. Studio now locks the instructions block and hides the toggle so it reads like the rest of the locked editor. When a code agent locks both instructions and tools, the editor also shows the Read-only badge and disables Save and Publish, since nothing remains editable.
