---
'@mastra/memory': patch
---

Observational Memory rejects far fewer faithful summaries of long or repetitive tool output as degenerate. Very long lines are truncated instead of rejected, though a line whose retained text repeats may still be rejected. A short run of the same short tool line is accepted, but a short line whose occurrences add up to more than one maximum-size observation line (10,000 characters) is still treated as a loop.

Output that really is degenerate is handled by mode:

- **Synchronous Observer** follows `failurePolicy`. With `'continue'` the observation cycle is skipped, the messages stay unobserved, and `onObservationEnd` receives the error. With the default `'abort'` the turn fails as before.
- **Synchronous Reflector** follows `failurePolicy`. With `'continue'` no reflection is committed, the existing observations are kept unreflected, and `onReflectionEnd` receives the error. With the default `'abort'` the turn fails as before.
- **Buffered (background) reflection** never fails the turn, regardless of `failurePolicy`. Nothing is committed, a failure marker is recorded when a stream writer is attached, and `onReflectionEnd` receives the error.

When a Reflector retry fails or comes back larger, the Reflector now commits the smallest usable candidate from its retries. It only reports degenerate output when every attempt was degenerate or empty.

Under `'continue'`, repeated skips can let unobserved messages grow; limiting that backlog is left to a follow-up.

Fixes #24354.
