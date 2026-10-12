---
'@mastra/core': patch
---

Fixed observational memory's temporal-gap reminder appearing after the user message it describes. A signal can set `metadata.precedesMessageId` to a message already in the conversation. That signal now sorts directly before the message in the prompt. Saved history keeps the same order. Models no longer read the reminder as the latest turn.
