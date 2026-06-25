---
'mastracode': patch
---

Bring model packs and custom providers to MastraCode Web.

The web Settings modal now has two new sections that mirror the TUI's
`/models-pack` and `/custom-providers` commands:

- **Packs** — list built-in packs (gated by provider access) and saved custom
  packs, activate a pack onto the current project's session (seeds per-mode
  models, switches the active model, sets subagent models, tags the thread),
  and create custom packs by choosing a build/plan/fast model.
- **Custom** — add, edit and remove OpenAI-compatible custom providers
  (name, base URL, optional API key, model list).

Both are backed by new server-side `/api/web/config/*` routes that read and
write the same global settings (`settings.json`) the TUI uses, so packs and
providers stay in sync across the terminal and the browser. Keys are never
returned to the client — only their presence.
