---
'@mastra/factory': patch
---

Slack's reply tool, "Open session ↗" link, typing status and reply reminder now come from core's `replyMode` and `threadLink` adapter options. The channel prompt's shared wording moved to core and changed slightly: it says "conversation" instead of "session", "another agent" instead of "side session", and drops the commit and Linear link examples. Factory's own lines (pull request links, GitHub, Linear and Factory links, agent shorthand) are unchanged.
