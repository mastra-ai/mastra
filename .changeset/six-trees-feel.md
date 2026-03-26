---
'mastra': patch
---

- Add DuckDB to `create-mastra` example code. Observability storage will use it instead of LibSQL so that "metrics" work
- Improved API key security in create-mastra example by masking input with `*` characters
