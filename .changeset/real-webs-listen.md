---
'@mastra/react': patch
---

Make `useChat` Stop cancel the active durable run, including runs without a memory thread, instead of only closing the response stream. On older servers, Stop closes the stream without showing an error.
