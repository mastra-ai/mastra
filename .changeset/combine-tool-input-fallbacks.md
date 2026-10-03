---
'@mastra/core': patch
---

Fixed tool input validation rejecting arguments that need more than one automatic correction. Stringified JSON values, `null` sent for optional fields, and prompt aliases (`query`, `message`, `input`) are now corrected together, so a call like `{ args: '["a.py"]', note: null }` validates instead of failing.
