import { readFileSync } from 'fs';
import { join } from 'path';

// Load fixture embeddings - use relative path from project root
const embeddingsPath = join(process.cwd(), 'src', '__fixtures__', 'embeddings.json');
let fixtureEmbeddings: Record<string, number[]> = {};

try {
  fixtureEmbeddings = JSON.parse(readFileSync(embeddingsPath, 'utf-8'));
} catch (error) {
  console.warn('Warning: Could not load fixture embeddings, using random embeddings instead');
}

/**
 * Mock embedding function that returns fixture embeddings or generates random ones
 */
export function createMockEmbedding() {
  return {
    doEmbed: async ({ values }: { values: string[] }) => {
      const embeddings = values.map(text => {
        // Return fixture embedding if available
        if (fixtureEmbeddings[text]) {
          return fixtureEmbeddings[text];
        }

        // Otherwise generate a deterministic "random" embedding based on the text
        // This ensures the same text always gets the same embedding
        const seed = text.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
        const embedding = new Array(1536).fill(0).map((_, i) => {
          // Use a simple deterministic function to generate values
          return Math.sin(seed + i) * Math.cos(seed * i * 0.01);
        });

        return embedding;
      });

      return { embeddings };
    },
  };
}

/**
 * Get a specific fixture embedding by text
 */
export function getFixtureEmbedding(text: string): number[] | undefined {
  return fixtureEmbeddings[text];
}

/**
 * Get all available fixture texts
 */
export function getFixtureTexts(): string[] {
  return Object.keys(fixtureEmbeddings);
}
