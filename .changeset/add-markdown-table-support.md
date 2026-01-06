---
'@mastra/rag': patch
---

Add table support to markdown transformer

Added support for markdown tables in the `MarkdownHeaderTransformer` to prevent tables from being split in the middle during document chunking. Tables are now treated as semantic units similar to code blocks.

**Changes:**
- Updated `MarkdownHeaderTransformer` to detect and preserve markdown tables during chunking
- Tables are identified by lines containing pipe characters (`|`)
- Tables are kept together as a single block, preventing splits that would break table structure
- Added comprehensive test coverage for table handling in various scenarios
- Works with both simple and complex tables, including multi-row tables and tables with different formatting

**Usage:**
```typescript
import { MDocument } from '@mastra/rag';

const doc = MDocument.fromMarkdown(`
# Data Report

## Results

| Name | Score | Status |
|------|-------|--------|
| Alice | 95   | Pass   |
| Bob   | 87   | Pass   |
| Carol | 78   | Pass   |

## Summary

The results show...
`);

const chunks = await doc.chunk({
  strategy: 'markdown',
  headers: [
    ['#', 'title'],
    ['##', 'section'],
  ],
});

// Tables will now be preserved intact within chunks
```

