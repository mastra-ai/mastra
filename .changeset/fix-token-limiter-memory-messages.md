---
'@mastra/core': patch
---

Fixed `TokenLimiterProcessor` not filtering memory messages when limiting tokens.

Previously, the processor only received the latest user input messages, missing the conversation history from memory. This meant token limiting couldn't filter historical messages to fit within the context window.

The processor now correctly:
- Accesses all messages (memory + input) when calculating token budgets
- Accounts for system messages in the token budget
- Filters older messages to prioritize recent conversation context

Fixes #11902
