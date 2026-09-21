---
'@mastra/core': patch
---

Hardened Harness terminal handoff settlement ordering and observer delivery.

- A stale settlement retry no longer discards a newer suspended interaction.
- Undeliverable re-suspension teardown now cancels the bound deferred terminal admission, so a discarded segment cannot strand a 'pending' grant with no recoverable interaction.
- A late retry after a crashed response now resolves the committed result instead of reading a nonterminal receipt forever.
- An adopted duplicate stream whose run-completion barrier rejects now drains retained terminal observers with the indeterminate outcome instead of swallowing the failure.
- Terminal JSON validation enforces a bounded nesting depth, so an excessively deep product seed produces the typed validation error instead of a raw recursion failure.
