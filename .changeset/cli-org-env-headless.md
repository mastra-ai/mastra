---
'mastra': patch
---

Fixed `mastra env` and `mastra db` failing with `No organizations found.` in CI. They now read `MASTRA_ORG_ID` before asking the platform for your organizations, so a headless `MASTRA_API_TOKEN` run with no stored login resolves the org, matching `mastra deploy`. `MASTRA_ORG_ID` also now takes precedence when you belong to a single organization, consistent with its "always wins" behavior elsewhere.
