---
'@mastra/core': patch
---

Fixed an approved tool being skipped when a parked evented or durable agent run is approved on a different server than the one it parked on. The resumed tool call failed with "Thread run … lost its lease before publishing a terminal event" whenever it ran on the server the run had parked on, and the model asked for approval again. The tool now runs once and the run finishes. Fixes #31066.
