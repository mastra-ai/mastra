/**
 * Seeds observability scores directly into the store with varied timestamps.
 * Run with: npx tsx src/seed-observability-scores.ts
 */
import { mastra } from './mastra/index';

const scorers = [
  { id: 'answer-relevancy-scorer', base: 0.75, variance: 0.2 },
  { id: 'faithfulness-scorer', base: 0.82, variance: 0.15 },
  { id: 'toxicity-scorer', base: 0.08, variance: 0.06 },
  { id: 'coherence-scorer', base: 0.7, variance: 0.25 },
  { id: 'hallucination-scorer', base: 0.15, variance: 0.12 },
  { id: 'completeness-scorer', base: 0.68, variance: 0.2 },
  { id: 'conciseness-scorer', base: 0.77, variance: 0.18 },
  { id: 'context-precision-scorer', base: 0.85, variance: 0.1 },
];

function randomScore(base: number, variance: number): number {
  return Math.max(0, Math.min(1, +(base + (Math.random() - 0.5) * 2 * variance).toFixed(3)));
}

async function seed() {
  const store = await mastra.getStorage()?.getStore('observability');
  if (!store) {
    console.error('No observability store available');
    process.exit(1);
  }

  let count = 0;

  for (const scorer of scorers) {
    for (let daysAgo = 0; daysAgo < 14; daysAgo++) {
      for (let hour = 0; hour < 24; hour += 2 + Math.floor(Math.random() * 2)) {
        const n = 1 + Math.floor(Math.random() * 3);
        for (let j = 0; j < n; j++) {
          const ts = new Date();
          ts.setDate(ts.getDate() - daysAgo);
          ts.setHours(hour, Math.floor(Math.random() * 60), Math.floor(Math.random() * 60), 0);

          await store.createScore({
            score: {
              scorerId: scorer.id,
              score: randomScore(scorer.base, scorer.variance),
              traceId: `seed-${scorer.id}-d${daysAgo}-h${hour}-${j}`,
              spanId: `seed-s-${scorer.id}-d${daysAgo}-h${hour}-${j}`,
              scoreSource: 'eval',
              timestamp: ts,
            },
          });
          count++;
        }
      }
    }
    console.log(`Seeded ${scorer.id}`);
  }

  console.log(`\nDone: ${count} scores across ${scorers.length} scorers over 14 days`);
  process.exit(0);
}

seed().catch(err => {
  console.error(err);
  process.exit(1);
});
