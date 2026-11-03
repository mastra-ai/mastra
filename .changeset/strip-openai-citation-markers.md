---
'@mastra/core': patch
---

Fixed OpenAI citation markers such as `citeturn0search0` leaking into agent responses. When OpenAI models use built-in tools like `web_search`, they can write internal citation markup into text, reasoning, and tool-call arguments. Mastra now strips these markers before the stream reaches your app, saved memory, or tool `execute` functions. The structured citations still arrive as `source` chunks.
