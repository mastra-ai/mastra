---
"@mastra/rag": minor
---

Add schema-driven metadata extraction with Zod support

Introduces a new `SchemaExtractor` that enables extraction of custom structured metadata from document chunks using user-defined Zod schemas. This allows for domain-specific metadata structures (e.g., product details, legal entities, sentiment analysis) to be reliably extracted via LLM structured output.

- Extract domain-specific metadata using your own Zod schemas (e.g., product details, legal entities, sentiment)
- Customize extraction behavior with your own LLM model and instructions
- Organize extracted data by nesting it under custom metadata keys
- Existing extractors (title, summary, keywords, questions) remain unchanged and fully compatible

**Before** (limited to built-in extractors):

```typescript
await document.extractMetadata({
  extract: {
    title: true,
    summary: true
  }
});
```

**After** (with custom Zod schema):

```typescript
import { z } from 'zod';

const productSchema = z.object({
  name: z.string(),
  price: z.number(),
  category: z.string()
});

await document.extractMetadata({
  extract: {
    title: true,
    schema: {
      schema: productSchema,
      instructions: "Extract product details from the document",
      metadataKey: "product"
    }
  }
});
```

With `metadataKey`, extracted data is nested under the key:

```typescript
{
  title: "Product Document",
  summary: "A comprehensive guide",
  product: {
    name: "Wireless Headphones",
    price: 149.99,
    category: "Electronics"
  }
}
```

Without `metadataKey`, extracted data is returned inline:

```typescript
{
  title: "Product Document",
  summary: "A comprehensive guide",
  name: "Wireless Headphones",
  price: 149.99,
  category: "Electronics"
}
```

Fixes #11799
