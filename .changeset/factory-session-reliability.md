---
'@mastra/factory': patch
---

Make factory review sessions survive server restarts, dropped connections, and strict git configs.

- Crash-resumed sessions recover their run binding and untrusted-checkout posture from the binding table instead of silently losing the transition tool.
- Overly long transition rationales are clamped instead of failing the run.
- Clones and pulls retry when the transfer to github.com drops partway through.
- Checkouts with `pull.rebase` set no longer fail workspace materialization.
