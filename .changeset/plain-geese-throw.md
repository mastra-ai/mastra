---
'@mastra/factory': patch
---

In the Factory web UI, a Slack reply the agent posts with `reply_in_thread` now shows as the message itself, rendered as markdown with "Sent to Slack" under it, instead of a JSON tool card. Any text the agent writes in the same turn shows separately, since only the web UI sees it. While a reply is still being written it shows the text so far and "Sending to Slack…".
