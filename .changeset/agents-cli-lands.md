---
'mastra': minor
---

Added commands for building on Mastra Platform from the terminal: `mastra projects`, `mastra agents` (the Agents CLI), `mastra memory`, `mastra knowledge`, `mastra filesystems`, and `mastra sandboxes`.

```bash
mastra projects create "Support Desk"
export MASTRA_PROJECT_ID=<projectId>

mastra agents create --name Support --instructions "Answer billing questions."
mastra agents run <agentId> "Where is my invoice?" --resource user-1
mastra agents chat <agentId> --resource user-1

mastra memory create support-memory
mastra sandboxes create
mastra sandboxes exec <sandboxId> -- ls -la
```

Every option is available as a flag and no command prompts, so they run unattended in CI. `mastra agents chat` is an interactive conversation that also reads messages from stdin. Provisioning commands wait until the resource is ready. Pass `--no-wait` to return right away, and `--json` for machine-readable output.
