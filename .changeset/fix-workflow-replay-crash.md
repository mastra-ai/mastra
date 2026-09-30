---
'@mastra/react': patch
---

Fixed Studio agent chat crashing with "Cannot read properties of undefined" when reopening a thread whose finished workflow tool call is replayed from the stream cache. Workflow chunks replayed onto a completed tool result now rebuild the workflow view instead of throwing.
