---
'@mastra/core': patch
---

Fixed the coding agent's system prompt naming a tag the runtime never emits. It described user messages as `<user-message delivery="…">`, while a signal is always wrapped as `<user delivery="…">`, so the guidance about a message that arrives mid-work was keyed on a tag the model never sees.

The prompt now names the real tag, and says once that everything else is a normal new turn instead of describing `delivery="message"`, which no first-party client sends since the session started stamping only the interjection.
