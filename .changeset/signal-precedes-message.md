---
'@mastra/core': patch
---

Fixed `MessageList.addSignal` ignoring `metadata.precedesMessageId`. Memory's temporal-gap reminder asks to sit just before the user message it describes, but was stamped after it, so models read the reminder as the latest turn and some replied to it or returned an empty answer. A signal naming a message already in the list now sorts directly before that message.
