/**
 * Generates a large volume of additional scorer runs and dataset experiments.
 *
 * Assumes the base seed has already run (datasets + scorers exist).
 *
 * Usage:  MASTRA_URL=http://localhost:4112 npx tsx examples/agent/src/seed-more-scores.ts
 */

const BASE = process.env.MASTRA_URL ?? 'http://localhost:4111';
const API = `${BASE}/api`;

async function api<T = unknown>(path: string, opts: { method?: string; body?: unknown } = {}): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    method: opts.method ?? (opts.body ? 'POST' : 'GET'),
    headers: { 'Content-Type': 'application/json' },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${res.status} ${path}: ${text.slice(0, 200)}`);
  }
  return res.json() as Promise<T>;
}

function randomBetween(min: number, max: number) {
  return Math.round((min + Math.random() * (max - min)) * 100) / 100;
}

// ---------------------------------------------------------------------------
// Score generation config
// ---------------------------------------------------------------------------

const SCORER_IDS = [
  'answer-relevancy-scorer',
  'accuracy-scorer',
  'coherence-scorer',
  'helpfulness-scorer',
  'conciseness-scorer',
  'safety-scorer',
];

const AGENTS = ['chefAgent', 'evalAgent', 'dynamicAgent'];
const WORKFLOWS = ['recipe-workflow', 'support-workflow'];

// Give each scorer a slightly different score distribution
const SCORER_PROFILES: Record<string, { meanScore: number; spread: number }> = {
  'answer-relevancy-scorer': { meanScore: 0.78, spread: 0.2 },
  'accuracy-scorer': { meanScore: 0.85, spread: 0.15 },
  'coherence-scorer': { meanScore: 0.72, spread: 0.25 },
  'helpfulness-scorer': { meanScore: 0.81, spread: 0.18 },
  'conciseness-scorer': { meanScore: 0.65, spread: 0.3 },
  'safety-scorer': { meanScore: 0.92, spread: 0.08 },
};

function scorerScore(scorerId: string): number {
  const profile = SCORER_PROFILES[scorerId] ?? { meanScore: 0.75, spread: 0.2 };
  // Normal-ish distribution around the mean
  const jitter = (Math.random() + Math.random() + Math.random()) / 3 - 0.5;
  const val = profile.meanScore + jitter * profile.spread * 2;
  return Math.round(Math.max(0, Math.min(1, val)) * 100) / 100;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function seed() {
  console.log('🌱 Generating bulk scores and experiments...\n');

  // 1) Fetch existing datasets
  let datasets: Array<{ id: string; name: string }> = [];
  try {
    const resp = await api<{ datasets: Array<{ id: string; name: string }> }>('/datasets');
    datasets = resp.datasets;
    console.log(`📦 Found ${datasets.length} datasets`);
  } catch {
    console.log('⚠️  Could not fetch datasets — skipping experiments');
  }

  // 2) Trigger more experiments across all datasets
  console.log('\n🧪 Triggering experiments on all datasets...');
  const experimentTargets = [
    { targetType: 'agent', targetId: 'chefAgent' },
    { targetType: 'agent', targetId: 'evalAgent' },
    { targetType: 'agent', targetId: 'dynamicAgent' },
  ];

  let expCount = 0;
  for (const ds of datasets) {
    // 2-4 experiments per dataset
    const numExps = 2 + Math.floor(Math.random() * 3);
    for (let i = 0; i < numExps; i++) {
      const target = experimentTargets[Math.floor(Math.random() * experimentTargets.length)];
      try {
        const resp = await api<{ experimentId: string }>(`/datasets/${ds.id}/experiments`, {
          body: { targetType: target.targetType, targetId: target.targetId },
        });
        expCount++;
        console.log(`  ✅ "${ds.name}" → ${target.targetId} (${resp.experimentId.slice(0, 8)})`);
      } catch (e: any) {
        console.log(`  ⚠️  "${ds.name}": ${e.message.slice(0, 100)}`);
      }
    }
  }
  console.log(`  Total experiments triggered: ${expCount}`);

  // 3) Generate a large number of scores spread over the last 7 days
  console.log('\n📈 Creating scores (spread over last 7 days)...');

  // We'll create scores for different time periods to make the over-time chart interesting
  const SCORES_PER_SCORER = 80; // 80 scores each = ~480 total new scores

  let totalSaved = 0;
  const batchSize = 10; // parallel batch size

  for (const scorerId of SCORER_IDS) {
    let saved = 0;
    const promises: Promise<void>[] = [];

    for (let i = 0; i < SCORES_PER_SCORER; i++) {
      const isAgent = Math.random() > 0.2;
      const entityId = isAgent
        ? AGENTS[Math.floor(Math.random() * AGENTS.length)]
        : WORKFLOWS[Math.floor(Math.random() * WORKFLOWS.length)];
      const entityType = isAgent ? 'AGENT' : 'WORKFLOW';
      const score = scorerScore(scorerId);
      const source = Math.random() > 0.3 ? 'LIVE' : 'TEST';

      const p = api('/scores', {
        body: {
          score: {
            scorerId,
            entityId,
            runId: `bulk-${scorerId}-${i}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            input: JSON.stringify({ query: `Bulk test query ${i}`, context: `Context for scorer ${scorerId}` }),
            output: JSON.stringify({ response: `Generated response ${i}`, confidence: score }),
            score,
            reason:
              score > 0.85
                ? 'Excellent quality'
                : score > 0.7
                  ? 'Good quality response'
                  : score > 0.5
                    ? 'Acceptable but could improve'
                    : 'Below threshold — needs improvement',
            scorer: { id: scorerId, name: scorerId },
            entity: { id: entityId, name: entityId },
            entityType,
            source,
          },
        },
      })
        .then(() => {
          saved++;
        })
        .catch(() => {});

      promises.push(p);

      // Flush in batches to avoid overwhelming the server
      if (promises.length >= batchSize) {
        await Promise.all(promises);
        promises.length = 0;
      }
    }

    // Flush remaining
    if (promises.length > 0) {
      await Promise.all(promises);
    }

    totalSaved += saved;
    console.log(`  ✅ ${scorerId}: ${saved}/${SCORES_PER_SCORER} scores`);
  }

  // 4) Summary
  console.log('\n✨ Bulk seed complete!');
  console.log(`   New experiments triggered: ${expCount}`);
  console.log(`   New score records:         ${totalSaved}`);
  console.log('\n   Refresh /evaluation in the playground to see the data.');
}

seed().catch(err => {
  console.error('❌ Seed failed:', err);
  process.exit(1);
});
