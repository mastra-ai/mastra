---
'@mastra/core': patch
---

Server telemetry events can now carry an optional secondary project identifier, `project_id2`, while all existing project identifiers remain unchanged. It is derived from the `MASTRA_PROJECT_ID` environment variable when set (prefixed `mp_`), falling back to a SHA-256 hash of the project's git `origin` remote URL, and is omitted when neither is available.
