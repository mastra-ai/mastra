---
'mastracode': patch
---

Route MastraCode web through the official `@mastra/hono` adapter and bridge TUI behavior settings to the web UI.

MastraCode web now mounts the harness routes through the official `@mastra/hono`
`MastraServer` adapter (matching the production request path: validation, SSE
framing, and error shaping) instead of a hand-rolled route binder. This also
picks up the harness session SSE double-framing fix that ships in `@mastra/server`.

The web Settings modal can now read and write the agent-consumed behavior
settings that mirror the TUI's `/settings` command (`yolo`, `thinkingLevel`,
`notifications`, `smartEditing`), round-tripping through `setState`.
