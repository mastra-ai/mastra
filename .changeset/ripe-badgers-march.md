---
'@mastra/core': patch
---

Fix OpenAI reasoning model + memory failing on second generate with "missing item" error

When using OpenAI reasoning models with memory enabled, the second `agent.generate()` call would fail with: "Item 'rs_...' of type 'reasoning' was provided without its required following item."

The issue was that `text-start` events contain `providerMetadata` with the text's `itemId` (e.g., `msg_xxx`), but this metadata was not being captured. When memory replayed the conversation, the reasoning part had its `rs_` ID but the text part was missing its `msg_` ID, causing OpenAI to reject the request.

The fix adds handlers for `text-start` (to capture text providerMetadata) and `text-end` (to clear it and prevent leaking into subsequent parts).

Fixes #11481
