---
'@mastra/core': patch
---

Fixed MessageList.addSignal ignoring a signal's metadata.precedesMessageId, which made memory's temporal-gap reminder sort after the user message it describes — models read the reminder as the latest turn and sometimes replied to it instead of the user. A signal that names the message it precedes is now stamped just before that message. Fixes #26751
