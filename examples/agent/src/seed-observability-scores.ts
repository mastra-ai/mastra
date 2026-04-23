/**
 * Seeds observability scores via the HTTP API with natural time gaps.
 * Run multiple times with pauses between to get varied timestamps for the chart.
 *
 * Usage: npx tsx src/seed-observability-scores.ts [batches] [pauseSeconds]
 *   batches      - number of batches to create (default: 5)
 *   pauseSeconds - seconds to wait between batches (default: 60)
 */

const API = 'http://localhost:4111/api/observability/scores';

const SCORERS = [
  { id: 'answer-relevancy-scorer', baseScore: 0.75, variance: 0.2 },
  { id: 'content-quality-scorer', baseScore: 0.8, variance: 0.15 },
  { id: 'toxicity-scorer', baseScore: 0.05, variance: 0.05 },
];

function randomScore(base: number, variance: number): number {
  const val = base + (Math.random() - 0.5) * 2 * variance;
  return Math.max(0, Math.min(1, +val.toFixed(2)));
}

function randomId(): string {
  return Math.random().toString(36).slice(2, 10);
}

async function createScore(scorerId: string, score: number) {
  const body = {
    score: {
      traceId: `seed-${scorerId}-${randomId()}`,
      spanId: `span-${randomId()}`,
      scorerId,
      score,
      reason: `Seeded score for ${scorerId}`,
    },
  };
  const res = await fetch(API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Failed: ${res.status} ${await res.text()}`);
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  const batches = parseInt(process.argv[2] || '5', 10);
  const pauseSeconds = parseInt(process.argv[3] || '60', 10);

  console.log(`Seeding ${batches} batches with ${pauseSeconds}s pause between each...\n`);

  for (let batch = 1; batch <= batches; batch++) {
    const scoresPerScorer = 3 + Math.floor(Math.random() * 4); // 3-6 per scorer per batch
    let batchCount = 0;

    for (const scorer of SCORERS) {
      for (let i = 0; i < scoresPerScorer; i++) {
        await createScore(scorer.id, randomScore(scorer.baseScore, scorer.variance));
        batchCount++;
      }
    }

    const now = new Date().toLocaleTimeString();
    console.log(`  Batch ${batch}/${batches}: created ${batchCount} scores at ${now}`);

    if (batch < batches) {
      console.log(`  Waiting ${pauseSeconds}s...`);
      await sleep(pauseSeconds * 1000);
    }
  }

  // Verify
  const res = await fetch(`${API}?perPage=1`);
  const data = await res.json();
  console.log(`\nDone! Total scores in store: ${data.pagination.total}`);
}

main().catch(console.error);
