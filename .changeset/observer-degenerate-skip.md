---
'@mastra/memory': patch
---

Fixed Observational Memory flagging faithful summaries of long or repetitive tool output as degenerate. Giant single lines are now truncated instead of rejected in both Observer and Reflector output, and a back-to-back run of one repeated tool-result line (e.g. many successful `pnpm --filter ./packages/memory build → ok` calls) no longer trips the repetition check, whatever the line length, as long as the run fits in one maximum-size observation line (10,000 chars).

Genuinely degenerate output is handled by mode:

- **Synchronous Observer and Reflector** follow `failurePolicy`. With `'continue'` the cycle is skipped, the input stays pending, and `onObservationEnd` / `onReflectionEnd` receive the error. With the default `'abort'` the turn fails as before.
- **Buffered (background) reflection** never fails the turn, regardless of `failurePolicy`. Nothing is committed, a failure marker is recorded when a stream writer is attached, and `onReflectionEnd` receives the error.

Fixes #24354.
