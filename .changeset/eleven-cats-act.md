---
'@mastra/clickhouse': patch
---

Preserve custom span previews without truncating them and generate missing or blank write-time previews through the optional core helper. Keep stored empty previews out of read fallback and pass preview fields through unchanged with older core versions.
