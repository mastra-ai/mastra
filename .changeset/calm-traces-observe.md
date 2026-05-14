---
'mastra': patch
---

Observability API commands now target the hosted Mastra Platform Observability API by default and can infer credentials from project environment variables, project metadata, or the CLI login token.

`mastra api trace get <traceId>` now fetches lightweight trace details by default, `--verbose` fetches the full trace payload, and `mastra api trace span <traceId> <spanId>` fetches one full span after identifying it from the lightweight trace.
