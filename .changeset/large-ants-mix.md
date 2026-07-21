---
'mastra': minor
---

Changed the default scope for `mastra env db create`. It now creates an **environment-scoped** database instead of a project-scoped one shared by every environment. This matches the more common case of isolating production and staging data.

**How the default is picked**

- If the project has one environment, that environment is used automatically.
- If it has several and the terminal is interactive, the CLI prompts you to select one (production pre-selected when present).
- In non-interactive mode (CI, `--json`) with multiple environments, the CLI now errors and asks you to pass an environment name or `--shared`, instead of silently attaching a shared database.

**New `--shared` flag**

Opt in to the old project-scoped behavior explicitly:

```bash
# Before (implicit shared scope)
mastra env db create --kind turso

# After (same effect)
mastra env db create --kind turso --shared

# Or scope to a specific environment
mastra env db create staging --kind turso
```
