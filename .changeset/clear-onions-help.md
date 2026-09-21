---
'@mastra/playground-ui': minor
---

Added column sorting across Studio lists. Click a column header to toggle ascending/descending on agents, workflows, tools, processors, scorers, MCP servers, schedules, workspace skills, logs, traces, scores, inbox feedback, prompt blocks, datasets, dataset items and experiments. Sort on server-backed lists is kept in the URL (\`?sort=<field>&dir=asc|desc\`) so it survives reloads. Also exports shared \`sortBy\` and \`useUrlSort\` helpers from \`@mastra/playground-ui/sort/*\`.
