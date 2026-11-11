---
'@mastra/factory': patch
---

When a Factory tool-result rule completes a card, finish cleaning up its run bindings instead of waiting on the result's own reconciliation until timeout. Earlier unread tool results are processed before the terminal result, and other bound sessions' trailing results are still reconciled before their bindings are revoked.
