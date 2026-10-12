---
'@mastra/core': patch
---

Fixed observational memory's temporal-gap reminder appearing after the user message it describes. Signals that set `metadata.precedesMessageId` to a message already in the conversation now sort directly before that message, both in the prompt and in saved history, so models no longer read the reminder as the latest turn.
