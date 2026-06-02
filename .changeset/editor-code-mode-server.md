---
'@mastra/server': minor
'@mastra/client-js': minor
---

Added an agent override export API and server-side ownership enforcement.

The server and client now expose an agent override export endpoint so Studio can download an agent's overrides as JSON for review or commit workflows. Saves are enforced server-side against each agent's `editor` config, so only owned fields (instructions, tools, or tool descriptions) are persisted and fields locked by the `editor` config are stripped.

The system packages response also reports the active editor `source` so clients can render the correct editing experience.
