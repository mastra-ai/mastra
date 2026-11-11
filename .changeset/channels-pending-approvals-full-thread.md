---
'@mastra/core': patch
---

Fixed channel tool-approval cards becoming unanswerable when the approval was older than the newest 50 messages in the thread. The persisted-approval lookup now reads the whole channel thread instead of one capped page, so a pending approval still awaiting an answer is found no matter how many newer messages follow it. This also restores the owner check on those cards: previously the message that triggered the tool call could fall outside the capped read, which let any thread member answer a card that only its requester may answer. Fixes [#29186](https://github.com/mastra-ai/mastra/issues/29186).
