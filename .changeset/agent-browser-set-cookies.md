---
'@mastra/agent-browser': minor
---

Added `setCookies()` support to `AgentBrowser`. Cookies set before a thread's browser opens are added before it loads any page, so pages open signed in.
