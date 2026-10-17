---
'@mastra/core': patch
---

Channels now include the text of Slack Block Kit layout blocks (header, section, context, markdown) in the message text an agent receives, for both the triggering message and thread history. Previously, bot and webhook alerts that put their details in blocks reached the agent as only the short notification fallback, and block-only messages were dropped.
