---
'@mastra/core': patch
---

Fixed thread stream subscriptions so direct agent streams remain readable by callers, resumed runs can be tracked without confusing multiple stream lifetimes for the same run, generic suspended tools remain discoverable without waking unrelated idle runs, subscribers stay attached across non-final tool-call boundaries, Harness/tool approval resumes use the new experimental `sendStreamResume()` acknowledgement API, and signal routing preserves active steering intent while explicitly blocking unrelated idle wake attempts during suspended runs.
