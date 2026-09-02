---
'@mastra/server': patch
---

Fixed the Studio browser viewer checking whether the wrong thread's browser was running. When a viewer connected for a specific thread, the server asked the browser toolset about the globally "current" thread instead of the viewer's thread, which could log "Browser ready" and "Browser not running" for the same thread and leave the viewer stuck waiting. The viewer's thread ID is now passed through so the check answers for the right thread. Fixes https://github.com/mastra-ai/mastra/issues/22538
