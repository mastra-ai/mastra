/**
 * Seed script that creates experiments, datasets, and scores via the HTTP API.
 *
 * Creates a realistic mix of completed, failed, and running experiments.
 * All interactions go through the running dev server's API.
 *
 * Usage:  MASTRA_URL=http://localhost:4112 npx tsx examples/agent/src/seed-experiments-direct.ts
 */

const MASTRA_URL = process.env.MASTRA_URL || 'http://localhost:4112';
const API = `${MASTRA_URL}/api`;

async function apiGet(path: string) {
  const r = await fetch(`${API}${path}`);
  if (!r.ok) throw new Error(`GET ${path} → ${r.status}`);
  return r.json();
}

async function apiPost(path: string, body: unknown) {
  const r = await fetch(`${API}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!r.ok) {
    const txt = await r.text().catch(() => '');
    throw new Error(`POST ${path} → ${r.status}: ${txt.slice(0, 300)}`);
  }
  return r.json();
}

async function apiPut(path: string, body: unknown) {
  const r = await fetch(`${API}${path}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!r.ok) {
    const txt = await r.text().catch(() => '');
    throw new Error(`PUT ${path} → ${r.status}: ${txt.slice(0, 300)}`);
  }
  return r.json();
}

function randomBetween(min: number, max: number) {
  return Math.round((min + Math.random() * (max - min)) * 100) / 100;
}

function hoursAgo(h: number): Date {
  const d = new Date();
  d.setTime(d.getTime() - h * 60 * 60 * 1000);
  d.setMinutes(Math.floor(Math.random() * 60));
  return d;
}

const AGENTS = ['chefAgent', 'evalAgent', 'dynamicAgent'];

const SCORER_IDS = [
  'answer-relevancy-scorer',
  'accuracy-scorer',
  'coherence-scorer',
  'helpfulness-scorer',
  'conciseness-scorer',
  'safety-scorer',
];

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
  const jitter = (Math.random() + Math.random() + Math.random()) / 3 - 0.5;
  const val = profile.meanScore + jitter * profile.spread * 2;
  return Math.round(Math.max(0, Math.min(1, val)) * 100) / 100;
}

// --------------------------------------------------------------------------
// Dataset definitions (for fresh environments only)
// --------------------------------------------------------------------------

const DATASET_DEFS = [
  {
    name: 'Customer Support QA',
    description: 'Customer support Q&A test cases',
    items: [
      {
        input: { messages: [{ role: 'user', content: 'How do I reset my password?' }] },
        groundTruth: { expected: 'Go to settings and click Reset Password.' },
      },
      {
        input: { messages: [{ role: 'user', content: 'What are your business hours?' }] },
        groundTruth: { expected: 'We are open Mon-Fri 9am-5pm.' },
      },
      {
        input: { messages: [{ role: 'user', content: 'Can I get a refund?' }] },
        groundTruth: { expected: 'Refunds available within 30 days.' },
      },
      {
        input: { messages: [{ role: 'user', content: 'How to contact support?' }] },
        groundTruth: { expected: 'Email us at support@example.com.' },
      },
      {
        input: { messages: [{ role: 'user', content: 'Where is my order?' }] },
        groundTruth: { expected: 'Check your email for tracking info.' },
      },
    ],
  },
  {
    name: 'Recipe Generation',
    description: 'Test recipe generation quality',
    items: [
      {
        input: { messages: [{ role: 'user', content: 'Give me a pasta recipe with chicken.' }] },
        groundTruth: { expected: 'A chicken pasta recipe with ingredients and steps.' },
      },
      {
        input: { messages: [{ role: 'user', content: 'What can I make with eggs and cheese?' }] },
        groundTruth: { expected: 'An omelette or frittata recipe.' },
      },
      {
        input: { messages: [{ role: 'user', content: 'Suggest a quick dessert.' }] },
        groundTruth: { expected: 'A simple dessert recipe.' },
      },
      {
        input: { messages: [{ role: 'user', content: 'How to make sourdough bread?' }] },
        groundTruth: { expected: 'Sourdough bread recipe with starter instructions.' },
      },
    ],
  },
  {
    name: 'Sentiment Analysis',
    description: 'Test sentiment classification accuracy',
    items: [
      {
        input: { messages: [{ role: 'user', content: 'This product is amazing!' }] },
        groundTruth: { sentiment: 'positive' },
      },
      {
        input: { messages: [{ role: 'user', content: 'Terrible experience, never again.' }] },
        groundTruth: { sentiment: 'negative' },
      },
      {
        input: { messages: [{ role: 'user', content: 'It was okay, nothing special.' }] },
        groundTruth: { sentiment: 'neutral' },
      },
    ],
  },
  {
    name: 'Math Problem Solving',
    description: 'Test mathematical reasoning',
    items: [
      { input: { messages: [{ role: 'user', content: 'What is 15% of 200?' }] }, groundTruth: { answer: '30' } },
      { input: { messages: [{ role: 'user', content: 'Solve: 2x + 5 = 15' }] }, groundTruth: { answer: 'x = 5' } },
      {
        input: { messages: [{ role: 'user', content: 'What is the area of a circle with radius 7?' }] },
        groundTruth: { answer: '153.94' },
      },
    ],
  },
  {
    name: 'Translation Quality',
    description: 'Test translation accuracy',
    items: [
      {
        input: { messages: [{ role: 'user', content: 'Translate "Hello world" to Spanish.' }] },
        groundTruth: { expected: 'Hola mundo' },
      },
      {
        input: { messages: [{ role: 'user', content: 'Translate "Thank you" to Japanese.' }] },
        groundTruth: { expected: 'ありがとう' },
      },
    ],
  },
  {
    name: 'Code Review',
    description: 'Test code review quality',
    items: [
      {
        input: { messages: [{ role: 'user', content: 'Review this function: function add(a,b) { return a+b }' }] },
        groundTruth: { expected: 'Missing types, no error handling.' },
      },
      {
        input: {
          messages: [
            { role: 'user', content: 'Is this SQL safe? SELECT * FROM users WHERE id = ' + "'" + '${userId}' + "'" },
          ],
        },
        groundTruth: { expected: 'SQL injection vulnerability.' },
      },
    ],
  },
];

async function seed() {
  console.log(`🌱 Seeding evaluation data via ${API}...\n`);

  // ---- Step 1: Ensure datasets exist ----
  console.log('📦 Checking datasets...');
  let datasets: any[];
  try {
    const resp = await apiGet('/datasets');
    datasets = resp.datasets || [];
  } catch {
    datasets = [];
  }
  console.log(`  Found ${datasets.length} existing datasets`);

  if (datasets.length < 3) {
    console.log('  Creating datasets...');
    for (const def of DATASET_DEFS) {
      try {
        const ds = await apiPost('/datasets', { name: def.name, description: def.description });
        const dsId = ds.id || ds.dataset?.id;
        if (dsId && def.items.length) {
          await apiPost(`/datasets/${dsId}/items/batch`, { items: def.items });
          console.log(`    ✅ ${def.name} (${def.items.length} items)`);
        }
      } catch (e: any) {
        console.log(`    ⚠️  ${def.name}: ${e.message.slice(0, 80)}`);
      }
    }
    // Re-fetch
    const resp = await apiGet('/datasets');
    datasets = resp.datasets || [];
  }
  console.log(`  Total datasets: ${datasets.length}\n`);

  // ---- Step 2: Get existing experiments and update failed/pending ones ----
  console.log('🔄 Checking existing experiments...');
  let allExperiments: any[] = [];
  for (const ds of datasets) {
    try {
      const resp = await apiGet(`/datasets/${ds.id}/experiments`);
      const exps = resp.experiments || [];
      allExperiments.push(...exps);
    } catch {}
  }
  console.log(`  Found ${allExperiments.length} existing experiments`);

  // We can't update experiment statuses via the API, so we'll trigger new ones
  // and let them run/fail naturally. The key thing is to have variety.

  // ---- Step 3: Trigger experiments on datasets that don't have many ----
  console.log('\n🧪 Triggering experiments...');
  const experimentTargets = [
    { dsIdx: 0, agent: 'chefAgent' },
    { dsIdx: 0, agent: 'evalAgent' },
    { dsIdx: 1, agent: 'chefAgent' },
    { dsIdx: 1, agent: 'evalAgent' },
    { dsIdx: 2, agent: 'evalAgent' },
    { dsIdx: 2, agent: 'dynamicAgent' },
    { dsIdx: 3, agent: 'evalAgent' },
    { dsIdx: 3, agent: 'chefAgent' },
    { dsIdx: 4, agent: 'chefAgent' },
    { dsIdx: 5, agent: 'dynamicAgent' },
  ];

  let triggered = 0;
  for (const target of experimentTargets) {
    if (target.dsIdx >= datasets.length) continue;
    const ds = datasets[target.dsIdx];

    // Check how many experiments this dataset already has
    const dsExps = allExperiments.filter((e: any) => e.datasetId === ds.id);
    if (dsExps.length >= 4) {
      console.log(`  ⏭️  ${ds.name}: already has ${dsExps.length} experiments`);
      continue;
    }

    try {
      const result = await apiPost(`/datasets/${ds.id}/experiments`, {
        targetType: 'agent',
        targetId: target.agent,
      });
      triggered++;
      const expId = result.experimentId || result.id || '?';
      console.log(`  ✅ ${ds.name} → ${target.agent} — ${String(expId).slice(0, 8)}`);
    } catch (e: any) {
      console.log(`  ⚠️  ${ds.name} → ${target.agent}: ${e.message.slice(0, 80)}`);
    }
  }
  console.log(`  Triggered ${triggered} experiments\n`);

  // ---- Step 4: Create a large volume of scores spread over 7 days ----
  console.log('📈 Creating scores over 7 days...');
  const SCORES_PER_SCORER = 80;
  let totalScores = 0;
  let failedScores = 0;

  for (const scorerId of SCORER_IDS) {
    let ok = 0;
    for (let i = 0; i < SCORES_PER_SCORER; i++) {
      const entityId = AGENTS[Math.floor(Math.random() * AGENTS.length)];
      const score = scorerScore(scorerId);
      const ageHours = Math.random() * 168;
      const createdAt = hoursAgo(ageHours).toISOString();

      try {
        await apiPost('/scores', {
          score: {
            scorerId,
            entityId,
            entityType: 'AGENT',
            runId: `seed-v3-${scorerId}-${i}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            input: JSON.stringify({ query: `Test query ${i}` }),
            output: JSON.stringify({ response: `Response ${i}` }),
            score,
            reason: score > 0.8 ? 'High quality response' : score > 0.5 ? 'Acceptable response' : 'Needs improvement',
            source: Math.random() > 0.3 ? 'LIVE' : 'TEST',
            scorer: { id: scorerId, name: scorerId },
            entity: { id: entityId, name: entityId },
            createdAt,
            updatedAt: createdAt,
          },
        });
        totalScores++;
        ok++;
      } catch {
        failedScores++;
      }
    }
    console.log(`  ✅ ${scorerId}: ${ok}/${SCORES_PER_SCORER} scores`);
  }

  console.log(`\n  Total new scores: ${totalScores} (${failedScores} failed)`);

  // ---- Summary ----
  console.log('\n📊 Summary:');
  console.log(`  Datasets: ${datasets.length}`);
  console.log(`  Experiments triggered: ${triggered}`);
  console.log(`  Scores created: ${totalScores}`);
  console.log('\n✅ Done!');
}

seed().catch(err => {
  console.error('❌ Seed failed:', err);
  process.exit(1);
});
