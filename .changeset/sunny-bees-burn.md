---
'@mastra/editor': patch
---

Sped up agent creation by running the independent configuration steps (name, description, model, tools, skills, workspace) in parallel instead of one after another, so building an agent finishes faster.
