---
'@mastra/factory': patch
---

Chats on personal defaults no longer borrow from the Factory defaults. In **Personal** routing and in **Hybrid** chats, a chat with no personal thinking level now starts at medium instead of the Factory thinking level, and a chat with no personal default model starts on a built-in model your own keys can run instead of the Factory model.

New sessions without a chosen default model now start on the same built-in model the server picks, in every routing mode. Empty default model pickers in Models settings name that model as **Built-in default**, and the New session page only asks you to connect a provider or choose a model when none of your keys can run one. The Factory defaults card in Personal routing says it is **Not used in this scope**, and the composer labels the medium fallback **Built-in default**.
