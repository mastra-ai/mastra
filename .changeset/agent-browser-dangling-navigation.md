---
'@mastra/agent-browser': patch
---

Fixed a crash that could occur when using `waitUntil` with `click`, `press`, or `select`. If the page navigation timed out while the action was still running, the whole Node process could crash instead of the tool returning a normal error result.
