---
'mastra': patch
---

**Added**

Observability API commands now target the hosted Mastra Platform Observability API by default and can infer credentials from project environment variables, project metadata, or the CLI login token.

Added `mastra api trace light <traceId>` and `mastra api trace span <traceId> <spanId>` for debugging traces without fetching full trace payloads up front.
