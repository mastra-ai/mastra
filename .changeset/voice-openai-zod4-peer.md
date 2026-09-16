---
'@mastra/voice-openai': patch
---

Updated the `openai` dependency to v6. The previous v5 release declared a `zod@^3` peer, which conflicted with the zod v4 that Mastra packages ship and caused `npm warn ERESOLVE overriding peer dependency` in consumers such as `npm install -g mastracode`. The speech and transcription APIs this package uses are unchanged.
