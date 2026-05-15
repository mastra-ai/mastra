---
'mastracode': patch
---

Fixed Shift+Enter not inserting newlines in the TUI editor. The main editor was intercepting all Enter variants (including Shift+Enter) as a submit action, preventing the base editor from handling newline insertion. Shift+Enter and bare \\n input are now routed to the base editor before the submit check.
