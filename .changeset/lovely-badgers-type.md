---
'@mastra/core': patch
---

fixes an issue where input processors couldn't add system or assistant messages. Previously all messages from input processors were forced to be user messages, causing an error when trying to add other role types.
