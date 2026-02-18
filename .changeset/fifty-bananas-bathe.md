---
'@mastra/observability': patch
---

feat(tracing): implement metadata inheritance for child spans

- Updated the BaseSpan constructor to inherit metadata from parent spans when not explicitly provided, merging values if both exist.
- Added tests to verify that child spans correctly inherit and can override metadata from their parent spans.
- Enhanced existing tests to ensure proper metadata propagation in tracing scenarios.
