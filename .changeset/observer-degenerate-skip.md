---
'@mastra/memory': patch
---

Fixed Observational Memory flagging faithful summaries of long or repetitive tool output as degenerate. Giant single lines are now truncated instead of rejected, and short repeated tool-result lines (e.g. many successful `pnpm build → ok` calls) no longer trip the repetition check.

Genuinely degenerate output is handled by mode:

- **Synchronous Observer and Reflector** follow `failurePolicy`. With `'continue'` the cycle is skipped, the input stays pending, and `onObservationEnd` / `onReflectionEnd` receive the error. With the default `'abort'` the turn fails as before.
- **Buffered (background) reflection** never fails the turn, regardless of `failurePolicy`. Nothing is committed, a failure marker is recorded when a stream writer is attached, and `onReflectionEnd` receives the error.

Fixes #24354.
