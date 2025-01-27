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

// Example 1: Direct metadata extraction
await doc.extractMetadata({
  keywords: true,
  summary: true,
});
const meta = doc.getMetadata();
console.log('Extracted Metadata:', meta);

// Example 2: Using chunk with metadata extraction
await doc.chunk({
  strategy: 'recursive',
  size: 200,
  extract: {
    keywords: true,
    summary: true,
  },
});
const metaTwo = doc.getMetadata();
console.log('Extracted Metadata:', metaTwo);
