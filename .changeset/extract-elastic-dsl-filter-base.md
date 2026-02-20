---
"@mastra/core": patch
"@mastra/elasticsearch": patch
"@mastra/opensearch": patch
---

Extracted shared ElasticSearch/OpenSearch filter translation logic into a common `ElasticDSLFilterTranslator` base class in `@mastra/core`. This eliminates ~370 lines of duplicated code between the two stores, ensuring bug fixes applied to one engine are automatically shared with the other.
