---
'@mastra/valkey-streams': patch
---

Fixed publishes failing when the Valkey connection dropped mid-write. A publish that fails with a closed connection, a connection timeout, or Valkey answering `LOADING` while it reloads its dataset after a restart now retries for up to two minutes instead of losing the event. If Valkey wrote the event but the reply was lost, the retry appends it again, so subscribers can receive a duplicate delivery with the same event id. A publish that could not reach Valkey before the budget ran out rejects with `PublishRetryBudgetExhaustedError`; tune the budget with the new `publishRetryBudgetMs` option. A client whose initial connect failed is now rebuilt on the next publish instead of leaving the writer permanently unusable.
