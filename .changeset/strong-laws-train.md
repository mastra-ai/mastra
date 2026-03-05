---
'@mastra/observability': patch
---

Fixed peer dependency constraint to require @mastra/core >= 1.9.0. The 1.3.0 release introduced imports (DEFAULT_BLOCKED_LABELS, CardinalityConfig, MetricsContext, and other metrics/logging types) that only exist in @mastra/core 1.9.0+, but the peer dependency still allowed versions as low as 1.1.0, causing runtime errors for users on older core versions.
