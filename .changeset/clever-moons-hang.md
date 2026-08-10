---
'@mastra/platform-workspace': minor
---

Added boot observability to PlatformSandbox for tracing slow session starts. New optional sessionId and threadId options are sent to the workspace proxy as advisory x-mastra-session-id / x-mastra-thread-id headers so proxy-side logs can be joined back to the calling session. The sidecar health probe now logs its outcome (duration and attempt count on success, a warning on timeout), and start() logs one timing summary line with the total boot time and proxy round-trip time.
