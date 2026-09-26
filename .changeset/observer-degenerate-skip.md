---
'@mastra/memory': patch
---

Fixed Observational Memory flagging faithful summaries of long or repetitive tool output as degenerate. Giant single lines are now truncated instead of rejected, and short repeated tool-result lines (e.g. many successful `pnpm build → ok` calls) no longer trip the repetition check. Genuinely degenerate Observer or Reflector output now follows `failurePolicy`: with `'continue'` the cycle is skipped, the input stays pending, and `onObservationEnd` receives the error; with the default `'abort'` the turn fails as before. Fixes #24354.
