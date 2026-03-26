---
'mastra': patch
---

- Add DuckDB to `create-mastra` example code. Observability storage will use it instead of LibSQL so that "metrics" work
- Use a password prompt instead of text for the API key input which will mask the input with `*` characters
