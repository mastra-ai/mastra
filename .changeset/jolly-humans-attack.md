---
'@internal/playground': patch
---

Harden the workflow snapshot-to-stream-result conversion in Studio against malformed step entries from in-flight workflow snapshots, and add a last-resort safety net so a malformed snapshot can no longer crash the workflow detail view via an ErrorBoundary overlay. The converter now skips context entries that are null/undefined, primitives, or arrays, and logs the failing snapshot to the console if conversion still throws unexpectedly. Defensive hardening — does not necessarily fix all reported sub-workflow detail crashes, but ensures the panel degrades gracefully and emits diagnostics for follow-up.
