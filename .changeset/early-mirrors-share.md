---
'@mastra/factory': patch
---

Fixed chats in a Factory using the Factory's observational memory settings instead of their owner's. Memory settings now follow the Factory's model routing, the same as models and credentials:

- A chat that runs on personal credentials uses its owner's **Personal memory** settings.
- A run that uses the Factory's credentials uses **Factory memory**.

Before, a chat in a hybrid Factory could fail with `No usable anthropic credential is available` even though the owner had picked an OpenAI memory model and connected OpenAI.
