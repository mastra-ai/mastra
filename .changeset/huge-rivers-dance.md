---
'@mastra/core': patch
---

Durable agents now deliver `abort()` requests to a tool's `abortSignal` even when the tool runs on another worker.

Each worker also enforces the run's `modelSettings.timeout.totalMs` deadline through that signal. After the abort grace window, the run stops waiting for the tool and ends with a `MastraTimeoutError`. A tool that ignores its signal can keep running; its step is saved with the aborted-tool notice.

Tool steps queued after the run stops do not invoke the tool. Cancellation while waiting for an awaited background task preserves the run's timeout or abort outcome. A sibling tool's mapping failure does not mask that outcome.

The stream reports the same deadline error only once, even if it arrives from multiple processes.
