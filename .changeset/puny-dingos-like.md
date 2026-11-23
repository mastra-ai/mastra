---
'@mastra/core': patch
---

Fixed spans of a resumed durable agent run (`createDurableAgent`, `createEventedAgent`) losing their thread id, resource id, resume input and the `tracingOptions` passed to `resume()`. A filter by thread or resource now finds the whole run. The approved tool call and the thread title generation now nest under the resumed run.
