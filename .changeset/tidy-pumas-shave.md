---
'@mastra/ai-sdk': patch
---

Fixed `toModelOutput` only applying to the first turn when `useChat` holds the conversation history. Tool result metadata now reaches the browser, so the compact projection is what comes back on the next request instead of the full raw tool output. This keeps prompt size flat across turns for apps that do not use Mastra Memory.

Fixes [#22012](https://github.com/mastra-ai/mastra/issues/22012)
