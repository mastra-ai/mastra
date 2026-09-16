---
'mastracode': patch
---

Silence `npm warn ERESOLVE overriding peer dependency` warnings on `npm install -g mastracode` and the CLI self-update. The published package now pins the nested `openai` copies' optional `zod` peer to the shipped `zod` v4 via an `overrides` entry, so npm no longer reports overriding the `zod@^3.23.8` peerOptional range. No runtime behavior changes.
