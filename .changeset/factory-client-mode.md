---
'mastracode': minor
---

Added Factory mode to Mastra Code. The TUI can now run as a thin client for a Factory session, so the agent, tools, models, modes, and provider credentials all come from the Factory.

```sh
/factory connect   # sign in to Mastra Platform, pick a project and repository
/local             # switch back to local mode, keeping the connection saved
/factory           # switch into the saved Factory again
/factory status    # show the current mode and saved Factory
/factory disconnect
```

- Switching modes restarts the TUI in place.
- Local-only commands (MCP, hooks, plugins, `/login`, model packs, `/goal`, `/diff`, `/github`, `/settings`, and similar) are disabled in Factory mode.
- If the Factory can't be reached at startup, Mastra Code falls back to local mode with a notice. Set `MASTRACODE_LOCAL=1` to run locally for one launch.
