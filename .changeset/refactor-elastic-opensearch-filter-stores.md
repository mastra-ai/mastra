---
"@mastra/elasticsearch": patch
"@mastra/opensearch": patch
---

Refactored both stores to extend the shared `ElasticDSLFilterTranslator` from `@mastra/core`, so future filter bug fixes apply to both engines simultaneously. Fixes #13115.

This refactor also includes the following bug fixes that previously affected one or both engines:

- **OpenSearch:** Anchored regex patterns (`^foo*bar$`) now escape literal `*` and `?` before being converted to wildcard queries, preventing them from being interpreted as wildcard metacharacters.
- **OpenSearch:** The newline/carriage-return regex fallback now uses the coerced string value instead of the raw input, so non-string values are handled consistently.
- **Both engines:** `null` values passed to logical operators (`$and`, `$or`, `$not`, `$nor`) are now rejected with a clear error instead of slipping through validation (previously possible because `typeof null === 'object'`).
