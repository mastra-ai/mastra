---
'@mastra/core': patch
---

Fix generateTitle not triggering for pre-created threads
When threads were pre-created via the client SDK (e.g., mastraClient.createMemoryThread()) before the first message was sent, the generateTitle: true option would not trigger automatic title generation. This was because the code checked if the thread title started with "New Thread" instead of properly tracking whether a title had been generated.
The fix uses a titleGenerated metadata flag to track whether title generation has occurred, which:
Works for threads pre-created with any custom title
Prevents duplicate title generation on subsequent messages
Allows users to opt-out by setting titleGenerated: true when creating threads
Fixes #11757
