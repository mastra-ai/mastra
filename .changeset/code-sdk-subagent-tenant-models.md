---
'@mastra/code-sdk': patch
---

Subagents now resolve models the same way the main agent does, including custom providers and tenant credentials from the calling run. Model IDs owned by another registered gateway still go to that gateway.

Behavior change for Factory: tenant subagents no longer fall back to the server's environment API keys (such as `ANTHROPIC_API_KEY`). A subagent whose provider isn't connected for the signed-in account now fails with a missing-credential error, matching the main agent. Connect the provider or add an org credential for those accounts.
