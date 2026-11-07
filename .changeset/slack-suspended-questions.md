---
'@mastra/core': patch
'@mastra/server': patch
'@mastra/factory': patch
---

Deliver suspended `ask_user` questions in Slack with choice buttons and custom-answer modals, and route authorized replies back to the originating run. Recover persisted tool suspensions after a controller restart so answers from Slack or the web resume the original run instead of reporting no pending suspension.
