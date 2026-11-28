---
'@mastra/memory': patch
---

Each observation chunk in the agent's context is now its own `<observations>…</observations>` block, instead of every chunk sharing one block with a closing tag at the end. New observations now only add messages after the existing ones, so a prompt-cache breakpoint on the last observation stays valid after the next observation instead of being invalidated every time.

Refs #30514
