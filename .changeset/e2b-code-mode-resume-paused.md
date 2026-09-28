---
'@mastra/e2b': patch
---

Fixed code mode failing after an E2B sandbox auto-paused on timeout. Code mode now resumes the paused sandbox and runs the program, instead of failing until another command happened to wake the sandbox.
