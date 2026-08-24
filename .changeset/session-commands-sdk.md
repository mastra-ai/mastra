---
'@mastra/code-sdk': minor
---

Custom slash commands can now load from a Mastra workspace filesystem (`loadWorkspaceCustomCommands`) and expand inside a session sandbox instead of on the host.

`processSlashCommand` takes an injected processing context — build one with `createNodeSlashCommandProcessingContext(workingDir)` or `createWorkspaceSlashCommandProcessingContext(workspace)` rather than passing a working-directory string. New `formatSlashCommandActivation` wraps processed output in the `<slash-command>` envelope and escapes literal closing tags.
