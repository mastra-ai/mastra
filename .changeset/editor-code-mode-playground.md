---
'mastra': minor
---

Added the agent override editing experience to Studio for the `code` editor source.

When the project uses `MastraEditor({ source: 'code' })`, the agent Editor tab swaps Save/Publish for Download JSON and Save to filesystem (and Open PR when platform wiring is available), and surfaces git commits of per-agent JSON files as read-only version history. Fields locked by an agent's `editor` config render read-only with an "owned by code" notice, and the unsaved-changes prompt matches the active source.

The default `source: 'db'` flow is unchanged. Also fixed the Editor test chat so saved draft changes are reflected without a page refresh.
