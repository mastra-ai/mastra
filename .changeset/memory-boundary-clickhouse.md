---
'@mastra/clickhouse': patch
---

Improved `messageHistory` trim boundary handling. ClickHouse's replicated engine cannot return an authoritative boundary across replicas, so distributed persistence is conservatively skipped; the token budget is still applied on every request, so prompts stay within `maxTokens`.
