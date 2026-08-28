---
'@mastra/factory': patch
---

**A failing setup command no longer wedges the session.** When a repository's setup command exited non-zero, every sandbox start repeated the failure, so every tool call errored identically and the agent could never get a shell to fix the problem. The first failure still surfaces loudly in the tool result that triggered it, but the next start skips the known-bad command: the clone and branch checkout run as usual and the agent can repair or rerun the setup itself. Infrastructure failures (clone, checkout, transport) keep failing hard and retry in full.
