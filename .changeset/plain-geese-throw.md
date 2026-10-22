---
'@mastra/factory': patch
---

In the Factory web UI, a Slack reply the agent posts with `reply_in_thread` now shows as the message itself, rendered as markdown, instead of a JSON tool card. The turn ends like any other reply, with the model, "Sent to Slack", a copy button that copies what was posted, and the time. While a reply is still being written it shows the text so far.
