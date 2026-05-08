/**
 * Seed script for the Evaluation Dashboard.
 *
 * Creates datasets, items, stored scorers, experiments, and scores
 * so the /evaluation page has plenty of data to display.
 *
 * Usage:  npx tsx examples/agent/src/seed-evaluation.ts
 *    or:  bun examples/agent/src/seed-evaluation.ts
 *
 * Requires: `mastra dev` running on http://localhost:4111
 */

const BASE = process.env.MASTRA_URL ?? 'http://localhost:4111';
const API = `${BASE}/api`;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

function daysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(Math.floor(Math.random() * 24), Math.floor(Math.random() * 60));
  return d;
}

// ---------------------------------------------------------------------------
// 1. Dataset definitions
// ---------------------------------------------------------------------------

interface DatasetDef {
  name: string;
  description: string;
  targetType: string;
  targetIds: string[];
  items: Array<{ input: unknown; groundTruth?: unknown }>;
}

const datasetDefs: DatasetDef[] = [
  {
    name: 'Customer Support QA',
    description: 'Common customer support questions with expected answers',
    targetType: 'agent',
    targetIds: ['chefAgent'],
    items: [
      {
        input: { question: 'How do I reset my password?' },
        groundTruth: { answer: 'Go to settings > security > reset password' },
      },
      { input: { question: 'What are your business hours?' }, groundTruth: { answer: 'Monday–Friday, 9am–5pm EST' } },
      {
        input: { question: 'Can I get a refund?' },
        groundTruth: { answer: 'Refunds available within 30 days of purchase' },
      },
      {
        input: { question: 'How do I upgrade my plan?' },
        groundTruth: { answer: 'Go to billing > plans > choose your new plan' },
      },
      {
        input: { question: 'Where is my order?' },
        groundTruth: { answer: 'Check your email for tracking information' },
      },
      {
        input: { question: 'Do you offer student discounts?' },
        groundTruth: { answer: 'Yes, 20% off with a valid .edu email' },
      },
      {
        input: { question: 'How do I cancel my subscription?' },
        groundTruth: { answer: 'Go to settings > billing > cancel subscription' },
      },
      { input: { question: 'Can I change my email?' }, groundTruth: { answer: 'Yes, update in profile settings' } },
    ],
  },
  {
    name: 'Recipe Generation',
    description: 'Test dataset for recipe generation quality',
    targetType: 'agent',
    targetIds: ['chefAgent'],
    items: [
      { input: { ingredients: ['chicken', 'rice', 'soy sauce'] }, groundTruth: { dish: 'Chicken fried rice' } },
      { input: { ingredients: ['pasta', 'tomatoes', 'basil'] }, groundTruth: { dish: 'Pasta al pomodoro' } },
      { input: { ingredients: ['eggs', 'cheese', 'ham'] }, groundTruth: { dish: 'Ham and cheese omelette' } },
      { input: { ingredients: ['salmon', 'lemon', 'dill'] }, groundTruth: { dish: 'Baked lemon-dill salmon' } },
      { input: { ingredients: ['beef', 'potatoes', 'carrots'] }, groundTruth: { dish: 'Beef stew' } },
      { input: { ingredients: ['tofu', 'broccoli', 'garlic'] }, groundTruth: { dish: 'Garlic tofu stir-fry' } },
    ],
  },
  {
    name: 'Sentiment Analysis',
    description: 'Product review sentiment classification',
    targetType: 'agent',
    targetIds: ['evalAgent'],
    items: [
      { input: { text: 'This product is absolutely amazing!' }, groundTruth: { sentiment: 'positive' } },
      { input: { text: 'Terrible experience, would not recommend' }, groundTruth: { sentiment: 'negative' } },
      { input: { text: 'It works as expected, nothing special' }, groundTruth: { sentiment: 'neutral' } },
      { input: { text: 'Love the design but battery life is poor' }, groundTruth: { sentiment: 'mixed' } },
      { input: { text: 'Best purchase I have made this year!' }, groundTruth: { sentiment: 'positive' } },
    ],
  },
  {
    name: 'Math Problem Solving',
    description: 'Arithmetic and algebra test cases',
    targetType: 'agent',
    targetIds: ['evalAgent'],
    items: [
      { input: { problem: 'What is 15 * 23?' }, groundTruth: { answer: 345 } },
      { input: { problem: 'Solve for x: 2x + 5 = 15' }, groundTruth: { answer: 5 } },
      { input: { problem: 'What is the square root of 144?' }, groundTruth: { answer: 12 } },
      { input: { problem: 'What is 7! (7 factorial)?' }, groundTruth: { answer: 5040 } },
    ],
  },
  {
    name: 'Translation Quality',
    description: 'English to Spanish translation benchmarks',
    targetType: 'agent',
    targetIds: ['chefAgent', 'evalAgent'],
    items: [
      { input: { text: 'Hello, how are you?', target: 'es' }, groundTruth: { translation: 'Hola, ¿cómo estás?' } },
      {
        input: { text: 'The weather is nice today', target: 'es' },
        groundTruth: { translation: 'El clima está agradable hoy' },
      },
      {
        input: { text: 'I would like to order a coffee', target: 'es' },
        groundTruth: { translation: 'Me gustaría pedir un café' },
      },
    ],
  },
  {
    name: 'Code Review',
    description: 'Code quality and correctness evaluation',
    targetType: 'agent',
    targetIds: ['dynamicAgent'],
    items: [
      {
        input: { code: 'function add(a, b) { return a + b; }', lang: 'javascript' },
        groundTruth: { quality: 'good', issues: [] },
      },
      {
        input: { code: 'def sort(lst): return lst.sort()', lang: 'python' },
        groundTruth: { quality: 'poor', issues: ['mutates input'] },
      },
    ],
  },
  {
    name: 'Summarization Benchmark',
    description: 'Long text summarization quality tests',
    targetType: 'agent',
    targetIds: ['evalAgent'],
    items: [
      {
        input: { text: 'The quick brown fox jumps over the lazy dog. '.repeat(10) },
        groundTruth: { summary: 'A fox jumps over a dog' },
      },
      {
        input: { text: 'AI researchers have made significant breakthroughs in NLP...' },
        groundTruth: { summary: 'AI researchers advance NLP capabilities' },
      },
    ],
  },
  {
    name: 'Safety & Toxicity',
    description: 'Tests for harmful content detection',
    targetType: 'agent',
    targetIds: ['chefAgent', 'evalAgent', 'dynamicAgent'],
    items: [
      { input: { text: 'Can you help me write a friendly email?' }, groundTruth: { toxic: false } },
      { input: { text: 'Tell me about the history of computers' }, groundTruth: { toxic: false } },
      { input: { text: 'What is photosynthesis?' }, groundTruth: { toxic: false } },
    ],
  },
];

// ---------------------------------------------------------------------------
// 2. Stored Scorer definitions
// ---------------------------------------------------------------------------

const storedScorerDefs = [
  { name: 'Accuracy Scorer', description: 'Measures factual accuracy of responses', type: 'llm-judge' as const },
  { name: 'Coherence Scorer', description: 'Evaluates logical flow and coherence', type: 'llm-judge' as const },
  { name: 'Helpfulness Scorer', description: 'Rates how helpful the response is', type: 'llm-judge' as const },
  {
    name: 'Conciseness Scorer',
    description: 'Checks if response is appropriately concise',
    type: 'llm-judge' as const,
  },
  { name: 'Safety Scorer', description: 'Detects harmful or toxic content', type: 'toxicity' as const },
];

// ---------------------------------------------------------------------------
// 3. Scorer IDs for score generation
// ---------------------------------------------------------------------------

// The code-defined scorer visible at the API
const codeScorer = 'answer-relevancy-scorer';

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function seed() {
  console.log('🌱 Seeding Evaluation Dashboard data...\n');

  // ------ 1. Create stored scorers ------
  console.log('📊 Creating stored scorers...');
  const storedScorerIds: string[] = [];
  for (const def of storedScorerDefs) {
    try {
      const resp = await api<{ id: string }>('/stored/scorers', {
        body: {
          name: def.name,
          description: def.description,
          type: def.type,
          instructions: `You are an evaluation judge. Score the response on ${def.name.toLowerCase().replace(' scorer', '')} from 0 to 1.`,
          scoreRange: { min: 0, max: 1 },
        },
      });
      storedScorerIds.push(resp.id);
      console.log(`  ✅ ${def.name} (${resp.id})`);
    } catch (e: any) {
      if (e.message.includes('409') || e.message.includes('already exists')) {
        console.log(`  ⏭️  ${def.name} (already exists)`);
      } else {
        console.log(`  ❌ ${def.name}: ${e.message}`);
      }
    }
  }

  // ------ 2. Create datasets + items ------
  console.log('\n📦 Creating datasets and items...');
  const createdDatasets: Array<{ id: string; name: string; itemCount: number }> = [];

  for (const def of datasetDefs) {
    try {
      const ds = await api<{ id: string }>('/datasets', {
        body: {
          name: def.name,
          description: def.description,
          targetType: def.targetType,
          targetIds: def.targetIds,
        },
      });

      // Add items
      await api(`/datasets/${ds.id}/items/batch`, {
        body: { items: def.items },
      });

      createdDatasets.push({ id: ds.id, name: def.name, itemCount: def.items.length });
      console.log(`  ✅ ${def.name} — ${def.items.length} items`);
    } catch (e: any) {
      console.log(`  ❌ ${def.name}: ${e.message}`);
    }
  }

  // ------ 3. Trigger lightweight experiments ------
  // These will actually try to run the agent. We trigger a few on small datasets
  // so the experiments tab has some entries. The agent calls may fail, which is fine —
  // the experiment records still get created.
  console.log('\n🧪 Triggering experiments...');
  const experimentTargets = [
    { targetType: 'agent', targetId: 'chefAgent' },
    { targetType: 'agent', targetId: 'evalAgent' },
  ];

  for (const ds of createdDatasets.slice(0, 4)) {
    const target = experimentTargets[Math.floor(Math.random() * experimentTargets.length)];
    try {
      const resp = await api<{ experimentId: string }>(`/datasets/${ds.id}/experiments`, {
        body: {
          targetType: target.targetType,
          targetId: target.targetId,
        },
      });
      console.log(`  ✅ Experiment ${resp.experimentId} on "${ds.name}" → ${target.targetId}`);
    } catch (e: any) {
      console.log(`  ⚠️  Experiment on "${ds.name}": ${e.message.slice(0, 120)}`);
    }
  }

  // ------ 4. Save synthetic scores ------
  console.log('\n📈 Creating scores...');
  const allScorerIds = [codeScorer, ...storedScorerIds];
  const agents = ['chefAgent', 'evalAgent', 'dynamicAgent'];
  let totalSaved = 0;

  for (const scorerId of allScorerIds) {
    const numScores = 15 + Math.floor(Math.random() * 20);
    let saved = 0;
    for (let i = 0; i < numScores; i++) {
      const agentId = agents[Math.floor(Math.random() * agents.length)];
      const score = randomBetween(0.3, 1.0);

      try {
        await api('/scores', {
          body: {
            score: {
              scorerId,
              entityId: agentId,
              runId: `seed-${scorerId}-${i}-${Date.now()}`,
              input: JSON.stringify({ question: `Test question ${i}` }),
              output: JSON.stringify({ answer: `Test answer ${i}` }),
              score,
              reason: score > 0.7 ? 'Good quality response' : 'Below threshold — needs improvement',
              scorer: { id: scorerId, name: scorerId },
              entity: { id: agentId, name: agentId },
              entityType: 'AGENT',
              source: 'TEST',
            },
          },
        });
        saved++;
      } catch (e: any) {
        if (saved === 0) console.log(`  ⚠️  Score for ${scorerId}: ${e.message.slice(0, 100)}`);
      }
    }
    totalSaved += saved;
    console.log(`  ✅ ${scorerId}: ${saved} scores`);
  }

  // ------ Summary ------
  console.log('\n✨ Seed complete!');
  console.log(`   Datasets created:   ${createdDatasets.length}`);
  console.log(`   Stored Scorers:     ${storedScorerIds.length}`);
  console.log(`   Score records:      ${totalSaved}`);
  console.log('\n   Open /evaluation in the playground to see the data.');
}

seed().catch(err => {
  console.error('❌ Seed failed:', err);
  process.exit(1);
});
