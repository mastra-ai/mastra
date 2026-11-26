import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { useLocalTestDatabase } from '../fixtures/runtime.ts';
import { TABLE_SCHEMAS, TABLE_SPANS } from '@mastra/core/storage';
import { setTimeout } from 'node:timers/promises';
import { demoCorpus } from '../fixtures/demo-corpus.ts';
import { reviewedNote } from '../fixtures/history-corpus.ts';
import { resourceId } from '../../src/mastra/identity.ts';
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

useLocalTestDatabase();

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
    assert.deepEqual(
      repeated.pages.map(({ key, status }) => ({ key, status })),
      seeded.pages.map(({ key }) => ({ key, status: 'unchanged' })),
    );
    assert.equal((await snapshot(f)).filter(item => item.page.body?.includes('```support-record')).length, 0);
    await f.start();
    const ranks = await retrievalBaseline(f, demoCorpus.queries);
    const id = await thread(f);
    let start = f.model.requests.length;
    const cold = await turn(f, id, [
      { type: 'text', text: 'F5:diagnostic network' },
      { type: 'text', text: sentinels.prompt },
    ]);
    assert.equal(history(f.model.requests[start]!).status, 'empty');
    assert.match(cold.text, /No customer history yet/u);
    assert.match(cold.text, /indicator.*pending/u);
    await assertCitations(f, cold.text, start);
    await assert.rejects(
      () => assertCitations(f, `${cold.text} [docs:retailops#guides/payments]`, start),
      /Citation was absent from this turn's evidence/u,
    );
    await assert.rejects(
      () => assertCitations(f, cold.text.replace(demoCorpus.sources[0], demoCorpus.sources[2]), start),
      /Public source URL does not match evidence/u,
    );
    await assert.rejects(
      () =>
        assertCitations(
          f,
          cold.text.replace(demoCorpus.sources[0], demoCorpus.sources[0].replace('https:', 'http:')),
          start,
        ),
      /Unsupported URL/u,
    );
    assert.match(providerInput(f, start), /knowledge_search/u);
    assert.match(providerInput(f, start), /knowledge_read/u);
    assert.doesNotMatch(providerInput(f, start), /RETAILOPS_STORE73|FIELDRETAIL_STORE42/u);
    await f.memory.saveMessages({
      messages: Array.from({ length: 45 }, (_, index) => ({
        id: randomUUID(),
        threadId: id,
        resourceId: resourceId(f.credentials[f.owner]!.profile),
        role: 'user' as const,
        createdAt: new Date(Date.now() - (45 - index) * 1000),
        content: { format: 2 as const, parts: [{ type: 'text' as const, text: `Older technician turn ${index}` }] },
      })),
    });
    const beforeConfirm = await snapshot(f);
    const request = f.request;
    const unrelatedMessageId = randomUUID();
    const confirmWithConcurrentTurn = async (threadId: string, concurrentMessageId: string, duplicate = false) => {
      f.request = async (...args) => {
        const response = await request(...args);
        if (args[0] === '/agents/support/generate' && response.ok) {
          const text = duplicate
            ? JSON.parse(args[2]!.body as string).messages[0].content
            : 'Concurrent unrelated follow-up';
          await f.memory.saveMessages({
            messages: [
              {
                id: concurrentMessageId,
                threadId,
                resourceId: resourceId(f.credentials[f.owner]!.profile),
                role: 'user',
                createdAt: new Date(Date.now() + 1000),
                content: { format: 2, parts: [{ type: 'text', text }] },
              },
            ],
          });
        }
        return response;
      };
      try {
        return await confirm(f, threadId);
      } finally {
        f.request = request;
      }
    };
    const source = await confirmWithConcurrentTurn(id, unrelatedMessageId);
    const memoryStore = await f.storage.getStore('memory');
    const confirmation = (await memoryStore!.listMessagesById({ messageIds: [source.messageId] })).messages[0];
    assert.match(JSON.stringify(confirmation), /Confirmed: The fictional Wi-Fi network selection/u);
    assert.equal((await memoryStore!.listMessagesById({ messageIds: [unrelatedMessageId] })).messages.length, 1);
    await f.memory.deleteMessages([unrelatedMessageId]);
    const ambiguityThread = await thread(f);
    await assert.rejects(() => confirmWithConcurrentTurn(ambiguityThread, randomUUID(), true), {
      actual: 2,
      expected: 1,
      message: /Expected exactly one newly persisted confirmation/u,
    });
    assert.deepEqual(await snapshot(f), beforeConfirm, 'Technician confirmation is not publication');
    const lifecycle = await approveLifecycle(f, source);
    const reuseThread = await thread(f, f.otherCustomer!);
    start = f.model.requests.length;
    const reused = await turn(f, reuseThread, 'F5:reuse network', f.otherCustomer!);
    await assertCitations(f, reused.text, start, f.otherCustomer!);
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
    assert.deepEqual(
      historyRepeat.pages.map(({ key, status }) => ({ key, status })),
      historySeed.pages.map(({ key }) => ({ key, status: 'unchanged' })),
    );
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
    await assertCitations(f, populated.text, start);
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
      const response = await post(f, '/agents/support/stream', {
        messages: [{ role: 'user', content: `F5:foreign READ=${ref}` }],
        memory: { thread: await thread(f) },
      });
      const denied = await response.text();
      assert.equal(response.status, 200, denied);
      const events = denied
        .split('\n')
        .filter(line => line.startsWith('data: {'))
        .map(line => JSON.parse(line.slice(6)));
      const failure = events.find(event => event.type === 'tool-error' && event.payload?.toolName === 'knowledge_read');
      assert.ok(failure, denied);
      assert.ok(JSON.stringify(failure.payload.error).includes('not found.'));
      assert.equal(failure.payload.result, undefined);
      assert.ok(!events.some(event => event.type === 'tool-result' && event.payload?.toolName === 'knowledge_read'));
      assert.match(denied, /unavailable.*authorized scope/u);
      assert.doesNotMatch(
        providerInput(f, start),
        /RETAILOPS_STORE73_(?:SILVER|NOTE)|FIELDRETAIL_STORE42_(?:TEAL|NOTE)/u,
      );
      start = f.model.requests.length;
      const allowed = await turn(f, await thread(f, owner), `F5:notes READ=${ref}`, owner);
      await assertCitations(f, allowed.text, start, owner);
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
    for (const { path, summary, applicability } of demoCorpus.conflictObservations)
      await f.supportKnowledge.upsertPage({
        scope: 'customer:retailops:store-42',
        path,
        name: summary,
        body: `Fictional test record.\n\n\`\`\`support-record\n${JSON.stringify({ topicTags: ['conflict-check'], observedOn: '2026-11-20', state: 'approved', summary, applicability })}\n\`\`\``,
        author: 'synthetic-demo-test',
      });
    start = f.model.requests.length;
    const conflict = await turn(f, await thread(f), 'F5:conflict conflict-check');
    assert.equal(history(f.model.requests[start]!).records.length, 2);
    assert.match(conflict.text, /findings conflict.*cannot choose a repair/u);
    await assertCitations(f, conflict.text, start);
    start = f.model.requests.length;
    const insufficient = await turn(f, await thread(f), 'F5:insufficient fluxcapacitor');
    assert.equal(history(f.model.requests[start]!).status, 'no-relevant-records');
    assert.match(insufficient.text, /Evidence is insufficient.*escalate/u);
    assert.doesNotMatch(insufficient.text, /https?:|\[(?:docs|tenant|customer):/u);
    await turn(f, id, 'F5:policy factory reset with pending offline payments');
    const changed = await f.revisePolicy();
    assert.ok(changed.pages.some(page => page.key === 'safety-policy-0' && page.version === 2));
    start = f.model.requests.length;
    const refreshed = await turn(f, id, 'F5:policy-revision factory reset with pending offline payments');
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
    await assertCitations(alternate, answer.text, start);
    const protectedAnswer = await turn(alternate, id, 'F5:policy should I log credential values?');
    assert.match(protectedAnswer.text, /\[tenant:software#policies\/safe-changes\]/u);
    const source = await confirm(alternate, id);
    const lifecycle = await approveLifecycle(alternate, source);
    const reuseStart = alternate.model.requests.length;
    const reused = await turn(
      alternate,
      await thread(alternate, alternate.colleague),
      'F5:reuse authentication requests',
      alternate.colleague,
    );
    assert.ok(reused.text.includes(lifecycle.sharedRef));
    await assertCitations(alternate, reused.text, reuseStart, alternate.colleague);
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
    const beforeFailure = await snapshot(f);
    const failureThread = await thread(f);
    const failuresBefore = f.model.failures.length;
    const failure = await post(f, '/agents/support/generate', {
      messages: [{ role: 'user', content: 'F5:provider-failure do not invent a repair' }],
      memory: { thread: failureThread },
    });
    assert.ok(failure.status >= 500, `Provider HTTP error must fail the agent request, got ${failure.status}`);
    const failedBody = await failure.json();
    assert.equal(typeof failedBody.error, 'string');
    assert.ok(failedBody.error.trim());
    assert.ok(Object.keys(failedBody).every(key => key === 'error' || key === 'cause'));
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
    // Persist this trace before any other agent run can write to the fixture database.
    let failedTraceId: string | undefined;
    for (let attempt = 0; attempt < 30; attempt++) {
      const runs = await sql(
        f,
        `SELECT traceId, outcome, error FROM ${TABLE_SPANS} WHERE name = 'agent_run' AND endedAt IS NOT NULL`,
      );
      if (runs.length) {
        assert.equal(runs.length, 1);
        assert.equal(runs[0]!.outcome, 'error');
        assert.ok(runs[0]!.error);
        failedTraceId = runs[0]!.traceId;
        break;
      }
      await setTimeout(200);
    }
    assert.ok(failedTraceId, 'The request that received a 503 must persist an error span');
    const id = await thread(f);
    await turn(f, id, `F5:diagnostic network ${sentinels.prompt} ${sentinels.credential} ${sentinels.payment}`);
    const saved = JSON.stringify(await json(await f.request(`/memory/threads/${id}/messages?agentId=support`)));
    for (const sentinel of [sentinels.prompt, sentinels.credential, sentinels.payment])
      assert.ok(saved.includes(sentinel), 'Positive private-payload control must be stored in Memory');
    const source = await confirm(f, id);
    const lifecycle = await approveLifecycle(f, source);
    const sharedThread = await thread(f, f.otherCustomer!);
    const sharedReadStart = Date.now();
    await turn(f, sharedThread, 'F5:reuse network', f.otherCustomer!);
    const sharedReadEnd = Date.now();
    const [sharedScope, sharedPath] = lifecycle.sharedRef.split('#') as [string, string];
    const { page: sharedPage } = await read(f, lifecycle.sharedRef, f.otherCustomer!);
    const longBody = `${sharedPage.body}\n\n## Additional checks\n${'Verify the terminal connection indicator before retrying.\n'.repeat(250)}`;
    await f.supportKnowledge.upsertPage({
      scope: sharedScope,
      path: sharedPath,
      name: sharedPage.name,
      body: longBody,
    });
    const numberedReadStart = Date.now();
    await turn(f, await thread(f, f.otherCustomer!), 'F5:numbered-read network', f.otherCustomer!);
    const numberedReadEnd = Date.now();
    const offsetPath = 'fixtures/numbered-offset';
    await f.supportKnowledge.upsertPage({
      scope: sharedScope,
      path: offsetPath,
      name: 'Synthetic reading offset',
      body: `Example ${longBody}`,
    });
    f.reuse(`${sharedScope}#${offsetPath}`);
    const offsetReadStart = Date.now();
    await turn(f, await thread(f, f.otherCustomer!), 'F5:numbered-read-offset network', f.otherCustomer!);
    const offsetReadEnd = Date.now();
    await f.seed('retail-pos-history');
    const noteValue = 'REVIEWED_NOTE_PRIVATE_MARIGOLD';
    const noteScope = 'customer:retailops:store-73';
    const notePath = 'cases/hub-cable';
    for (const index of [1, 2])
      await f.supportKnowledge.addNote({
        scope: noteScope,
        path: notePath,
        text: reviewedNote(`${noteValue} ${index}`),
        author: 'review:synthetic',
      });
    const notesThread = await thread(f, f.otherCustomer!);
    const noteRequestStart = f.model.requests.length;
    const noteReadStart = Date.now();
    await turn(f, notesThread, `F5:notes READ=${noteScope}#${notePath}`, f.otherCustomer!);
    const noteReadEnd = Date.now();
    assert.ok(providerInput(f, noteRequestStart).includes(noteValue));
    const backlinkRef = `${noteScope}#${notePath}`;
    const { page: backlinkTarget } = await read(f, backlinkRef, f.otherCustomer!);
    const { page: backlinkSource } = await f.supportKnowledge.upsertPage({
      scope: noteScope,
      path: 'fixtures/backlink-source',
      name: 'Synthetic backlink source',
      body: 'An unrelated page with an attributed note.',
    });
    const knowledgeStore = await f.supportKnowledge.getStorage();
    const backlinkValue = 'REVIEWED_BACKLINK_MARIGOLD';
    await knowledgeStore.addNote({
      pageId: backlinkSource.id,
      text: reviewedNote(backlinkValue),
      stampScopeIds: [backlinkSource.scopeId],
      mentions: [backlinkTarget.id],
      provenance: { author: 'review:synthetic' },
    });
    const backlinkStart = Date.now();
    await turn(f, await thread(f, f.otherCustomer!), `F5:backlink READ=${backlinkRef}`, f.otherCustomer!);
    const backlinkEnd = Date.now();
    const combinedStart = Date.now();
    await turn(f, await thread(f, f.otherCustomer!), `F5:backlink-and-notes READ=${backlinkRef}`, f.otherCustomer!);
    const combinedEnd = Date.now();
    const historyThread = await thread(f);
    const historyRequestStart = f.model.requests.length;
    const historyStart = Date.now();
    await turn(f, historyThread, 'F5:diagnostic network with previous history');
    const historyEnd = Date.now();
    const approvedRecords = history(f.model.requests[historyRequestStart]!).records.filter(
      record => record.state === 'approved',
    );
    assert.ok(approvedRecords.length, 'The history turn must deliver approved evidence from preflight');
    await turn(f, await thread(f), 'F5:insufficient fluxcapacitor');
    assert.equal((await f.request('/observability/traces')).status, 403);
    assert.equal((await f.request(`/memory/threads/${id}/messages?agentId=support`, f.otherCustomer!)).status, 403);
    const requiredLifecycle = [
      ['authorization', 'success'],
      ['authorization', 'denied'],
      ['preflight', 'empty'],
      ['preflight', 'ready'],
      ['policy', 'ready'],
      ['knowledge-search', 'success'],
      ['knowledge-read', 'success'],
      ['missing-evidence', 'empty'],
      ['review-proposal', 'success'],
      ['review-decision', 'suspended'],
      ['review-decision', 'resumed'],
      ['review-publication', 'rejected'],
      ['review-publication', 'published'],
    ];
    const requiredDurations = [
      'support_operation_duration_ms',
      'support_result_count',
      'mastra_agent_duration_ms',
      'mastra_model_duration_ms',
      'mastra_tool_duration_ms',
      'mastra_workflow_duration_ms',
    ];
    function missingTelemetry(rows: Record<string, any>[]) {
      const samples = rows.filter(row => row.isEvent && row.metadata?.value !== undefined);
      const missing = requiredLifecycle
        .filter(
          ([operation, status]) =>
            !samples.some(
              row =>
                row.name === 'support_operation_count' &&
                row.metadata.labels?.operation === operation &&
                row.metadata.labels?.status === status &&
                row.metadata.value >= 1,
            ),
        )
        .map(([operation, status]) => `${operation}/${status}`);
      for (const name of requiredDurations)
        if (!samples.some(row => row.name === name && row.metadata.value > 0)) missing.push(name);
      if (!samples.some(row => row.name === 'mastra_model_total_input_tokens' && row.metadata.value === 12))
        missing.push('model input tokens');
      if (!samples.some(row => row.name === 'mastra_model_total_output_tokens' && row.metadata.value === 8))
        missing.push('model output tokens');
      if (!samples.some(row => row.metadata.costContext?.estimatedCost > 0)) missing.push('native cost estimate');
      const inTurn = (row: Record<string, any>, start: number, end: number) => {
        const timestamp = new Date(row.startedAt).getTime();
        return timestamp >= start && timestamp <= end;
      };
      const reuse = rows.filter(
        row =>
          row.isEvent &&
          row.name === 'support_operation_count' &&
          row.metadata?.labels?.operation === 'resolution-reuse',
      );
      for (const [label, start, end, expected] of [
        ['shared finding', sharedReadStart, sharedReadEnd, 1],
        ['numbered shared finding', numberedReadStart, numberedReadEnd, 1],
        ['numbered excerpt from mid-line', offsetReadStart, offsetReadEnd, 0],
        ['reviewed notes', noteReadStart, noteReadEnd, 1],
        ['reviewed backlink', backlinkStart, backlinkEnd, 1],
        ['reviewed backlink and notes', combinedStart, combinedEnd, 1],
      ] as const) {
        const reads = rows
          .filter(row => row.name === 'knowledge-read' && row.endedAt && inTurn(row, start, end))
          .sort((a, b) => new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime());
        const [read] = reads;
        const counts = reuse.filter(row => row.traceId === read?.traceId);
        // The shared finding is read first, followed by the public source separately.
        const expectedReads = label === 'shared finding' ? 2 : 1;
        if (
          reads.length !== expectedReads ||
          counts.length !== expected ||
          counts.some(
            row =>
              row.parentSpanId !== read?.spanId || row.metadata.value !== 1 || row.metadata.labels?.status !== 'ready',
          )
        )
          missing.push(`${expected} resolution reuse events linked to the ${label} read span`);
      }
      const historyRun = rows.find(
        row => row.name === 'agent_run' && row.endedAt && inTurn(row, historyStart, historyEnd),
      );
      const processorIds = new Set(
        rows
          .filter(row => row.name === 'processor_run' && row.traceId === historyRun?.traceId && row.endedAt)
          .map(row => row.spanId),
      );
      const preflight = samples.filter(
        row =>
          row.traceId === historyRun?.traceId &&
          processorIds.has(row.parentSpanId) &&
          row.metadata.labels?.operation === 'resolution-reuse',
      );
      const operations = preflight.filter(row => row.name === 'support_operation_count');
      const results = preflight.filter(row => row.name === 'support_result_count');
      if (
        operations.length !== 1 ||
        operations[0]?.metadata.value !== 1 ||
        preflight.filter(row => row.name === 'support_operation_duration_ms').length !== 1 ||
        results.length !== 1 ||
        results[0]?.metadata.value !== approvedRecords.length ||
        preflight.some(row => row.metadata.labels?.status !== 'ready')
      )
        missing.push('preflight reuse events linked to the history turn processor');
      if (
        !rows.some(
          row => row.traceId === failedTraceId && row.name === 'agent_run' && row.outcome === 'error' && row.error,
        )
      )
        missing.push('failed agent run');
      if (!rows.some(row => row.name === 'agent_run' && row.outcome === 'success'))
        missing.push('successful agent run');
      return missing;
    }
    let tables: Awaited<ReturnType<typeof telemetryRows>> = {};
    let rows: Record<string, any>[] = [];
    for (let attempt = 0; attempt < 30; attempt++) {
      tables = await telemetryRows(f);
      rows = (tables.mastra_ai_spans ?? []).map(event);
      if (!missingTelemetry(rows).length) break;
      await setTimeout(200);
    }
    assert.ok(rows.length > 0, 'Inspect actual persisted spans, not terminal logs');
    const failedAgent = rows.find(
      row => row.traceId === failedTraceId && row.name === 'agent_run' && row.outcome === 'error' && row.error,
    );
    assert.ok(failedAgent, 'SQL must contain the failed agent span');
    const telemetry = await f.storage.getStore('observability');
    assert.ok(telemetry);
    const trace = await telemetry.getTrace({ traceId: failedTraceId });
    const failedSpan = trace?.spans.find(span => span.spanId === failedAgent.spanId);
    assert.equal(failedSpan?.outcome, 'error', 'Native readback must retain the failed agent span and outcome');
    assert.ok(failedSpan.error);
    const exported = JSON.stringify({ tables, trace });
    const forbidden = [
      noteValue,
      backlinkValue,
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
    assert.deepEqual(missingTelemetry(rows), [], 'All required telemetry must be persisted');
    const costs = samples.filter(row => row.metadata.costContext?.estimatedCost > 0);
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
