---
"@mastra/core": patch
---

Added `ElasticDSLFilterTranslator`, an abstract base class for building Elastic DSL filter translators. Implement `translateLogicalOperator` and `translateRegexOperator` to create a custom Elastic-compatible filter translator backed by the shared translation pipeline. Fixes #13115.
