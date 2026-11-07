---
'@mastra/react': patch
---

Fixed `useChat` splitting an answer into two assistant messages when you send a follow-up while the answer is still streaming. The rest of the answer now stays in the same message above your follow-up, matching the stored conversation, and no extra message is left behind after the run ends. Fixes [#29163](https://github.com/mastra-ai/mastra/issues/29163).
