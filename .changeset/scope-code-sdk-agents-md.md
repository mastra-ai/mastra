---
'@mastra/code-sdk': patch
---

Fixed agents receiving the host app's `AGENTS.md` when working in a different repository (for example, Mastra Factory runs). Instruction-file reminders now resolve relative paths against the session's project path and only load instruction files from inside that checkout.
