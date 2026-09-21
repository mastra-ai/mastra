---
'@mastra/core': patch
---

Hardened Harness terminal handoff settlement ordering and observer delivery.

- A stale settlement retry's pending-clearing flush is fenced to the pending generation it captured, so it cannot clear or re-park over a newer suspension parked after the winner completed.
- Undeliverable re-suspension teardown now cancels the bound deferred terminal admission, so a discarded segment cannot strand a 'pending' grant with no recoverable interaction.
- Committed-winner recovery without the responding caller's `responseId` marks that generation's `accepted` inbox receipts `applied`, so a late retry resolves the durable result instead of reading a nonterminal receipt forever.
- An adopted duplicate stream whose run-completion barrier rejects now drains retained terminal observers with the indeterminate outcome instead of swallowing the failure.
- Terminal JSON validation enforces a bounded nesting depth, so an excessively deep product seed produces the typed validation error instead of a raw recursion failure.
