# Metadata Extraction

This example demonstrates how to extract and utilize metadata from documents using Mastra's document processing capabilities. The extracted metadata can be used for document organization, filtering, and enhanced retrieval in RAG systems.

## Overview

The system demonstrates metadata extraction in two ways:

1. Direct metadata extraction from a document
2. Chunking with metadata extraction

## Prerequisites

- Node.js v20.0+
- pnpm (recommended) or npm

## Getting Started

1. Clone the repository and navigate to the project directory:

   ```bash
   git clone https://github.com/mastra-ai/mastra
   cd examples/rag-metadata-extraction
   ```

2. Install dependencies:

   ```bash
   pnpm install
   ```

3. Run the example:

   ```bash
   pnpm start
   ```

## Document Creation

Create a document from text content:

```typescript
import { MDocument } from '@mastra/rag';

const doc = MDocument.fromText(`Title: The Benefits of Regular Exercise

Regular exercise has numerous health benefits. It improves cardiovascular health,
strengthens muscles, and boosts mental wellbeing.

Key Benefits:
• Reduces stress and anxiety
• Improves sleep quality
• Helps maintain healthy weight
• Increases energy levels

For optimal results, experts recommend at least 150 minutes of moderate exercise
per week.`);
```

## 1. Direct Metadata Extraction

Extract metadata directly from the document:

```typescript
// Configure metadata extraction options
await doc.extractMetadata({
  keywords: true, // Extract important keywords
  summary: true, // Generate a concise summary
});

// Retrieve the extracted metadata
const meta = doc.getMetadata();
console.log('Extracted Metadata:', meta);

// Example Output:
// Extracted Metadata: {
//   keywords: [
//     'exercise',
//     'health benefits',
//     'cardiovascular health',
//     'mental wellbeing',
//     'stress reduction',
//     'sleep quality'
//   ],
//   summary: 'Regular exercise provides multiple health benefits including improved cardiovascular health, muscle strength, and mental wellbeing. Key benefits include stress reduction, better sleep, weight management, and increased energy. Recommended exercise duration is 150 minutes per week.'
// }
```

## 2. Chunking with Metadata

Combine document chunking with metadata extraction:

```typescript
// Configure chunking with metadata extraction
await doc.chunk({
  strategy: 'recursive', // Use recursive chunking strategy
  maxSize: 200, // Maximum chunk size
  extract: {
    keywords: true, // Extract keywords per chunk
    summary: true, // Generate summary per chunk
  },
});

// Get metadata from chunks
const metaTwo = doc.getMetadata();
console.log('Chunk Metadata:', metaTwo);

// Example Output:
// Chunk Metadata: {
//   keywords: [
//     'exercise',
//     'health benefits',
//     'cardiovascular health',
//     'mental wellbeing',
//     'stress reduction',
//     'sleep quality'
//   ],
//   summary: 'Regular exercise provides multiple health benefits including improved cardiovascular health, muscle strength, and mental wellbeing. Key benefits include stress reduction, better sleep, weight management, and increased energy. Recommended exercise duration is 150 minutes per week.'
// }
```
