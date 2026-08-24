---
'@mastra/observability': patch
'@mastra/pg': patch
---

Fix PostgreSQL observability writes failing on NUL characters and unpaired Unicode surrogates

Span serialization truncated strings by UTF-16 code unit, so a cut inside an emoji left a lone surrogate that PostgreSQL rejected on the jsonb cast (`22P02`). NUL characters were rejected as well (`22P05`). Because observability events are inserted as a single multi-row statement, one malformed field discarded the entire batch.

Truncation now preserves complete surrogate pairs, and the v-next PostgreSQL observability encoder sanitizes NUL and unpaired surrogates before the jsonb cast, using the same sanitizer that workflow snapshots already rely on. Valid Unicode, including complete emoji, is preserved.
