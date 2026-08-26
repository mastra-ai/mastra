---
'mastra': patch
---

Improved tool calls in the Studio chat: each call now renders as a compact row with an icon for what it does (Read, Edit, Run, Search…), the salient argument beside it (file path, command, query), a shimmer while it is running, and a failure mark when it errors. Expanding a row reveals the arguments and result as compact monospace blocks hanging off an indented rail, each with a hover copy button, instead of full-width headed sections. Workspace tools get named actions instead of raw identifiers like mastra_workspace_read_file, and unknown tools get a readable name instead of their snake_case id. This is the same tool row language used by Mastra Factory, now shared through the design system.
