---
'@mastra/core': patch
---

Persist `scorerName` onto its own top-level column on observability score records instead of stuffing it inside `metadata`. The score record schema already exposes a top-level `scorerName` column; the record builder was working around an earlier gap where `ScoreEvent` did not carry `scorerName`. With that gap closed, the workaround is removed so queries and UIs can read `scorerName` directly without scanning metadata.
