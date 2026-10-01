---
'@mastra/factory': patch
---

Fixed Slack-triggered Factory runs failing with "No usable <provider> credential" after a server restart. Slack mentions, DMs, and thread replies now load the linked user's model credentials before the run starts, instead of relying on that user having opened the web UI first.
