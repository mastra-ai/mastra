---
'@mastra/platform-workspace': patch
'@mastra/agent-browser': patch
'@mastra/platform': patch
---

Fixed thread-scoped browsers launching a new browser while closing. Closing an `AgentBrowser` (or a remote provider built on it, such as `FirecrawlBrowser`) no longer opens a browser for the default thread just to read its state.
