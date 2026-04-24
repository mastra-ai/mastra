/**
 * Seeds experiment results with review statuses (needs-review, complete)
 * and tags to populate the Evaluation dashboard's review features.
 *
 * Run: npx tsx src/seed-review-statuses.ts
 */

const BASE = 'http://localhost:4111/api';

async function patchResult(
  datasetId: string,
  experimentId: string,
  resultId: string,
  body: { status: string; tags?: string[] },
) {
  const res = await fetch(`${BASE}/datasets/${datasetId}/experiments/${experimentId}/results/${resultId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    console.error(`  PATCH failed for ${resultId}: ${res.status} ${text}`);
    return null;
  }
  return res.json();
}

async function updateDatasetTags(datasetId: string, tags: string[]) {
  const res = await fetch(`${BASE}/datasets/${datasetId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tags }),
  });
  if (!res.ok) {
    const text = await res.text();
    console.error(`  PATCH dataset failed for ${datasetId}: ${res.status} ${text}`);
    return null;
  }
  return res.json();
}

async function main() {
  console.log('Seeding review statuses and tags...\n');

  // ─── Dataset: Customer Support QA (236b9ce6) ───
  const csDatasetId = '236b9ce6-6788-4bd5-8257-fbb10b2ff9bf';
  const csTags = ['hallucination', 'off-topic', 'incomplete-answer', 'tone-issue', 'factually-correct'];

  console.log('1. Updating Customer Support QA dataset tags...');
  await updateDatasetTags(csDatasetId, csTags);

  // Experiment: 164b33a0 (dynamicAgent, completed, 8 items)
  // Mark 3 as needs-review, 2 as complete, 3 remain null
  console.log('2. Updating experiment 164b33a0 (dynamicAgent)...');
  const exp164_ds = csDatasetId;
  const exp164 = '164b33a0-e1b1-4af0-a564-408337b200a0';
  // Already patched first one above, but let's re-patch for consistency
  await patchResult(exp164_ds, exp164, '95864063-f750-4ec9-a3eb-dc65b5cb43f4', {
    status: 'needs-review',
    tags: ['hallucination'],
  });
  await patchResult(exp164_ds, exp164, 'e2c7c227-e6d0-4a57-a011-6768dbc187e6', {
    status: 'needs-review',
    tags: ['off-topic'],
  });
  await patchResult(exp164_ds, exp164, '67fb0c55-96e5-42fb-b99f-6947b4bb0a0f', {
    status: 'needs-review',
    tags: ['incomplete-answer'],
  });
  await patchResult(exp164_ds, exp164, '3211dffc-1965-4871-bc09-e6329bfcfa59', {
    status: 'complete',
    tags: ['factually-correct'],
  });
  await patchResult(exp164_ds, exp164, '7531dbca-4f78-4ce4-bb2d-4bdee1d990b0', {
    status: 'complete',
    tags: ['factually-correct'],
  });
  console.log('   → 3 needs-review, 2 complete, 3 null');

  // Experiment: 7161d3de (evalAgent, completed, 8 items)
  // Mark 2 as needs-review, 4 as complete, 2 remain null
  console.log('3. Updating experiment 7161d3de (evalAgent)...');
  const exp716 = '7161d3de-617c-4af2-8a1e-5e7cff971ff5';
  await patchResult(csDatasetId, exp716, 'c48588f2-7ab0-4571-8154-9a5f501ba2d7', {
    status: 'needs-review',
    tags: ['tone-issue'],
  });
  await patchResult(csDatasetId, exp716, 'd691a452-c3a2-4ceb-a2bb-6a4f8bb74ec3', {
    status: 'needs-review',
    tags: ['hallucination', 'off-topic'],
  });
  await patchResult(csDatasetId, exp716, '4cb965e5-af50-401b-b462-7d04d52323f0', {
    status: 'complete',
    tags: ['factually-correct'],
  });
  await patchResult(csDatasetId, exp716, '19b3b751-4531-4937-ae47-81bf68d3d5f3', {
    status: 'complete',
    tags: ['factually-correct'],
  });
  await patchResult(csDatasetId, exp716, '2467bbd3-a597-4e45-af72-fca47fff5d9f', {
    status: 'complete',
    tags: [],
  });
  await patchResult(csDatasetId, exp716, '43370459-e83b-4c17-a1d4-92b681370062', {
    status: 'complete',
    tags: [],
  });
  console.log('   → 2 needs-review, 4 complete, 2 null');

  // Experiment: 3a35e49e (dynamicAgent, completed, 8 items)
  // Mark 1 as needs-review, 5 as complete, 2 remain null
  console.log('4. Updating experiment 3a35e49e (dynamicAgent)...');
  const exp3a3_ds = csDatasetId;
  const exp3a3 = '3a35e49e-19e9-405e-99ab-a5b354f26d1c';
  const exp3a3Res = await fetch(`${BASE}/datasets/${exp3a3_ds}/experiments/${exp3a3}/results`);
  const exp3a3Data = await exp3a3Res.json();
  const exp3a3Results = exp3a3Data.results || [];
  if (exp3a3Results.length >= 6) {
    await patchResult(exp3a3_ds, exp3a3, exp3a3Results[0].id, {
      status: 'needs-review',
      tags: ['incomplete-answer'],
    });
    await patchResult(exp3a3_ds, exp3a3, exp3a3Results[1].id, {
      status: 'complete',
      tags: ['factually-correct'],
    });
    await patchResult(exp3a3_ds, exp3a3, exp3a3Results[2].id, {
      status: 'complete',
      tags: [],
    });
    await patchResult(exp3a3_ds, exp3a3, exp3a3Results[3].id, {
      status: 'complete',
      tags: ['factually-correct'],
    });
    await patchResult(exp3a3_ds, exp3a3, exp3a3Results[4].id, {
      status: 'complete',
      tags: [],
    });
    await patchResult(exp3a3_ds, exp3a3, exp3a3Results[5].id, {
      status: 'complete',
      tags: ['tone-issue'],
    });
  }
  console.log('   → 1 needs-review, 5 complete, 2 null');

  // ─── Dataset: Safety & Toxicity (fb9cb5e0) ───
  const stDatasetId = 'fb9cb5e0-e956-4fd4-a5e0-79b97b3c2226';
  const stTags = ['toxic-output', 'bias-detected', 'safe', 'borderline'];

  console.log('\n5. Updating Safety & Toxicity dataset tags...');
  await updateDatasetTags(stDatasetId, stTags);

  // Experiment: 95734da4 (evalAgent, completed, 3 items)
  // Mark 1 as needs-review, 1 as complete, 1 null
  console.log('6. Updating experiment 95734da4 (evalAgent)...');
  const exp957 = '95734da4-fe91-4fd3-92e8-e416c4068625';
  await patchResult(stDatasetId, exp957, 'e5215a53-4ee5-479b-8e88-87ebe47191c6', {
    status: 'needs-review',
    tags: ['borderline'],
  });
  await patchResult(stDatasetId, exp957, 'a3fadd71-3d0a-44e6-9605-eae4b0990434', {
    status: 'complete',
    tags: ['safe'],
  });
  console.log('   → 1 needs-review, 1 complete, 1 null');

  // ─── Dataset: Code Review (50d1d118) ───
  const crDatasetId = '50d1d118-492b-43c1-9656-b41f89cca586';
  const crTags = ['style-issue', 'bug-found', 'performance', 'correct'];

  console.log('\n7. Updating Code Review dataset tags...');
  await updateDatasetTags(crDatasetId, crTags);

  // Experiment: 42ae8f0d (evalAgent, completed, 2 items)
  // Mark both as complete (fully reviewed)
  console.log('8. Updating experiment 42ae8f0d (evalAgent)...');
  const exp42a = '42ae8f0d-02ac-438d-8f04-ee08cc34a391';
  await patchResult(crDatasetId, exp42a, 'df4f39fe-fc2f-4e09-995d-a03460f080db', {
    status: 'complete',
    tags: ['correct'],
  });
  await patchResult(crDatasetId, exp42a, 'd65543f9-2087-44b4-bb89-b3ef14f6d540', {
    status: 'complete',
    tags: ['style-issue'],
  });
  console.log('   → 0 needs-review, 2 complete (fully reviewed!)');

  // ─── Dataset: Translation Quality (433d7da8) ───
  const tqDatasetId = '433d7da8-3aea-4a83-84f7-498be0fefbb7';
  const tqTags = ['mistranslation', 'fluency-issue', 'accurate', 'context-lost'];

  console.log('\n9. Updating Translation Quality dataset tags...');
  await updateDatasetTags(tqDatasetId, tqTags);

  // Experiment: 5afa10ea (evalAgent, completed, 3 items)
  // Mark 2 as needs-review, 0 complete, 1 null
  console.log('10. Updating experiment 5afa10ea (evalAgent)...');
  const exp5af = '5afa10ea-04a8-4187-a578-300e2fcd1ca5';
  await patchResult(tqDatasetId, exp5af, 'e27ab58c-e89d-41c4-bde7-ab868ef440d8', {
    status: 'needs-review',
    tags: ['mistranslation'],
  });
  await patchResult(tqDatasetId, exp5af, '79fc2704-13df-40cb-8159-3b6e22f25bf2', {
    status: 'needs-review',
    tags: ['context-lost', 'fluency-issue'],
  });
  console.log('   → 2 needs-review, 0 complete, 1 null');

  // ─── Summary ───
  console.log('\n═══════════════════════════════════════');
  console.log('Seeding complete! Summary:');
  console.log('');
  console.log('Customer Support QA:');
  console.log('  exp 164b33a0 (dynamicAgent): 3 needs-review, 2 complete, 3 null');
  console.log('  exp 7161d3de (evalAgent):     2 needs-review, 4 complete, 2 null');
  console.log('  exp 3a35e49e (dynamicAgent):  1 needs-review, 5 complete, 2 null');
  console.log('  exp 30fe689d (chefAgent):     all null (failed experiment)');
  console.log('  → Total: 6 needs-review, 11 complete');
  console.log('');
  console.log('Safety & Toxicity:');
  console.log('  exp 95734da4 (evalAgent): 1 needs-review, 1 complete, 1 null');
  console.log('  exp 4fa1fd0f (chefAgent):  all null (failed experiment)');
  console.log('  → Total: 1 needs-review, 1 complete');
  console.log('');
  console.log('Code Review:');
  console.log('  exp 42ae8f0d (evalAgent):    0 needs-review, 2 complete (fully reviewed!)');
  console.log('  exp 87e62a20 (dynamicAgent): all null (running experiment)');
  console.log('  → Total: 0 needs-review, 2 complete');
  console.log('');
  console.log('Translation Quality:');
  console.log('  exp 5afa10ea (evalAgent): 2 needs-review, 0 complete, 1 null');
  console.log('  exp 5ba61f5c (chefAgent): all null (failed experiment)');
  console.log('  → Total: 2 needs-review, 0 complete');
  console.log('');
  console.log('Grand total: 9 needs-review, 14 complete');
  console.log('Dataset tags updated: Customer Support QA, Safety & Toxicity, Code Review, Translation Quality');
  console.log('═══════════════════════════════════════');
}

main().catch(console.error);
