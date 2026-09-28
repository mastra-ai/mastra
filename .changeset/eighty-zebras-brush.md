---
'@mastra/playground-ui': patch
---

Added chat message rendering components to `@mastra/playground-ui` so messages with tool calls can be displayed outside Studio's chat, for example in trace views. `MessageRow`, `ToolCard`, and their badges and hooks are now available under `@mastra/playground-ui/domains/chat/*`. `@mastra/ai-sdk` is now a peer dependency.
