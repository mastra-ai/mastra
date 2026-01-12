---
"@mastra/rag": minor
---

Add schema-driven metadata extraction with Zod support

Introduces a new `SchemaExtractor` that enables extraction of custom structured metadata from document chunks using user-defined Zod schemas. This allows for domain-specific metadata structures (e.g., product details, legal entities, sentiment analysis) to be reliably extracted via LLM structured output.

- Add `SchemaExtractor` for custom metadata extraction with Zod schemas
- Support for optional custom LLM models and extraction instructions
- Support for nesting extracted data under a specified metadata key
- Existing extractors (title, summary, keywords, questions) remain unchanged and fully compatible

Fixes #11799
