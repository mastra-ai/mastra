---
'@mastra/factory': patch
---

Fixed Factory runs losing their card binding after 24 hours while waiting on a person. The stale-binding sweep now keeps a binding when its session is still live and either has a pending `ask_user` / `submit_plan` question or is running, so a run answered after a day still has its card tools, rules ingest, and reviewer identity. Bindings with no live session, or whose card is finished, missing, or moved, are still revoked.
