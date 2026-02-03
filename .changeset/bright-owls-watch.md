---
'@mastra/playground-ui': minor
---

Add Observational Memory UI to the playground. Shows observation/reflection markers inline in the chat thread, and adds an Observational Memory panel to the agent info section with observations, reflection history, token usage, and config. All OM UI is gated behind a context provider that no-ops when OM isn't configured.
