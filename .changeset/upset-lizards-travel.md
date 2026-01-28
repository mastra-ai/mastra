---
'@mastra/core': patch
---

Fixed custom data parts from writer.custom() breaking subsequent messages with Gemini. Messages containing only data-\* parts no longer produce empty content arrays that cause Gemini to fail with 'must include at least one parts field'.
