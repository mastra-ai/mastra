---
'@mastra/rag': patch
---

Add maxSize support for HTML chunking strategies

Added support for the `maxSize` option in HTML chunking strategies (`headers` and `sections`), allowing users to control the maximum chunk size when chunking HTML documents. Previously, HTML chunks could be excessively large when sections contained substantial content.

**Changes:**
- Added `maxSize` support to `headers` strategy - applies `RecursiveCharacterTransformer` after header-based splitting
- Added `maxSize` support to `sections` strategy - applies `RecursiveCharacterTransformer` after section-based splitting  
- Fixed `splitHtmlByHeaders` content extraction bug - changed from broken `nextElementSibling` to working `parentNode.childNodes` approach
- Added comprehensive test coverage including integration test with real arXiv paper

**Usage:**
```typescript
import { MDocument } from '@mastra/rag';

const doc = MDocument.fromHTML(htmlContent);

const chunks = await doc.chunk({
  strategy: 'html',
  headers: [
    ['h1', 'Header 1'],
    ['h2', 'Header 2'],
    ['h3', 'Header 3'],
  ],
  maxSize: 512,  // Control chunk size
  overlap: 50,   // Optional overlap for context
});
```

**Results from real arXiv paper test:**
- Without maxSize: 22 chunks, max 45,531 chars (too big!)
- With maxSize=512: 499 chunks, max 512 chars (properly sized)

Fixes #7942

