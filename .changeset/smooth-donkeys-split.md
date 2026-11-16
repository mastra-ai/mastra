---
'@mastra/rag': patch
---

JSON chunking now keeps every character of a long string value when a field name or JSON escaping pushes split pieces over `maxSize`, instead of silently dropping them. Values are split at code-point boundaries, so emoji are never cut in half. A chunk can still exceed `maxSize` when a field path leaves no room for a single character (#30405).
