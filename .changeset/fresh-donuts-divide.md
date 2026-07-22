---
'@mastra/ai-sdk': patch
---

Fixed the AI SDK v6 native approval flow in handleChatStream so approval responses are collected across all assistant messages instead of only the final message. Approving a tool call now resumes its exact run and tool call, multiple approval responses in one request resume sequentially in a single framed response stream, and already-resolved responses from history are safely skipped instead of executing again.
