---
'mastracode': patch
'@mastra/code-sdk': patch
'@mastra/core': patch
---

Add a `/context` command (alias `/ctx`) to Mastra Code that reports what is occupying the context window.

The report separates the startup context — system prompt, AGENTS.md/CLAUDE.md instructions with their source paths, the skills catalog, and MCP tool definitions rolled up per server — from context that accumulates during the session, namely the conversation itself and any observation memory injected into it. Each line carries an estimated token count and its share of the audited total, so it is possible to see which server, instruction file, or skill set is worth pruning.

The audit reports only sizes and labels, never the audited content, and is printed to the terminal without being added to the conversation, so running it does not enlarge the context it describes.

To support exact measurement, `@mastra/core` now exports `formatSkillsCatalog`, the pure formatter behind the skills processor's `<available_skills>` block, and `@mastra/code-sdk` exposes the assembled system prompt as labeled sections.
