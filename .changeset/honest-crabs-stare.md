---
'mastra': patch
---

Fixed `mastra api` trace, log, metric, and score commands for projects in the EU region. They now use the project's region instead of always calling the US observability endpoint, so EU projects return their data instead of empty results or timeouts. The CLI uses `MASTRA_PLATFORM_OBSERVABILITY_ENDPOINT` (written to `.env` by `mastra init`) when set, and otherwise looks up the project's region. `--url` still overrides both.
