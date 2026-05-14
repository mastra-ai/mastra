---
'mastra': patch
---

**Added**

Observability API commands now target the hosted Mastra Platform Observability API by default and can infer credentials from project environment variables, project metadata, or the CLI login token.

Updated `mastra api trace get <traceId>` to fetch lightweight trace details by default, added `--verbose` for fetching full trace payloads, and added `mastra api trace span <traceId> <spanId>` for inspecting a single full span after identifying it from the lightweight trace.
