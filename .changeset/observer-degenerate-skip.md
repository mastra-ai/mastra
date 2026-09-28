---
'@mastra/memory': patch
---

Observational Memory no longer rejects faithful summaries of long or repetitive tool output as degenerate.

- **Synchronous Observer and Reflector:** truly degenerate output follows `failurePolicy`. `'continue'` skips the cycle and reports the error via `onObservationEnd` / `onReflectionEnd`; the default `'abort'` fails the turn.
- **Buffered reflection:** truly degenerate output never fails the turn.

Fixes #24354.
