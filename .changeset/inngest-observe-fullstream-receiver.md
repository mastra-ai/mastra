---
'@mastra/inngest': patch
---

Fixed `observe(runId).fullStream` on agents created with `createInngestAgent`. Reading the stream no longer throws `Cannot read private member #options from an object whose class did not declare it`.
