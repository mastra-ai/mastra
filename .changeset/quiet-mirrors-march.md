---
'mastra': patch
'@mastra/editor': patch
---

Fixed the Agent Builder so newly created agents reliably get a real name, description, and instructions back-filled. Previously the builder could leave the truncated starter prompt as the agent's name, stall before writing instructions, or repeatedly call `set-agent-model` with empty payloads.

The form snapshot the builder reads now shows a per-field setter directive next to each value so the builder knows which fields are already set and which it still needs to write, and a placeholder-name check tells the builder when the name is still the auto-generated starter prompt and should be replaced. The Agent Builder system prompt was trimmed to defer to those snapshot directives instead of restating the setter ordering itself.
