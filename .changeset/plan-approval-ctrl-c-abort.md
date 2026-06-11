---
'mastracode': patch
---

Fixed Ctrl+C / Esc not aborting while a `submit_plan` approval (or `ask_user` question) is on screen. In raw terminal mode the interrupt arrives as `\x03` to the editor, where the inline component was swallowing it and leaving the suspended run parked. Ctrl+C now falls through to the abort handler, which clears the inline prompt and aborts the parked tool suspension.
