---
'@mastra/pg': minor
---

Added `transactionTimeoutHeadroomMs` to `PostgresStore`, so transactions with a deadline make fewer round trips to the database.

A transaction with a deadline sets its statement and lock timeouts before every statement, which doubles its round trips. With headroom, it sets them a little shorter than the time left and reuses them for that long. A statement may stop up to the headroom earlier, never later. Only the store's own statements reuse the timeouts. Your own SQL in the transaction (for example through `pgKnowledgeTransactionClient`) may change them, so the store sets them again after each of your statements. The default `0` keeps the current behavior.

```ts
const store = new PostgresStore({
  id: 'knowledge',
  connectionString,
  transactionTimeoutHeadroomMs: 1000,
});
```
