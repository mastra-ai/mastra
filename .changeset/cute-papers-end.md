---
'@mastra/core': patch
---

Fixes #7254 where the onFinish callback wasn't returning assistant messages when using format: 'aisdk' in streamVNext. The messageList was being updated with response messages but these weren't being passed to the user's onFinish callback.
