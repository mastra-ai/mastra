---
'@mastra/core': patch
---

Fixed durable agent runs hanging when a step runs on a process that never registered the agent. Rebuilding a run now looks the agent up in the editor's stored agents too, so a separate worker process can run steps for editor-stored agents. If no source knows the agent, the step now fails with a `DurableAgentNotFoundError` that names the agent and run, instead of running without tools or memory and leaving the stream waiting.
