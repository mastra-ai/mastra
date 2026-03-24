// Seed script: generates traces by calling the simple-assistant agent via the API,
// then creates scores for each trace.
const BASE = 'http://localhost:4112';

const prompts = [
  'What is the capital of France?',
  'Explain quantum computing in simple terms',
  'Write a haiku about programming',
  'What are the benefits of TypeScript over JavaScript?',
  'How do I make a grilled cheese sandwich?',
  'Tell me a joke about software engineers',
  'What is the difference between REST and GraphQL?',
  'Summarize the plot of Romeo and Juliet in 2 sentences',
  'What are 3 tips for better sleep?',
  'Explain the concept of recursion to a 10-year-old',
  'What is the Fibonacci sequence?',
  'How does a neural network work?',
  'What are the SOLID principles in software engineering?',
  'Write a short poem about the ocean',
  'What is the Big O notation?',
];

async function seedTrace(prompt, i) {
  try {
    const res = await fetch(`${BASE}/api/agents/simple-assistant/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [{ role: 'user', content: prompt }],
      }),
    });
    if (!res.ok) {
      const text = await res.text();
      console.error(`[${i + 1}] FAILED (${res.status}): ${text.slice(0, 200)}`);
      return;
    }
    const data = await res.json();
    const output = data?.text?.slice(0, 80) || JSON.stringify(data).slice(0, 80);
    console.log(`[${i + 1}] OK: "${prompt.slice(0, 40)}..." → ${output}...`);
  } catch (err) {
    console.error(`[${i + 1}] ERROR: ${err.message}`);
  }
}

async function fetchTraceIds(startedAfter) {
  const params = new URLSearchParams({
    page: '0',
    perPage: '50',
    entityId: 'simple-assistant',
    entityType: 'agent',
  });
  if (startedAfter) {
    params.set('startedAt', startedAfter);
  }
  const res = await fetch(`${BASE}/api/observability/traces?${params}`);
  if (!res.ok) {
    console.error(`Failed to fetch traces: ${res.status}`);
    return [];
  }
  const data = await res.json();
  const spans = data.spans;
  if (!Array.isArray(spans)) {
    console.error('Unexpected response format. Keys:', Object.keys(data));
    return [];
  }
  return spans.map(t => t.traceId).filter(Boolean);
}

async function seedScore(traceId, scorerId, score, reason) {
  try {
    const res = await fetch(`${BASE}/api/observability/scores`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        score: {
          traceId,
          scorerId,
          score,
          reason,
          source: 'manual',
        },
      }),
    });
    if (!res.ok) {
      const text = await res.text();
      console.error(`  Score FAILED for ${traceId.slice(0, 8)}: ${res.status} ${text.slice(0, 200)}`);
      return false;
    }
    return true;
  } catch (err) {
    console.error(`  Score ERROR for ${traceId.slice(0, 8)}: ${err.message}`);
    return false;
  }
}

// ── Main ──

console.log(`\n=== Seeding ${prompts.length} traces against simple-assistant ===\n`);

const runStartTime = new Date().toISOString();

for (let batch = 0; batch < prompts.length; batch += 5) {
  const slice = prompts.slice(batch, batch + 5);
  await Promise.all(slice.map((p, j) => seedTrace(p, batch + j)));
}

// Wait a moment for traces to be stored
console.log('\nWaiting 2s for traces to be persisted...');
await new Promise(r => setTimeout(r, 2000));

// Fetch only traces created during this run
const traceIds = await fetchTraceIds(runStartTime);
console.log(`\n=== Found ${traceIds.length} traces, seeding scores ===\n`);

if (traceIds.length === 0) {
  console.log('No traces found — skipping score seeding.');
} else {
  let successCount = 0;
  for (let i = 0; i < traceIds.length; i++) {
    const traceId = traceIds[i];
    // Distribute scores: some low, some mid, some high
    const scoreValue = parseFloat(Math.random().toFixed(2));
    const reasons = [
      'Excellent response with clear explanation',
      'Good but could be more detailed',
      'Acceptable but lacks depth',
      'Below expectations, missing key points',
      'Poor response, inaccurate information',
    ];
    const reason = reasons[Math.min(Math.floor((1 - scoreValue) * reasons.length), reasons.length - 1)];

    const ok = await seedScore(traceId, 'answer-relevancy-scorer', scoreValue, reason);
    if (ok) {
      successCount++;
      console.log(`  [${i + 1}] Score ${scoreValue.toFixed(2)} for trace ${traceId.slice(0, 8)}... — ${reason}`);
    }
  }
  console.log(`\n=== Done! ${successCount}/${traceIds.length} scores created ===`);
}
