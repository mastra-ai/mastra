---
'mastracode': minor
'@mastra/code-sdk': minor
---

Added Factory mode to Mastra Code. Run `/factory connect` to sign in to Mastra Platform, pick a Factory project and repository, and start a Factory session. After a restart, the TUI runs as a thin client: the agent, tools, models, modes, and provider credentials all come from the Factory, and local-only commands (MCP, hooks, plugins, `/login`, model packs, `/goal`, and similar) are disabled. Run `/factory disconnect` and restart to return to local mode.
