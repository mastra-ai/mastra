#!/usr/bin/env tsx

import { openai } from '@ai-sdk/openai';
import { writeFile, mkdir } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Sample texts to generate embeddings for
const SAMPLE_TEXTS = [
  'My favorite color is blue',
  'I understand your favorite color is blue.',
  'I have a pet',
  'What kind of pet do you have?',
  'It is a cat named Fluffy',
  'Fluffy is a lovely name for a cat!',
  'Hello',
  'Hi there!',
  'What is my favorite color?',
  'What did I say about my pet?',
  'You have a cat named Fluffy',
  'Blue',
];

async function generateEmbeddings() {
  console.log('🔧 Generating fixture embeddings...\n');

  const embedder = openai.embedding('text-embedding-3-small');
  const embeddings: Record<string, number[]> = {};

  for (const text of SAMPLE_TEXTS) {
    console.log(`Generating embedding for: "${text}"`);
    const result = await embedder.doEmbed({
      values: [text],
    });
    embeddings[text] = result.embeddings[0];
  }

  // Save embeddings to fixtures directory
  const fixturesDir = join(__dirname, '..', 'src', '__fixtures__');
  await mkdir(fixturesDir, { recursive: true });

  const outputPath = join(fixturesDir, 'embeddings.json');
  await writeFile(outputPath, JSON.stringify(embeddings, null, 2));

  console.log(`\n✅ Embeddings saved to: ${outputPath}`);
  console.log(`Generated ${Object.keys(embeddings).length} embeddings`);
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  generateEmbeddings().catch(console.error);
}

export { generateEmbeddings };
