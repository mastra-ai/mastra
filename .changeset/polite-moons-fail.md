---
'@mastra/observability': patch
---

feat(spans): implement entity inheritance for child spans

Added tests to verify that child spans inherit entityId and entityName from their parent spans when not explicitly provided. Also included functionality to allow child spans to override these inherited values. This ensures proper entity identification across multiple levels of span hierarchy.
