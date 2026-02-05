---
'@mastra/ai-sdk': patch
---

Fixed duplicate assistant messages appearing when using `addToolOutput` with `sendAutomaticallyWhen`. Previously, continuation flows (e.g. client-side tool results) generated a new assistant message instead of updating the existing one. Now the response correctly appends to the original assistant message, so `useChat` no longer shows two separate replies.
