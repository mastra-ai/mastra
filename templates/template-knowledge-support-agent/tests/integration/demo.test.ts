import assert from 'node:assert/strict';
import { test } from 'node:test';
import { TABLE_SCHEMAS } from '@mastra/core/storage';
import { setTimeout } from 'node:timers/promises';
import { demoCorpus } from '../fixtures/demo-corpus.ts';
import {
  assertCitations,
  confirm,
  decide,
  demoFixture,
  history,
  json,
  latest,
  pending,
  post,
  providerInput,
  read,
  sentinels,
  snapshot,
  sql,
  thread,
  turn,
} from '../fixtures/demo.ts';
import type { Fixture } from '../fixtures/demo.ts';

async function retrievalBaseline(f: Fixture, queries: readonly { query: string; expected: string }[]) {
  const ranks: number[] = [];
  for (const query of queries) {
    const result = await json(await f.request(`/knowledge/support/search?q=${encodeURIComponent(query.query)}`));
    const hits = result.results as { page?: { ref: string }; ref?: string }[];
    assert.ok(Array.isArray(hits), JSON.stringify(result));
    const expectedPage = await read(f, query.expected);
    const expectedId = (expectedPage.page ?? expectedPage).id;
    assert.equal(typeof expectedId, 'string');
    const rank = hits.findIndex(hit => (hit.page as { id?: string } | undefined)?.id === expectedId) + 1;
    assert.ok(
      rank >= 1 && rank <= 5,
      `${query.query}: ${query.expected} must be in the top five, got ${JSON.stringify(result)}`,
    );
    ranks.push(rank);
    assert.doesNotMatch(JSON.stringify(result), /RETAILOPS_STORE73|FIELDRETAIL_STORE42/u);
  }
  return ranks;
}
async function approveLifecycle(f: Fixture, source: Awaited<ReturnType<typeof confirm>>) {
  const before = await snapshot(f);
  const rejected = await pending(f, source, f.candidate('rejected-proposal'));
  assert.deepEqual(await snapshot(f), before, 'A suspended proposal cannot publish');
  assert.equal((await decide(f, rejected, 'reject')).result.status, 'rejected');
  assert.deepEqual(await snapshot(f), before, 'Rejection cannot change Knowledge');
  const privateRun = await pending(f, source, f.candidate('private-approved'));
  assert.deepEqual(await snapshot(f), before, 'A private proposal still needs its own decision');
  const privateResult = await decide(f, privateRun);
  assert.equal(privateResult.result.status, 'published');
  const privateRef = privateResult.result.reference as string;
  const privateBody = JSON.stringify(await read(f, privateRef));
  assert.ok(privateBody.includes(source.threadId) && privateBody.includes(source.messageId));
  const beforeShared = await snapshot(f);
  const sharedRun = await pending(f, { ...source, audience: 'tenant' }, f.candidate('tenant-approved', true));
  assert.deepEqual(await snapshot(f), beforeShared, 'Private approval cannot authorize tenant publication');
  const sharedResult = await decide(f, sharedRun);
  assert.equal(sharedResult.result.status, 'published');
  const sharedRef = sharedResult.result.reference as string;
  const sharedBody = JSON.stringify(await read(f, sharedRef));
  assert.ok(sharedBody.includes(f.guide));
  for (const forbidden of [
    source.threadId,
    source.messageId,
    source.sourceActorId,
    'Source technician:',
    'Confirmed in thread:',
    'customer:',
  ])
    assert.ok(!sharedBody.includes(forbidden), `Shared content contains ${forbidden}`);
  f.reuse(sharedRef);
  return { privateRef, sharedRef, privateRun, sharedRun };
}

// Protects the actual developer journey from empty demos, scope leaks, stale pins, and publication without review.
test('studio_demo_and_alternate_profile_use_the_same_lifecycle', { timeout: 360000 }, async t => {
  const f = await demoFixture();
  try {
    const seeded = await f.seed();
    assert.equal(seeded.version, demoCorpus.version);
    assert.equal(seeded.pages.length, 8);
    assert.equal(seeded.notes.length, 0);
    const repeated = await f.seed();
    assert.ok(repeated.pages.every(page => page.status === 'unchanged'));
    assert.equal((await snapshot(f)).filter(item => item.page.body?.includes('```support-record')).length, 0);
    await f.start();
    const ranks = await retrievalBaseline(f, demoCorpus.queries);
    const id = await thread(f);
    let start = f.model.requests.length;
    const cold = await turn(f, id, `F5:diagnostic network ${sentinels.prompt}`);
    assert.equal(history(f.model.requests[start]!).status, 'empty');
    assert.match(cold.text, /No customer history yet/u);
    assert.match(cold.text, /indicator.*pending/u);
    await assertCitations(f, cold.text);
    assert.match(providerInput(f, start), /knowledge_search/u);
    assert.match(providerInput(f, start), /knowledge_read/u);
    assert.doesNotMatch(providerInput(f, start), /RETAILOPS_STORE73|FIELDRETAIL_STORE42/u);
    const beforeConfirm = await snapshot(f);
    const source = await confirm(f, id);
    assert.deepEqual(await snapshot(f), beforeConfirm, 'Technician confirmation is not publication');
    const lifecycle = await approveLifecycle(f, source);
    const reuseThread = await thread(f, f.otherCustomer!);
    start = f.model.requests.length;
    const reused = await turn(f, reuseThread, 'F5:reuse network', f.otherCustomer!);
    await assertCitations(f, reused.text, f.otherCustomer!);
    assert.ok(reused.text.includes(lifecycle.sharedRef));
    assert.equal(history(f.model.requests[start]!).status, 'empty');
    const reusedInput = providerInput(f, start);
    for (const forbidden of [
      sentinels.prompt,
      source.threadId,
      source.messageId,
      lifecycle.privateRef,
      'Source technician: alex',
    ])
      assert.ok(!reusedInput.includes(forbidden));
    assert.equal(
      (await f.request(`/knowledge/support/pages/${encodeURIComponent(lifecycle.privateRef)}`, f.otherCustomer!))
        .status,
      404,
    );
    const historySeed = await f.seed('retail-pos-history');
    assert.equal(historySeed.version, demoCorpus.version);
    assert.equal(historySeed.pages.length, 5);
    assert.equal(historySeed.notes.length, 3);
    const historyRepeat = await f.seed('retail-pos-history');
    assert.ok(historyRepeat.pages.every(page => page.status === 'unchanged'));
    assert.deepEqual(
      historyRepeat.notes.map(note => note.id),
      historySeed.notes.map(note => note.id),
    );
    const populatedThread = await thread(f);
    start = f.model.requests.length;
    const populated = await turn(f, populatedThread, 'F5:history network connectivity');
    const prepared = history(f.model.requests[start]!);
    assert.equal(prepared.records.length, 3);
    assert.ok(prepared.records.some(record => record.state === 'open'));
    assert.ok(prepared.records.every(record => record.ref.startsWith('customer:retailops:store-42#')));
    assert.match(populated.text, /open issue has no verified repair/u);
    await assertCitations(f, populated.text);
    const store73 = 'customer:retailops:store-73#cases/hub-cable';
    const field = 'customer:fieldretail:store-42#cases/wifi-selection';
    const own73 = JSON.stringify(await read(f, store73, f.otherCustomer!));
    const ownField = JSON.stringify(await read(f, field, f.otherTenant!));
    assert.match(own73, /RETAILOPS_STORE73_SILVER/u);
    assert.match(own73, /RETAILOPS_STORE73_NOTE_SILVER/u);
    assert.match(ownField, /FIELDRETAIL_STORE42_TEAL/u);
    assert.match(ownField, /FIELDRETAIL_STORE42_NOTE_TEAL/u);
    for (const [ref, owner] of [
      [store73, f.otherCustomer!],
      [field, f.otherTenant!],
    ] as const) {
      assert.equal((await f.request(`/knowledge/support/pages/${encodeURIComponent(ref)}`)).status, 404);
      start = f.model.requests.length;
      const denied = await turn(f, await thread(f), `F5:foreign READ=${ref}`);
      assert.match(denied.text, /unavailable.*authorized scope/u);
      assert.doesNotMatch(
        providerInput(f, start),
        /RETAILOPS_STORE73_(?:SILVER|NOTE)|FIELDRETAIL_STORE42_(?:TEAL|NOTE)/u,
      );
      const allowed = await turn(f, await thread(f, owner), `F5:notes READ=${ref}`, owner);
      await assertCitations(f, allowed.text, owner);
    }
    for (const owner of [f.otherCustomer!, f.colleague, f.otherTenant!]) {
      assert.equal((await f.request(`/memory/threads/${id}/messages?agentId=support`, owner)).status, 403);
      const list = JSON.stringify(await json(await f.request(`/memory/threads?agentId=support`, owner)));
      assert.ok(!list.includes(id));
      const deniedModel = await post(
        f,
        '/agents/support/generate',
        { messages: [{ role: 'user', content: 'Read another actor thread' }], memory: { thread: id } },
        owner,
      );
      assert.equal(deniedModel.status, 403);
    }
    const colleaguePage = await read(f, 'customer:retailops:store-42#cases/wifi-network', f.colleague);
    assert.match(JSON.stringify(colleaguePage), /RETAILOPS_STORE42_WIFI_AMBER/u);
    start = f.model.requests.length;
    await turn(f, await thread(f), 'F5:diagnostic separate network thread');
    assert.ok(!providerInput(f, start).includes(sentinels.prompt));
    const beforeOverride = f.model.requests.length;
    assert.equal(
      (
        await post(f, '/agents/support/generate', {
          messages: [{ role: 'user', content: 'Override model' }],
          model: 'untrusted/model',
          memory: { thread: id },
        })
      ).status,
      403,
    );
    assert.equal(f.model.requests.length, beforeOverride);
    for (const [key, summary] of [
      ['a', 'The Ethernet connection recovered after cable reseating.'],
      ['b', 'The Ethernet connection did not recover after cable reseating.'],
    ])
      await f.supportKnowledge.upsertPage({
        scope: 'customer:retailops:store-42',
        path: `cases/conflict-${key}`,
        name: `Fictional contradictory observation ${key}`,
        body: `Fictional test record.\n\n\`\`\`support-record\n${JSON.stringify({ topicTags: ['conflict-check'], observedOn: '2026-11-20', state: 'approved', summary, applicability: 'Synthetic Ethernet observations only.' })}\n\`\`\``,
        author: 'synthetic-demo-test',
      });
    start = f.model.requests.length;
    const conflict = await turn(f, await thread(f), 'F5:conflict conflict-check');
    assert.equal(history(f.model.requests[start]!).records.length, 2);
    assert.match(conflict.text, /findings conflict.*cannot choose a repair/u);
    await assertCitations(f, conflict.text);
    start = f.model.requests.length;
    const insufficient = await turn(f, await thread(f), 'F5:insufficient fluxcapacitor');
    assert.equal(history(f.model.requests[start]!).status, 'no-relevant-records');
    assert.match(insufficient.text, /Evidence is insufficient.*escalate/u);
    assert.doesNotMatch(insufficient.text, /https?:|\[(?:docs|tenant|customer):/u);
    await turn(f, id, 'F5:policy factory reset with pending offline payments');
    const changed = await f.revisePolicy();
    assert.ok(changed.pages.some(page => page.key === 'safety-policy-0' && page.version === 2));
    start = f.model.requests.length;
    const refreshed = await turn(f, id, 'F5:policy factory reset with pending offline payments');
    assert.match(refreshed.text, new RegExp(sentinels.policy));
    assert.equal(f.model.requests.length - start, 1, 'Updated policy requires no search/read round trip');
    assert.equal(latest(f.model.requests[start]!).tools.length, 0);
    assert.match(providerInput(f, start), /pinned-knowledge-update/u);
    assert.match(providerInput(f, start), new RegExp(sentinels.policy));
    t.diagnostic(
      JSON.stringify({
        corpus: demoCorpus.version,
        retrievalRanks: ranks,
        retailLifecycle: 'passed',
        isolationAndPolicy: 'passed',
      }),
    );
  } finally {
    await f.close();
  }
  const alternate = await demoFixture('software-integration');
  try {
    const seeded = await alternate.seed();
    assert.equal(seeded.version, demoCorpus.version);
    assert.equal(seeded.pages.length, 3);
    await alternate.start();
    const ranks = await retrievalBaseline(alternate, [demoCorpus.alternate]);
    const id = await thread(alternate);
    const start = alternate.model.requests.length;
    const answer = await turn(alternate, id, 'HTTP integration returned 401, what should I inspect?');
    assert.equal(history(alternate.model.requests[start]!).status, 'ready');
    assert.match(answer.text, /401 alone does not prove/u);
    await assertCitations(alternate, answer.text);
    const source = await confirm(alternate, id);
    const lifecycle = await approveLifecycle(alternate, source);
    const reused = await turn(
      alternate,
      await thread(alternate, alternate.colleague),
      'F5:reuse authentication requests',
      alternate.colleague,
    );
    assert.ok(reused.text.includes(lifecycle.sharedRef));
    await assertCitations(alternate, reused.text, alternate.colleague);
    assert.equal(source.sourceActorId, 'morgan');
    assert.equal(alternate.credentials[alternate.reviewer]!.profile.actorId, 'jamie');
    t.diagnostic(
      JSON.stringify({ corpus: demoCorpus.version, alternateRetrievalRanks: ranks, alternateLifecycle: 'passed' }),
    );
  } finally {
    await alternate.close();
  }
});

async function telemetryRows(f: Fixture) {
  const tables = await sql(
    f,
    "SELECT name FROM sqlite_master WHERE type = 'table' AND (name LIKE '%span%' OR name LIKE '%trace%' OR name LIKE '%metric%' OR name LIKE '%log%' OR name LIKE '%score%' OR name LIKE '%feedback%')",
  );
  const result: Record<string, Record<string, any>[]> = {};
  for (const { name } of tables) {
    assert.match(name, /^[a-zA-Z0-9_]+$/u);
    const columns = await sql(f, `PRAGMA table_info("${name}")`);
    const schema = (TABLE_SCHEMAS as Record<string, Record<string, { type: string }>>)[name];
    const selection = columns
      .map(column => {
        assert.match(column.name, /^[a-zA-Z0-9_]+$/u);
        // LibSQL writes SQLite JSONB. Decode every payload before scanning persisted data.
        return schema?.[column.name]?.type === 'jsonb'
          ? `json("${column.name}") AS "${column.name}"`
          : `"${column.name}"`;
      })
      .join(', ');
    result[name] = await sql(f, `SELECT ${selection} FROM "${name}"`);
  }
  return result;
}
function event(row: Record<string, any>) {
  return {
    ...row,
    attributes: typeof row.attributes === 'string' ? JSON.parse(row.attributes) : row.attributes,
    metadata: typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata,
  };
}

// Protects operators from successful-looking failed runs and private payloads persisted by tracing or metric buses.
test('persisted_telemetry_tracks_lifecycle_without_private_payloads', { timeout: 240000 }, async t => {
  const f = await demoFixture();
  try {
    await f.seed();
    await f.start();
    const id = await thread(f);
    await turn(f, id, `F5:diagnostic network ${sentinels.prompt} ${sentinels.credential} ${sentinels.payment}`);
    const saved = JSON.stringify(await json(await f.request(`/memory/threads/${id}/messages?agentId=support`)));
    for (const sentinel of [sentinels.prompt, sentinels.credential, sentinels.payment])
      assert.ok(saved.includes(sentinel), 'Positive private-payload control must be stored in Memory');
    const source = await confirm(f, id);
    const lifecycle = await approveLifecycle(f, source);
    await turn(f, await thread(f, f.otherCustomer!), 'F5:reuse network', f.otherCustomer!);
    await turn(f, await thread(f), 'F5:diagnostic network with previous history');
    await turn(f, await thread(f), 'F5:insufficient fluxcapacitor');
    assert.equal((await f.request('/observability/traces')).status, 403);
    assert.equal((await f.request(`/memory/threads/${id}/messages?agentId=support`, f.otherCustomer!)).status, 403);
    const beforeFailure = await snapshot(f);
    const failureThread = await thread(f);
    const failuresBefore = f.model.failures.length;
    const failure = await post(f, '/agents/support/generate', {
      messages: [{ role: 'user', content: 'F5:provider-failure do not invent a repair' }],
      memory: { thread: failureThread },
    });
    assert.ok(failure.status >= 500, `Provider HTTP error must fail the agent request, got ${failure.status}`);
    const failedBody = await failure.text();
    assert.doesNotMatch(failedBody, /"text":"(?:Visible|Compare|Reviewed|Verified|Use only)/u);
    assert.ok(f.model.failures.length > failuresBefore);
    assert.ok(f.model.failures.slice(failuresBefore).every(item => item.status === 503));
    assert.deepEqual(await snapshot(f), beforeFailure, 'Provider failure cannot fabricate Knowledge or publication');
    const failedMemory = await json(await f.request(`/memory/threads/${failureThread}/messages?agentId=support`));
    assert.ok(
      failedMemory.messages.every(
        (message: any) =>
          message.role !== 'assistant' ||
          !message.content.parts.some((part: any) => part.type === 'text' && part.text.trim()),
      ),
      'Failed model cannot leave invented assistant guidance',
    );
    let tables: Awaited<ReturnType<typeof telemetryRows>> = {};
    let rows: Record<string, any>[] = [];
    for (let attempt = 0; attempt < 30; attempt++) {
      tables = await telemetryRows(f);
      rows = (tables.mastra_ai_spans ?? []).map(event);
      if (
        rows.some(row => row.name === 'agent_run' && row.outcome === 'error') &&
        rows.some(row => row.name === 'support_operation_count' && row.metadata?.labels?.status === 'denied')
      )
        break;
      await setTimeout(200);
    }
    assert.ok(rows.length > 0, 'Inspect actual persisted spans, not terminal logs');
    const telemetry = await f.storage.getStore('observability');
    assert.ok(telemetry);
    const trace = await telemetry.getTrace({ traceId: rows.find(row => row.name === 'agent_run')!.traceId });
    assert.ok(trace?.spans.length, 'Native export/readback must contain real spans');
    const exported = JSON.stringify({ tables, trace });
    const forbidden = [
      ...Object.values(sentinels).filter(value => value !== sentinels.policy),
      ...f.credentials.map(entry => entry.token),
      'synthetic-model-key',
      'retailops',
      'store-42',
      'store-73',
      'alex',
      'morgan',
      source.threadId,
      source.messageId,
      lifecycle.privateRef,
      lifecycle.sharedRef,
    ];
    for (const sentinel of forbidden)
      assert.ok(!exported.includes(sentinel), `Private sentinel persisted in telemetry: ${sentinel}`);
    for (const row of rows) {
      assert.match(row.traceId, /^[a-f0-9]{32}$/u);
      assert.match(row.spanId, /^[a-f0-9]{32}$/u);
      for (const key of [
        'input',
        'output',
        'requestContext',
        'resourceId',
        'threadId',
        'userId',
        'organizationId',
        'tags',
      ])
        assert.ok(row[key] == null, `${key} must be absent from persisted telemetry`);
    }
    const samples = rows.filter(row => row.isEvent && row.metadata?.value !== undefined);
    assert.ok(samples.every(row => Number.isFinite(row.metadata.value) && row.metadata.value >= 0));
    const has = (operation: string, status: string) =>
      samples.some(
        row =>
          row.name === 'support_operation_count' &&
          row.metadata.labels.operation === operation &&
          row.metadata.labels.status === status &&
          row.metadata.value >= 1,
      );
    for (const [operation, status] of [
      ['authorization', 'success'],
      ['authorization', 'denied'],
      ['preflight', 'empty'],
      ['preflight', 'ready'],
      ['policy', 'ready'],
      ['knowledge-search', 'success'],
      ['knowledge-read', 'success'],
      ['missing-evidence', 'empty'],
      ['resolution-reuse', 'ready'],
      ['review-proposal', 'success'],
      ['review-decision', 'suspended'],
      ['review-decision', 'resumed'],
      ['review-publication', 'rejected'],
      ['review-publication', 'published'],
    ])
      assert.ok(has(operation!, status!), `Missing persisted lifecycle ${operation}/${status}`);
    assert.ok(samples.some(row => row.name === 'support_operation_duration_ms' && row.metadata.value > 0));
    assert.ok(samples.some(row => row.name === 'support_result_count' && row.metadata.value > 0));
    for (const name of [
      'mastra_agent_duration_ms',
      'mastra_model_duration_ms',
      'mastra_tool_duration_ms',
      'mastra_workflow_duration_ms',
    ])
      assert.ok(
        samples.some(row => row.name === name && row.metadata.value > 0),
        `Missing ${name}`,
      );
    assert.ok(samples.some(row => row.name === 'mastra_model_total_input_tokens' && row.metadata.value === 12));
    assert.ok(samples.some(row => row.name === 'mastra_model_total_output_tokens' && row.metadata.value === 8));
    const costs = samples.filter(row => row.metadata.costContext?.estimatedCost > 0);
    assert.ok(costs.length > 0, 'Supported native cost estimates must survive filtering');
    for (const row of costs) {
      const cost = row.metadata.costContext;
      assert.equal(cost.provider, 'openai');
      assert.equal(cost.model, 'gpt-4o-mini');
      assert.equal(cost.costUnit, 'USD');
      const rate = row.name.includes('input') ? 0.15 : 0.6;
      assert.ok(
        Math.abs(cost.estimatedCost - (row.metadata.value * rate) / 1_000_000) < 1e-12,
        `Unexpected native cost for ${row.name}`,
      );
    }
    assert.ok(rows.some(row => row.name === 'agent_run' && row.outcome === 'error' && row.error));
    assert.ok(rows.some(row => row.name === 'agent_run' && row.outcome === 'success'));
    for (const [table, records] of Object.entries(tables))
      if (!table.includes('span'))
        assert.equal(records.length, 0, `Unused telemetry channel ${table} must not store freeform payloads`);
    t.diagnostic(
      JSON.stringify({
        telemetryTables: Object.keys(tables),
        spans: rows.length,
        numericSamples: samples.length,
        costSamples: costs.length,
        realProviderFailures: f.model.failures.length,
        redaction: 'passed',
        lifecycle: 'passed',
      }),
    );
  } finally {
    await f.close();
  }
});
