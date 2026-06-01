---
'@mastra/agent-browser': minor
---

Add `waitUntil` support to `browser_click`, `browser_press`, and `browser_select`. When provided, the tool waits for the page to reach the given load state (`load`, `domcontentloaded`, or `networkidle`) after the action completes, preventing the next `browser_snapshot` from capturing stale DOM when the interaction triggers navigation. The parameter is optional and behaviour is unchanged when omitted.

Fixes #17397.
