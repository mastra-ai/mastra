---
'@mastra/clickhouse': patch
---

Fixed ClickHouse observability storage failing to start against ClickHouse servers older than 25.6.

The delta polling tables declared their retention TTL directly on a `DateTime64` column. Servers before 25.6 reject that with `BAD_TTL_EXPRESSION (code 450)`, so `init()` threw and the store could not be adopted at all:

```text
Failed to initialize ClickHouse v-next observability tables: TTL expression result column should have DateTime or Date type, but has DateTime64(9, 'UTC')
```

The TTL expression now casts the column to `DateTime` before applying the interval. Stored column precision is unchanged, and tables already created on newer servers are unaffected.
