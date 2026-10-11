---
'@mastra/pg': patch
'@mastra/dsql': patch
---

Fixed concurrent `create()` calls deleting another caller's draft. When two requests created the same prompt block, agent, MCP client, MCP server, scorer definition, skill, or workspace at the same time, the request that lost with a duplicate-key error could delete the winner's unpublished draft. Cleanup now only removes a draft the failing call inserted itself.

Also fixed failed creates leaving an orphaned draft behind. If saving the initial version failed, the draft row was sometimes kept because the cleanup step was skipped. It is now removed and the original error is still thrown.
