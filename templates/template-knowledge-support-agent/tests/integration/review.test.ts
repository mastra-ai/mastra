import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { access, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { setTimeout } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { test } from 'node:test';
import { TABLE_WORKFLOW_SNAPSHOT } from '@mastra/core/storage';
import { runtimeFixture, useLocalTestDatabase } from '../fixtures/runtime.ts';
import { resourceId } from '../../src/mastra/identity.ts';
import { seedDataset } from '../../src/mastra/knowledge/seed.ts';
import { acquireWriterLock } from '../../src/mastra/knowledge/writer-lock.ts';
import { upsertPageAtRevision } from '../../src/mastra/knowledge/versioned-page.ts';
import { proposalDraftSchema, proposalSchema, publishedText } from '../../src/mastra/review/contracts.ts';
import { createReviewService } from '../../src/mastra/review/service.ts';
import type { Candidate, Proposal } from '../../src/mastra/review/contracts.ts';

type Fixture = Awaited<ReturnType<typeof runtimeFixture>>;
type Message = { role: string; content?: string };
useLocalTestDatabase();

const execute = promisify(execFile);
const customer = 'customer:north:store-1';
const evidence = `${customer}#cases/synthetic`;
const publicRef = 'docs:north#public-network-guide';
const bodyOnlySource = 'docs:north#body-only-guide';
const publicUrl = 'https://example.com/synthetic-network-guide';
const reviewer = 6;

function candidate(label: string, changes: Partial<Candidate> = {}): Candidate {
  return {
    action: 'page',
    target: null,
    title: `Verified Ethernet ${label}`,
    content: `Fictional Ethernet connectivity recovered after replacing a damaged cable. Finding ${label}.`,
    record: {
      topicTags: ['connectivity'],
      observedOn: '2026-11-20',
      state: 'approved',
      summary: `Verified cable recovery ${label}`,
      applicability: 'Fictional Ethernet hardware with a visibly damaged cable.',
    },
    evidence: [{ ref: evidence, version: 1 }],
    publicSource: null,
    ...changes,
  };
}
function messages(body: Record<string, unknown>) {
  return body.messages as Message[];
}
function history(body: Record<string, unknown>) {
  const item = messages(body).find(message => message.content?.startsWith('Customer history preflight'));
  assert.ok(item, 'History must cross the real provider boundary');
  return JSON.parse(item.content!.slice(item.content!.indexOf('\n') + 1)) as {
    status: string;
    records: Array<{ ref: string; summary: string }>;
  };
}
async function json(response: Response) {
  const text = await response.text();
  assert.equal(response.status, 200, text);
  return JSON.parse(text);
}
async function post(f: Fixture, path: string, body: unknown, owner = reviewer) {
  return f.request(path, owner, { method: 'POST', body: JSON.stringify(body) });
}
async function credentials(f: Fixture, granted = true, otherReviewers: number[] = []) {
  await writeFile(
    f.injectedCredentialFile,
    JSON.stringify(
      f.credentials.map((entry, index) => ({
        ...entry,
        profile: {
          ...entry.profile,
          ...(index === reviewer ? { review: granted } : otherReviewers.includes(index) ? { review: true } : {}),
        },
      })),
    ),
  );
}
async function fixture(preload?: URL) {
  let selected = candidate('initial');
  let emitted: Candidate | undefined;
  let sharedRead: string | undefined;
  let keepSearching = false;
  const f = await runtimeFixture({
    preload,
    modelScript: body => {
      const list = messages(body);
      const curator = list.some(message =>
        JSON.stringify(message.content).includes('Review one confirmed customer outcome'),
      );
      const tools = list.filter(message => message.role === 'tool');
      if (curator) {
        const definitions = body.tools as Array<{ function: { name: string } }>;
        if (keepSearching) {
          if (body.tool_choice === 'none' || !definitions?.length) {
            assert.ok(
              tools.some(tool => tool.content?.includes(evidence)),
              'The final call receives the search evidence',
            );
            return { content: JSON.stringify(selected) };
          }
          return { tool: { name: 'knowledge_search', arguments: { query: 'SYNTHETIC' } } };
        }
        assert.deepEqual(definitions.map(tool => tool.function.name).sort(), [
          'knowledge_activity',
          'knowledge_list',
          'knowledge_read',
          'knowledge_search',
        ]);
        if (!tools.length)
          return { tool: { name: 'knowledge_search', arguments: { query: 'SYNTHETIC', scope: [customer] } } };
        if (tools.length === 1) return { tool: { name: 'knowledge_read', arguments: { page: evidence } } };
        if (tools.length === 2)
          return { tool: { name: 'knowledge_read', arguments: { page: 'customer:north:store-2#cases/synthetic' } } };
        const extraEvidence = selected.evidence[0]?.ref;
        const readExtraEvidence = extraEvidence?.startsWith(`${customer}#`) && extraEvidence !== evidence;
        if (readExtraEvidence && tools.length === 3)
          return { tool: { name: 'knowledge_read', arguments: { page: extraEvidence } } };
        const tenantScope = JSON.parse(list.find(message => message.role === 'user')!.content!).tenantScope;
        const target = tenantScope && selected.target && `${tenantScope}#${selected.target.path}`;
        if (target && tools.length === (readExtraEvidence ? 4 : 3))
          return { tool: { name: 'knowledge_read', arguments: { page: target } } };
        const results = (target ? tools.slice(0, -1) : tools).map(tool => tool.content).join('\n');
        if (target) {
          const read = JSON.parse(tools.at(-1)!.content!).page;
          assert.equal(read.ref, target);
          assert.equal(read.version, selected.target!.expectedVersion);
        }
        if (selected.evidence.some(item => item.ref === evidence)) assert.match(results, /SYNTHETIC_PRIVATE_0/u);
        if (extraEvidence?.startsWith(`${customer}#cases/review-`))
          assert.match(tools[3]!.content!, /Reviewed by: morgan/u);
        assert.doesNotMatch(results, /SYNTHETIC_PRIVATE_[1245]|SYNTHETIC_FOREIGN|(?:docs|tenant):south/u);
        if (!tenantScope) assert.doesNotMatch(results, /SYNTHETIC_DOC_|docs:north|tenant:north/u);
        assert.match(tools[2]!.content!, /denied|not found|not readable|scope|access/iu);
        emitted = selected;
        return { content: JSON.stringify(emitted) };
      }
      const question =
        [...list]
          .reverse()
          .find(message => message.role === 'user' && !message.content?.startsWith('<pinned-knowledge'))?.content ?? '';
      if (question.startsWith('Confirmed:'))
        return { content: 'The technician confirmation is stored, awaiting authorized review.' };
      if (sharedRead && question.includes('reuse shared')) {
        if (!tools.length) return { tool: { name: 'knowledge_read', arguments: { page: sharedRead } } };
        assert.match(tools.at(-1)!.content!, /Public source:.*docs:north#public-network-guide/u);
        return {
          content: `Approved Ethernet finding [${sharedRead}] uses public source [${publicRef}] (${publicUrl}).`,
        };
      }
      const prepared = history(body);
      return {
        content: `Scoped history ${prepared.status}: ${prepared.records.map(record => `[${record.ref}] ${record.summary}`).join('; ')}`,
      };
    },
  });
  try {
    f.credentials.push({
      ...f.credentials[3]!,
      token: randomBytes(32).toString('base64url'),
      profile: { ...f.credentials[3]!.profile, id: 'north-reviewer', actorId: 'morgan' },
    });
    await credentials(f);
    const guide = {
      title: 'Synthetic public network guide',
      file: 'guide.md',
      scope: { kind: 'docs', profile: f.credentials[0]!.profile.id },
    };
    await writeFile(
      join(f.directory, 'guide.md'),
      `Synthetic guide: inspect Ethernet cabling.\nSource: ${publicUrl}\n`,
    );
    await writeFile(
      join(f.directory, 'manifest.json'),
      JSON.stringify({
        schemaVersion: 1,
        id: 'synthetic',
        version: '1',
        pages: [
          {
            ...guide,
            key: 'public-guide',
            path: 'public-network-guide',
            source: { kind: 'Synthetic source', url: publicUrl },
          },
          { ...guide, key: 'body-only-guide', path: 'body-only-guide' },
        ],
      }),
    );
    await seedDataset(
      {
        id: 'synthetic',
        directory: f.directory,
        profiles: [f.credentials[0]!.profile],
        mandatoryPolicies: [],
      },
      { databaseUrl: f.databaseUrl },
    );
  } catch (error) {
    await f.close().catch(() => undefined);
    throw error;
  }
  return Object.assign(f, {
    select(value: Candidate) {
      selected = value;
      emitted = undefined;
    },
    emittedCandidate: () => emitted,
    shared(value: string) {
      sharedRead = value;
    },
    keepSearching() {
      keepSearching = true;
    },
  });
}
async function thread(f: Fixture, owner = 0) {
  return (
    await json(
      await post(
        f,
        '/memory/threads?agentId=support',
        {
          resourceId: resourceId(f.credentials[owner]!.profile),
        },
        owner,
      ),
    )
  ).id as string;
}
async function turn(f: Fixture, id: string, content: string, owner = 0) {
  return json(
    await post(f, '/agents/support/generate', { messages: [{ role: 'user', content }], memory: { thread: id } }, owner),
  );
}
async function confirmation(f: Fixture, owner = 0, threadId?: string) {
  const id = threadId ?? (await thread(f, owner));
  await turn(
    f,
    id,
    `Confirmed: The fictional Ethernet connection recovered after replacing a damaged cable. No payments were pending. Public reference ${publicRef}.`,
    owner,
  );
  const saved = await json(await f.request(`/memory/threads/${id}/messages?agentId=support`, owner));
  const message = (saved.messages ?? saved).find((item: { role: string }) => item.role === 'user');
  assert.ok(message, 'Source must be an actual stored technician turn');
  return {
    threadId: id,
    messageId: message.id as string,
    sourceActorId: f.credentials[owner]!.profile.actorId,
    audience: 'private' as 'private' | 'tenant',
  };
}
async function begin(f: Fixture, input: Awaited<ReturnType<typeof confirmation>>) {
  const { runId } = await json(await post(f, '/workflows/review/create-run', {}));
  const state = await json(await post(f, `/workflows/review/start-async?runId=${runId}`, { inputData: input }));
  return { runId: runId as string, state };
}
async function inspect(f: Fixture, runId: string) {
  return json(await f.request(`/workflows/review/runs/${runId}`, reviewer));
}
async function pending(f: Fixture, input: Awaited<ReturnType<typeof confirmation>>) {
  const run = await begin(f, input);
  const snapshot = await inspect(f, run.runId);
  assert.equal(snapshot.status, 'suspended', JSON.stringify(snapshot));
  const proposal = snapshot.steps['review-decision'].suspendPayload as Proposal;
  assert.equal(proposal.source.messageId, input.messageId);
  assert.equal(proposal.reviewer.actorId, 'morgan');
  return { ...run, proposal };
}
function decision(proposal: Proposal, value: 'approve' | 'reject' = 'approve') {
  return {
    decision: value,
    revision: proposal.revision,
    reason: 'Inspected the fictional stored confirmation and exact proposed text.',
  };
}
async function resume(
  f: Fixture,
  run: { runId: string; proposal: Proposal },
  value: 'approve' | 'reject' = 'approve',
  step: string | string[] = ['review-decision'],
) {
  return json(
    await post(f, `/workflows/review/resume-async?runId=${run.runId}`, {
      step,
      resumeData: decision(run.proposal, value),
    }),
  );
}
async function read(f: Fixture, ref: string, owner = 0) {
  return json(await f.request(`/knowledge/support/pages/${encodeURIComponent(ref.split('?')[0]!)}`, owner));
}
async function snapshot(f: Fixture) {
  const store = await f.supportKnowledge.getStorage();
  const all = [];
  let cursor: string | undefined;
  do {
    const batch = await store.listPages({ read: 'all', cursor, limit: 100 });
    for (const page of batch.pages) {
      const notes = [];
      let noteCursor: string | undefined;
      do {
        const result = await store.listNotes({ pageId: page.id, read: 'all', cursor: noteCursor, limit: 100 });
        notes.push(...result.notes);
        noteCursor = result.nextCursor;
      } while (noteCursor);
      all.push({ page, notes: { notes } });
    }
    cursor = batch.nextCursor;
  } while (cursor);
  return all;
}
async function sql(f: Fixture, query: string, parameters: string[] = []) {
  // Separate processes avoid loading Node SQLite beside the LibSQL native library.
  const script = `import { DatabaseSync } from 'node:sqlite'; const db = new DatabaseSync(process.env.PROOF_DATABASE); db.exec('PRAGMA busy_timeout = 5000'); try { console.log(JSON.stringify(db.prepare(process.env.PROOF_SQL).all(...JSON.parse(process.env.PROOF_PARAMETERS)))); } finally { db.close(); }`;
  const result = await execute(process.execPath, ['--input-type=module', '-e', script], {
    env: {
      ...process.env,
      PROOF_DATABASE: join(f.directory, 'support.db'),
      PROOF_SQL: query,
      PROOF_PARAMETERS: JSON.stringify(parameters),
    },
    timeout: 10000,
  });
  return JSON.parse(result.stdout) as Record<string, string>[];
}

test('review produces a proposal after the curator uses its evidence search budget', { timeout: 120000 }, async () => {
  const f = await fixture();
  try {
    await f.start();
    const input = await confirmation(f);
    const finding = candidate('after evidence searches');
    f.select(finding);
    f.keepSearching();

    const run = await pending(f, input);
    assert.deepEqual(run.proposal.candidate, finding);
    assert.equal(run.proposal.destination.scope, customer);
  } finally {
    await f.close();
  }
});

test('publication preserves operator edits made after it checks the destination', { timeout: 120000 }, async () => {
  const f = await fixture();
  try {
    await f.start();
    const input = await confirmation(f);
    f.select(candidate('initial-version', { evidence: [] }));
    const initial = await pending(f, input);
    assert.equal((await resume(f, initial)).result.status, 'published');
    const actor = { ...f.credentials[reviewer]!.profile, review: true };
    const service = createReviewService(f.supportKnowledge, f.memory, () => actor);
    const store = await f.supportKnowledge.getStorage();
    const getPageByPath = store.getPageByPath.bind(store);
    for (const action of ['page', 'update'] as const) {
      f.select(
        candidate(`concurrent-${action}`, {
          action,
          evidence: [],
          target: action === 'update' ? { path: initial.proposal.destination.path, expectedVersion: 1 } : null,
        }),
      );
      const { proposal } = await pending(f, input);
      const { scope, path } = proposal.destination;
      const body = `Keep the operator's ${action}.`;
      let operatorVersion: number | undefined;
      store.getPageByPath = async lookup => {
        const current = await getPageByPath(lookup);
        if (
          operatorVersion === undefined &&
          lookup.path.join('/') === path &&
          (action === 'page' ? lookup.read === 'all' && !current : lookup.read !== 'all' && current?.version === 1)
        ) {
          store.getPageByPath = getPageByPath;
          const { page } = await f.supportKnowledge.upsertPage({ scope, path, name: 'Operator finding', body });
          operatorVersion = page.version;
        }
        return current;
      };
      try {
        await assert.rejects(
          f.withEnvironment(() =>
            service.publish(
              {
                proposal,
                decision: decision(proposal),
                reviewerId: actor.actorId,
                decidedAt: new Date().toISOString(),
              },
              actor,
            ),
          ),
          /Page destination changed/u,
        );
      } finally {
        store.getPageByPath = getPageByPath;
      }
      assert.equal(operatorVersion, action === 'page' ? 1 : 2);
      const persisted = (await snapshot(f)).find(item => item.page.body === body)?.page;
      assert.equal(persisted?.name, 'Operator finding');
      assert.equal(persisted.version, operatorVersion);
    }
  } finally {
    await f.close();
  }
});

test('a short thread ID blocks explicit references and permits ordinary shared wording', async () => {
  const f = await fixture();
  try {
    // Older saved conversations can have short IDs even though new Studio threads get UUIDs.
    await f.memory.createThread({ threadId: 'it', resourceId: resourceId(f.credentials[0]!.profile) });
    await f.start();
    const input = { ...(await confirmation(f, 0, 'it')), audience: 'tenant' as const };
    assert.equal(input.threadId, 'it');
    const publicSource = { ref: publicRef, version: 1 };
    f.select(candidate('short-thread', { content: 'Wait for the link light to turn green.', publicSource }));
    const safe = await pending(f, input);
    const { revision, ...draft } = safe.proposal;
    const longReviewer = { ...draft.reviewer, actorId: 'a'.repeat(200) };
    const longOwner = resourceId(longReviewer);
    assert.ok(longOwner.length > 200);
    assert.equal(proposalDraftSchema.parse({ ...draft, reviewer: longReviewer, owner: longOwner }).owner, longOwner);
    assert.equal(
      proposalSchema.parse({ ...draft, revision, reviewer: longReviewer, owner: longOwner }).owner,
      longOwner,
    );
    assert.equal(proposalDraftSchema.safeParse({ ...draft, owner: longOwner }).success, false);
    assert.equal(proposalSchema.safeParse({ ...draft, revision, owner: longOwner }).success, false);
    assert.equal(proposalDraftSchema.safeParse({ ...draft, owner: 'a'.repeat(1001) }).success, false);
    assert.equal(proposalSchema.safeParse({ ...draft, revision, owner: 'a'.repeat(1001) }).success, false);
    for (const [customerId, ordinary, explicit] of [
      ['pos', 'Reposition the terminal.', 'POS'],
      ['p+s', 'Check the ps indicator.', 'P+S'],
      ['İD', 'Check the indicator.', 'i\u0307d'],
    ] as const) {
      const profile = { ...safe.proposal.reviewer, customerId };
      const shared = { ...safe.proposal, reviewer: profile, owner: resourceId(profile) };
      assert.equal(
        proposalSchema.safeParse({ ...shared, candidate: { ...shared.candidate, content: ordinary } }).success,
        true,
      );
      assert.equal(
        proposalSchema.safeParse({
          ...shared,
          candidate: { ...shared.candidate, content: `Contact the (_${explicit}_) customer.` },
        }).success,
        false,
      );
    }
    for (const [sourceActorId, explicit] of [
      ['tech', 'Ask TECH to repeat the test.'],
      [safe.proposal.id, `Reference: open${safe.proposal.id}record.`],
    ] as const) {
      const shared = { ...safe.proposal, source: { ...safe.proposal.source, sourceActorId } };
      assert.equal(
        proposalSchema.safeParse({
          ...shared,
          candidate: { ...shared.candidate, content: 'Ask a technician to repeat the test.' },
        }).success,
        true,
      );
      assert.equal(
        proposalSchema.safeParse({ ...shared, candidate: { ...shared.candidate, content: explicit } }).success,
        false,
      );
    }
    const invalid = proposalSchema.safeParse({ ...safe.proposal, source: { ...safe.proposal.source, threadId: '(' } });
    assert.ok(!invalid.success);
    assert.ok(invalid.error.issues.some(issue => issue.path.join('.') === 'source.threadId'));
    assert.equal((await resume(f, safe)).result.status, 'published');

    const leaked = candidate('explicit-thread', { content: 'See internal thread (_IT_).', publicSource });
    f.select(leaked);
    const run = await begin(f, input);
    assert.equal(run.state.status, 'failed');
    assert.deepEqual(f.emittedCandidate(), leaked);
    assert.match(JSON.stringify(run.state), /Shared text contains private identifiers or references/u);
  } finally {
    await f.close();
  }
});

test('guarded writes resolve the same paths as native Knowledge', async () => {
  const f = await runtimeFixture();
  try {
    const knowledge = f.supportKnowledge;
    const store = await knowledge.getStorage();
    const scope = 'docs:north';
    const { page } = await knowledge.upsertPage({ scope, path: 'guides', name: 'Guides', body: 'Original' });
    const updated = await upsertPageAtRevision(
      knowledge,
      store,
      { scope, path: '/guides/', name: 'Guides', body: 'Revised' },
      page,
    );
    assert.equal(updated.page.id, page.id);
    assert.equal(updated.page.version, page.version + 1);
    assert.equal(updated.page.body, 'Revised');
  } finally {
    await f.close();
  }
});

test('approval_publishes_scoped_content_and_a_new_thread_reuses_knowledge', { timeout: 180000 }, async () => {
  const f = await fixture();
  try {
    await f.start();
    const input = await confirmation(f);
    const before = await snapshot(f);
    const privatePage = candidate('private-page');
    privatePage.content += ` See [[ ${evidence} ]].`;
    f.select(privatePage);
    const run = await pending(f, input);
    assert.deepEqual(await snapshot(f), before, 'Suspension cannot write Knowledge');
    await f.stop();
    await f.start();
    assert.deepEqual((await inspect(f, run.runId)).steps['review-decision'].suspendPayload, run.proposal);
    const result = await resume(f, run);
    assert.equal(result.result.status, 'published');
    const reference = result.result.reference as string;
    const publishedPage = await read(f, reference);
    const published = JSON.stringify(publishedPage);
    assert.ok(published.includes(`[[ ${evidence} ]]`));
    const { page: evidencePage } = await read(f, evidence);
    const links = await json(await f.request(`/knowledge/support/pages/${publishedPage.page.id}/links?direction=out`));
    assert.ok(
      links.edges.some(
        (edge: { toPageId: string; count: number }) => edge.toPageId === evidencePage.id && edge.count === 2,
      ),
    );
    assert.match(published, /review:morgan/u);
    assert.match(published, /Source technician: alex/u);
    assert.ok(published.includes(input.threadId) && published.includes(input.messageId));
    assert.match(published, /customer:north:store-1#cases\/synthetic/u);
    assert.equal((await inspect(f, run.runId)).result.reference, reference);
    assert.equal((await f.request(`/knowledge/support/pages/${encodeURIComponent(reference)}`, 1)).status, 404);
    const index = f.model.requests.length;
    await turn(f, await thread(f), 'network connectivity');
    assert.ok(history(f.model.requests[index]!).records.some(item => item.ref === reference));

    // Approved supplements enter bounded preflight with an exact note citation.
    f.select(candidate('private-note', { action: 'note', target: { path: 'cases/synthetic', expectedVersion: 1 } }));
    const note = await pending(f, input);
    const { revision: noteRevision, ...noteDraft } = note.proposal;
    const target = noteDraft.bindings.find(binding => binding.kind === 'target');
    assert.ok(target);
    const evidenceBindings = noteDraft.bindings.filter(binding => binding.kind !== 'target');
    assert.ok(proposalDraftSchema.safeParse({ ...noteDraft, bindings: [] }).success);
    for (const bindings of [evidenceBindings, [...evidenceBindings, { ...target, ref: `${customer}#cases/other` }]]) {
      const result = proposalSchema.safeParse({ ...noteDraft, revision: noteRevision, bindings });
      assert.equal(result.success, false, 'A note must be bound to its exact destination before review');
      assert.ok(result.error?.issues.some(issue => issue.path.join('.') === 'bindings'));
    }
    const noted = await resume(f, note);
    assert.equal(noted.result.status, 'published');
    const noteRef = noted.result.reference as string;
    assert.match(noteRef, /\?note=/u);
    const notedAt = f.model.requests.length;
    await turn(f, await thread(f), 'network connectivity');
    const prepared = history(f.model.requests[notedAt]!);
    assert.equal(prepared.status, 'ready');
    assert.ok(prepared.records.length <= 3 && prepared.records.some(item => item.ref === noteRef));

    const page = (await snapshot(f)).find(item =>
      item.page.body?.includes(`knowledge-review:${run.proposal.id}:`),
    )!.page;
    f.select(
      candidate('private-update', {
        action: 'update',
        target: { path: run.proposal.destination.path, expectedVersion: page.version },
        content: run.proposal.candidate.content,
      }),
    );
    const update = await pending(f, input);
    assert.equal((await resume(f, update)).result.reference, reference);
    const updated = (await snapshot(f)).find(item => item.page.id === page.id)!.page;
    assert.equal(updated!.version, page.version + 1);
    assert.equal(updated.description, 'Verified cable recovery private-update');

    f.select(candidate('sanitized-shared', { publicSource: { ref: publicRef, version: 1 } }));
    const shared = await pending(f, { ...input, audience: 'tenant' });
    const { revision: sharedRevision, ...sharedDraft } = shared.proposal;
    const invalidSource = {
      ...sharedDraft,
      candidate: { ...sharedDraft.candidate, publicSource: { ref: 'tenant:north#public-network-guide', version: 1 } },
    };
    for (const result of [
      proposalDraftSchema.safeParse(invalidSource),
      proposalSchema.safeParse({ ...invalidSource, revision: sharedRevision }),
    ]) {
      assert.equal(result.success, false, 'The tenant publication must cite its documentation scope');
      assert.ok(result.error?.issues.some(issue => issue.path.join('.') === 'candidate.publicSource.ref'));
    }
    const sharedResult = await resume(f, shared, 'approve', 'review-decision');
    assert.equal(sharedResult.result.status, 'published');
    const sharedRef = sharedResult.result.reference as string;
    const sharedText = JSON.stringify(await read(f, sharedRef, 3));
    assert.match(sharedText, /Public source:.*docs:north#public-network-guide/u);
    assert.doesNotMatch(sharedText, /Source technician|Confirmed in thread|customer:north|SYNTHETIC_PRIVATE|store-1/u);
    assert.ok(!sharedText.includes(input.threadId) && !sharedText.includes(input.messageId));
    f.shared(sharedRef);
    const next = await thread(f, 3),
      start = f.model.requests.length;
    const reused = await turn(f, next, 'network connectivity reuse shared', 3);
    assert.ok(reused.text.includes(sharedRef) && reused.text.includes(publicUrl));
    const captured = JSON.stringify(f.model.requests.slice(start).map(request => request.messages));
    assert.match(captured, /knowledge_read/u);
    assert.doesNotMatch(captured, /Source technician: alex|SYNTHETIC_PRIVATE_[01245]/u);
    assert.ok(!captured.includes(input.threadId) && !captured.includes(input.messageId));
    const audit = await inspect(f, shared.runId);
    assert.deepEqual(audit.steps['review-decision'].output.decision, decision(shared.proposal));
    assert.deepEqual(audit.steps['review-decision'].output.proposal.candidate, shared.proposal.candidate);

    const tenantCasePath = 'cases/tenant-network';
    const { page: tenantCase } = await f.supportKnowledge.upsertPage({
      scope: 'tenant:north',
      path: tenantCasePath,
      name: 'Existing tenant-wide network case',
    });
    f.select(
      candidate('tenant-case-note', {
        action: 'note',
        target: { path: tenantCasePath, expectedVersion: tenantCase.version },
        evidence: [],
        publicSource: { ref: publicRef, version: 1 },
      }),
    );
    const tenantNote = await resume(f, await pending(f, { ...input, audience: 'tenant' }));
    assert.equal(tenantNote.result.status, 'published');
    assert.match(tenantNote.result.reference, /^tenant:north#cases\/tenant-network\?note=/u);
  } finally {
    await f.close();
  }
});

test(
  'review accepts readable record boundaries and fails permanent publication errors',
  { timeout: 120000 },
  async () => {
    const f = await fixture();
    try {
      await f.start();
      const input = await confirmation(f);
      const valid = candidate('record-boundary');
      valid.content += '\n\n> Confirmed after inspection';
      valid.record.topicTags = ['connectivity', 'a'.repeat(80)];
      f.select(valid);
      const accepted = await pending(f, input);
      const published = await resume(f, accepted);
      assert.equal(published.result.status, 'published');
      const index = f.model.requests.length;
      await turn(f, await thread(f), 'network connectivity');
      const prepared = history(f.model.requests[index]!);
      assert.equal(prepared.status, 'ready');
      assert.ok(prepared.records.some(record => record.ref === published.result.reference));

      const before = await snapshot(f);
      const invalid = candidate('invalid-record');
      invalid.record.topicTags = ['connectivity', 'a'.repeat(81)];
      f.select(invalid);
      const rejected = await begin(f, input);
      assert.equal(rejected.state.status, 'failed', 'An unreadable record must fail before review approval');
      assert.deepEqual(await snapshot(f), before);

      const hiddenFence = candidate('hidden-record');
      hiddenFence.content = `~~~support-record\n${JSON.stringify(hiddenFence.record)}\n~~~\n\n~~~markdown`;
      f.select(hiddenFence);
      const wrongFence = await begin(f, input);
      assert.equal(wrongFence.state.status, 'failed');
      assert.match(JSON.stringify(wrongFence.state), /published support record must be a standalone fence/u);
      assert.deepEqual(await snapshot(f), before);

      f.select(candidate('permanent-write-failure'));
      const failed = await pending(f, input);
      // A real database constraint aborts the Knowledge write, without interfering with workflow audit.
      await sql(
        f,
        `CREATE TRIGGER reject_review_write BEFORE INSERT ON mastra_knowledge_pages
      WHEN instr(NEW.body, 'knowledge-review:${failed.proposal.id}:') > 0
      BEGIN SELECT RAISE(ABORT, 'synthetic permanent publication constraint'); END`,
      );
      const result = await resume(f, failed);
      assert.equal(result.status, 'failed', 'A permanent write error must not offer an endless retry');
      assert.deepEqual(await snapshot(f), before);
      const audit = await inspect(f, failed.runId);
      assert.equal(audit.status, 'failed');
      assert.match(JSON.stringify(audit.steps['publish-review'].error), /synthetic permanent publication constraint/u);
      assert.deepEqual(audit.steps['review-decision'].output.decision, decision(failed.proposal));
      assert.deepEqual(audit.steps['review-decision'].output.proposal, failed.proposal);
      await sql(f, 'DROP TRIGGER reject_review_write');
      assert.equal(
        (
          await post(f, `/workflows/review/resume-async?runId=${failed.runId}`, {
            step: ['publish-review'],
            resumeData: decision(failed.proposal),
          })
        ).status,
        403,
      );

      f.select(
        candidate('receipt-write-failure', {
          action: 'update',
          target: { path: accepted.proposal.destination.path, expectedVersion: 1 },
          evidence: [],
        }),
      );
      const rollback = await pending(f, input);
      await sql(
        f,
        `CREATE TRIGGER reject_publication_receipt BEFORE INSERT ON support_review_publications
      WHEN NEW.proposal_id = '${rollback.proposal.id}'
      BEGIN SELECT RAISE(ABORT, 'synthetic publication receipt constraint'); END`,
      );
      const failedReceipt = await resume(f, rollback);
      assert.equal(failedReceipt.status, 'failed');
      assert.match(JSON.stringify(failedReceipt), /synthetic publication receipt constraint/u);
      assert.deepEqual(await snapshot(f), before, 'A failed receipt insert must roll back the native page update');
      await sql(f, 'DROP TRIGGER reject_publication_receipt');

      f.select(candidate('transient-write-contention'));
      const busy = await pending(f, input);
      const lock = await acquireWriterLock(f.databaseUrl);
      try {
        assert.equal((await resume(f, busy)).status, 'suspended');
        assert.deepEqual(await snapshot(f), before);
      } finally {
        await lock.release();
      }
      const suspended = await inspect(f, busy.runId);
      assert.deepEqual(suspended.steps['publish-review'].suspendPayload.decision, decision(busy.proposal));
      assert.equal((await resume(f, busy, 'approve', 'publish-review')).result.status, 'published');
      assert.equal(
        (await snapshot(f)).filter(item => item.page.body?.includes(`knowledge-review:${busy.proposal.id}:`)).length,
        1,
      );
    } finally {
      await f.close();
    }
  },
);

test('review detects exact duplicates and publishes new content in a large scope', { timeout: 120000 }, async () => {
  const f = await fixture();
  try {
    await f.start();
    const input = await confirmation(f);
    await sql(
      f,
      `WITH RECURSIVE sequence(n) AS (SELECT 1 UNION ALL SELECT n + 1 FROM sequence WHERE n < 1001)
       INSERT INTO mastra_knowledge_pages
         (id, scopeId, isScope, key, parentId, position, path, depth, name, canonicalName, body, version,
          createdBy, updatedBy, createdAt, updatedAt)
       SELECT 'bulk-' || n, page.scopeId, 0, 'bulk-' || n, page.parentId, page.position, parent.path || 'bulk-' || n || '/',
              page.depth, 'Bulk page ' || n, 'bulk page ' || n, 'Unrelated fixture description.', 1,
              page.createdBy, page.updatedBy, page.createdAt, page.updatedAt
       FROM mastra_knowledge_pages page JOIN mastra_knowledge_pages parent ON parent.id = page.parentId
       CROSS JOIN sequence WHERE page.id = ?`,
      [f.pages[0]!.id],
    );
    const finding = candidate('large-scope', { content: 'Café diagnostic: literal 100%_\nSecond line.' });
    f.select(finding);
    const first = await pending(f, input);
    assert.equal((await resume(f, first)).result.status, 'published');
    const second = await pending(f, input);
    assert.equal(second.proposal.candidate.action, 'duplicate');
    assert.equal((await resume(f, second)).result.status, 'duplicate');

    const store = await f.supportKnowledge.getStorage();
    const target = f.pages[0]!;
    const supplement = candidate('legacy-note', {
      action: 'note',
      target: { path: 'cases/synthetic', expectedVersion: 1 },
      evidence: [],
    });
    f.select(supplement);
    const legacyRun = await pending(f, input);
    const legacy = await store.addNote({
      pageId: target.id,
      text: publishedText(legacyRun.proposal),
      stampScopeIds: [target.scopeId],
      mentions: [],
      provenance: { author: 'review:morgan' },
    });
    assert.notEqual(legacy.id, legacyRun.proposal.id);
    assert.equal((await resume(f, legacyRun)).result.reference, `${evidence}?note=${legacy.id}`);

    const duplicate = await pending(f, input);
    assert.equal(duplicate.proposal.candidate.action, 'duplicate');
    const duplicateResult = await resume(f, duplicate);
    assert.equal(duplicateResult.result.status, 'duplicate');

    await store.removeNote({ id: legacy.id, deletedBy: 'fixture', provenance: { author: 'fixture' } });
    const raced = await pending(f, input);
    assert.equal(raced.proposal.candidate.action, 'note');
    const added = await store.addNote({
      pageId: target.id,
      text: supplement.content,
      stampScopeIds: [target.scopeId],
      mentions: [],
      provenance: { author: 'fixture' },
    });
    const racedResult = await resume(f, raced);
    assert.equal(racedResult.status, 'failed');
    assert.match(JSON.stringify(racedResult), /duplicate note or finding now exists/u);
    await store.removeNote({ id: added.id, deletedBy: 'fixture', provenance: { author: 'fixture' } });

    const racedFinding = await pending(f, input);
    assert.equal(racedFinding.proposal.candidate.action, 'note');
    const path = 'cases/new-duplicate';
    await f.supportKnowledge.upsertPage({
      scope: customer,
      path,
      name: 'Finding published after note preparation',
      body: supplement.content,
      author: 'fixture',
    });
    const racedFindingResult = await resume(f, racedFinding);
    assert.equal(racedFindingResult.status, 'failed');
    assert.match(JSON.stringify(racedFindingResult), /duplicate note or finding now exists/u);
    assert.equal(await store.getNote({ id: racedFinding.proposal.id, read: 'all' }), null);
    await f.supportKnowledge.removePage({ scope: customer, path, author: 'fixture' });

    const deletedRun = await pending(f, input);
    const deleted = await store.addNote({
      pageId: target.id,
      text: publishedText(deletedRun.proposal),
      stampScopeIds: [target.scopeId],
      mentions: [],
      provenance: { author: 'review:morgan' },
    });
    await store.removeNote({ id: deleted.id, deletedBy: 'fixture', provenance: { author: 'fixture' } });
    const replay = await resume(f, deletedRun);
    assert.equal(replay.status, 'failed');
    assert.match(JSON.stringify(replay), /Conflicting prior note effect/u);
    assert.equal(await store.getNote({ id: deletedRun.proposal.id, read: 'all', includeDeleted: true }), null);
    assert.equal((await resume(f, await pending(f, input))).result.status, 'published');
  } finally {
    await f.close();
  }
});

test('review_rejects_unsafe_resumes_and_recovers_publication_once', { timeout: 240000 }, async () => {
  const f = await fixture(new URL('../fixtures/resume-gate.mjs', import.meta.url));
  try {
    await f.start();
    const input = await confirmation(f);
    let serial = 0;
    async function next(changes: Partial<Candidate> = {}, source = input) {
      f.select(candidate(`guard-${++serial}`, changes));
      return pending(f, source);
    }
    async function unchanged(action: () => Promise<unknown>) {
      const before = await snapshot(f);
      await action();
      assert.deepEqual(await snapshot(f), before);
    }
    const rejected = await next();
    await unchanged(async () => {
      assert.equal((await resume(f, rejected, 'reject')).result.status, 'rejected');
    });
    assert.deepEqual((await inspect(f, rejected.runId)).result.decision, decision(rejected.proposal, 'reject'));
    for (const action of ['duplicate', 'contradiction', 'insufficient-evidence'] as const) {
      const run = await next({ action });
      await unchanged(async () => {
        assert.equal((await resume(f, run)).result.status, action);
      });
    }
    const guarded = await next();
    await unchanged(async () => {
      await credentials(f, true, [1, 2, 3]);
      for (const owner of [0, 1, 2, 3]) {
        assert.equal((await f.request(`/workflows/review/runs/${guarded.runId}`, owner)).status, 403);
        assert.equal(
          (
            await post(
              f,
              `/workflows/review/resume-async?runId=${guarded.runId}`,
              { step: ['review-decision'], resumeData: decision(guarded.proposal) },
              owner,
            )
          ).status,
          403,
        );
      }
      for (const body of [
        { step: ['review-decision'], resumeData: { ...decision(guarded.proposal), revision: '0'.repeat(64) } },
        { step: ['review-decision'], resumeData: decision(guarded.proposal), requestContext: { role: 'admin' } },
        { step: ['publish-review'], resumeData: decision(guarded.proposal) },
      ])
        assert.equal((await post(f, `/workflows/review/resume-async?runId=${guarded.runId}`, body)).status, 403);
      await credentials(f, false);
      assert.equal(
        (
          await post(f, `/workflows/review/resume-async?runId=${guarded.runId}`, {
            step: ['review-decision'],
            resumeData: decision(guarded.proposal),
          })
        ).status,
        403,
      );
      await credentials(f);
    });
    assert.equal((await inspect(f, guarded.runId)).status, 'suspended');

    // Invalid candidates and source selection fail through the same native start path.
    for (const [changes, source, expectedError] of [
      [
        { evidence: [{ ref: 'customer:north:store-2#cases/synthetic', version: 1 }] },
        input,
        /Evidence is outside the permitted scope/u,
      ],
      [{ evidence: [{ ref: `${customer}#cases/../synthetic`, version: 1 }] }, input, /Invalid scoped page reference/u],
      [{ evidence: [{ ref: `${customer}#cases/missing`, version: 1 }] }, input, /Evidence or target is missing/u],
      [{ content: `See [[ ${customer}#cases/other ]].` }, input, /unvalidated evidence link/u],
      [
        { publicSource: { ref: 'tenant:north#absent-public-source', version: 1 } },
        { ...input, audience: 'tenant' },
        /Public source must be a documentation reference/u,
      ],
      [
        { publicSource: { ref: bodyOnlySource, version: 1 } },
        { ...input, audience: 'tenant' },
        /Public source must be a current existing HTTPS source-backed page/u,
      ],
      [
        { record: { ...candidate('description').record, summary: 'word '.repeat(150).trim() } },
        input,
        /Knowledge page description exceeds the 100 token limit/u,
      ],
      [
        {
          action: 'note',
          target: { path: 'cases/synthetic', expectedVersion: 1 },
          content: 'word '.repeat(210).trim(),
        },
        input,
        /Knowledge note text exceeds the 250 token limit/u,
      ],
      [
        { action: 'update', target: { path: 'cases/synthetic', expectedVersion: 1 } },
        input,
        /Only review-owned findings may be updated/u,
      ],
      [
        { action: 'note', target: { path: 'learnings/missing', expectedVersion: 1 } },
        input,
        /Target must be an allowed finding or case record/u,
      ],
      [
        { content: 'Private store-1 information', publicSource: { ref: publicRef, version: 1 } },
        { ...input, audience: 'tenant' },
        /Shared text contains private identifiers or references/u,
      ],
      [
        {
          content: `Verified finding for _case-${input.threadId.toUpperCase()}_`,
          publicSource: { ref: publicRef, version: 1 },
        },
        { ...input, audience: 'tenant' },
        /Shared text contains private identifiers or references/u,
      ],
      [
        { content: 'password=synthetic-secret', publicSource: { ref: publicRef, version: 1 } },
        { ...input, audience: 'tenant' },
        /Shared text contains private links, credentials, or payment-like data/u,
      ],
      [
        { publicSource: null },
        { ...input, audience: 'tenant' },
        /Shared findings require public evidence and shareable applicability/u,
      ],
    ] as Array<[Partial<Candidate>, typeof input, RegExp]>) {
      await unchanged(async () => {
        const selected = candidate(`invalid-${++serial}`, changes);
        f.select(selected);
        const run = await begin(f, source);
        assert.equal(run.state.status, 'failed', JSON.stringify(run.state));
        assert.deepEqual(f.emittedCandidate(), selected, 'The model must deliver the candidate before validation');
        assert.match(JSON.stringify(run.state), expectedError);
      });
    }
    for (const [source, expectedError] of [
      [{ ...input, sourceActorId: 'morgan' }, /Reviewer must differ from source technician/u],
      [{ ...input, messageId: 'missing-turn' }, /Attributable technician turn required/u],
    ] as const) {
      await unchanged(async () => {
        const requests = f.model.requests.length;
        const run = await begin(f, source);
        assert.equal(run.state.status, 'failed', JSON.stringify(run.state));
        assert.match(JSON.stringify(run.state), expectedError);
        assert.equal(f.model.requests.length, requests, 'Invalid sources must fail before the curator runs');
      });
    }
    const foreignSource = await confirmation(f, 1);
    await unchanged(async () => {
      f.select(candidate('foreign-confirmation'));
      const requests = f.model.requests.length;
      assert.equal((await begin(f, foreignSource)).state.status, 'failed');
      assert.equal(f.model.requests.length, requests, 'A foreign confirmation must never reach the curator');
    });

    const staleEvidence = await next();
    const staleTarget = await next({
      evidence: [],
      action: 'note',
      target: { path: 'cases/synthetic', expectedVersion: 1 },
    });
    await f.supportKnowledge.upsertPage({
      scope: customer,
      path: 'cases/synthetic',
      name: 'Externally changed evidence',
      body: 'SYNTHETIC_PRIVATE_0 revised',
      author: 'synthetic-fixture',
    });
    await unchanged(async () => {
      assert.equal((await resume(f, staleEvidence)).status, 'failed');
    });
    await unchanged(async () => {
      assert.equal((await resume(f, staleTarget)).status, 'failed');
    });
    const currentEvidence = (await snapshot(f)).find(item => item.page.id === f.pages[0]!.id)!.page;
    const missing = await next({
      evidence: [],
      action: 'note',
      target: { path: 'cases/synthetic', expectedVersion: currentEvidence.version },
    });
    await f.supportKnowledge.removePage({ scope: customer, path: 'cases/synthetic', author: 'synthetic-fixture' });
    await unchanged(async () => {
      assert.equal((await resume(f, missing)).status, 'failed');
    });
    const staleSource = await next({ evidence: [] });
    await f.memory.deleteMessages([input.messageId]);
    await unchanged(async () => {
      assert.equal((await resume(f, staleSource)).status, 'failed');
    });
    const changedInput = await confirmation(f);
    const changedSource = await next({ evidence: [] }, changedInput);
    const memoryStore = await f.memory.storage.getStore('memory');
    const stored = (await memoryStore!.listMessagesById({ messageIds: [changedInput.messageId] })).messages[0]!;
    await f.memory.updateMessages({
      messages: [
        {
          id: stored.id,
          content: {
            ...stored.content,
            parts: [
              {
                type: 'text',
                text: 'Confirmed: The replacement cable did not recover the fictional connection; the original conclusion was wrong.',
              },
            ],
          },
        },
      ],
    });
    await unchanged(async () => {
      assert.equal((await resume(f, changedSource)).status, 'failed');
    });
    const freshInput = await confirmation(f);
    const stalePublic = await next(
      { evidence: [], publicSource: { ref: publicRef, version: 1 } },
      { ...freshInput, audience: 'tenant' },
    );
    await f.supportKnowledge.upsertPage({
      scope: 'docs:north',
      path: 'public-network-guide',
      name: 'Synthetic public network guide',
      body: `Synthetic revised Ethernet guidance.\nSource: ${publicUrl}`,
      author: 'seed:synthetic',
    });
    await unchanged(async () => {
      assert.equal((await resume(f, stalePublic)).status, 'failed');
    });

    // A live competing writer suspends publication after a durable decision without an effect.
    const busy = await next({ evidence: [] }, freshInput);
    const lock = await acquireWriterLock(f.databaseUrl);
    try {
      await unchanged(async () => {
        assert.equal((await resume(f, busy)).status, 'suspended');
      });
    } finally {
      await lock.release();
    }
    const approval = (await inspect(f, busy.runId)).steps['publish-review'].suspendPayload;
    assert.deepEqual(approval.decision, decision(busy.proposal));
    assert.equal(
      (
        await post(f, `/workflows/review/resume-async?runId=${busy.runId}`, {
          step: ['publish-review'],
          resumeData: { ...decision(busy.proposal), reason: 'Changed intent' },
        })
      ).status,
      403,
    );
    const gate = join(f.directory, `resume-${busy.runId}`);
    await writeFile(gate, '');
    const retry = () =>
      post(f, `/workflows/review/resume-async?runId=${busy.runId}`, {
        step: ['publish-review'],
        resumeData: approval.decision,
      });
    const first = retry();
    try {
      for (let attempt = 0; ; attempt++) {
        try {
          await access(`${gate}.claimed`);
          break;
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== 'ENOENT' || attempt === 200) throw error;
          await setTimeout(25);
        }
      }
      assert.equal((await inspect(f, busy.runId)).status, 'running');
      const overlapping = await retry();
      assert.equal(overlapping.status, 403, await overlapping.text());
    } finally {
      await writeFile(`${gate}.release`, '');
      const accepted = await first;
      assert.equal(accepted.status, 200, await accepted.text());
    }
    const completed = await inspect(f, busy.runId);
    assert.equal(completed.result.status, 'published', JSON.stringify(completed));
    const effects = (await snapshot(f)).filter(item =>
      item.page.body?.includes(`knowledge-review:${busy.proposal.id}:`),
    );
    assert.deepEqual(
      effects.map(effect => effect.page.version),
      [1],
    );
    await unchanged(async () => {
      assert.equal(
        (
          await post(f, `/workflows/review/resume-async?runId=${busy.runId}`, {
            step: ['publish-review'],
            resumeData: decision(busy.proposal),
          })
        ).status,
        403,
      );
    });
    assert.equal((await inspect(f, busy.runId)).result.reference, completed.result.reference);

    // Repeat the timing boundary: each pair races for one approved suspended publication.
    for (let attempt = 0; attempt < 20; attempt++) {
      const racing = await next({ evidence: [] }, freshInput);
      const held = await acquireWriterLock(f.databaseUrl);
      try {
        assert.equal((await resume(f, racing)).status, 'suspended');
      } finally {
        await held.release();
      }
      const replies = await Promise.all(
        [0, 1].map(() =>
          post(f, `/workflows/review/resume-async?runId=${racing.runId}`, {
            step: ['publish-review'],
            resumeData: decision(racing.proposal),
          }),
        ),
      );
      const statuses = replies.map(reply => reply.status).sort();
      assert.equal(statuses[0], 200);
      assert.ok(statuses[1] === 403 || statuses[1] === 409, `Unexpected resume statuses ${statuses.join(', ')}`);
      await Promise.all(replies.map(reply => reply.text()));
      const finished = await inspect(f, racing.runId);
      assert.equal(finished.result.status, 'published', JSON.stringify(finished));
      const effects = (await snapshot(f)).filter(item =>
        item.page.body?.includes(`knowledge-review:${racing.proposal.id}:`),
      );
      assert.deepEqual(
        effects.map(effect => effect.page.version),
        [1],
      );
      assert.equal(
        finished.result.reference,
        `${racing.proposal.destination.scope}#${racing.proposal.destination.path}`,
      );
    }

    // Reject terminal snapshot persistence after the actual Knowledge write. The last durable
    // publication checkpoint remains running, so the next process must reconcile that effect.
    async function interruptAndRecover(
      interrupted: Awaited<ReturnType<typeof next>>,
      expectedVersion?: number,
      afterCommit?: () => Promise<unknown>,
      superseded = false,
      rejected = false,
    ) {
      const marker = `knowledge-review:${interrupted.proposal.id}:`;
      const note = interrupted.proposal.candidate.action === 'note';
      const effects = () =>
        note
          ? sql(f, 'SELECT id, text FROM mastra_knowledge_notes WHERE instr(text, ?) > 0 AND deletedAt IS NULL', [
              marker,
            ])
          : sql(f, 'SELECT id, body, version FROM mastra_knowledge_pages WHERE instr(body, ?) > 0', [marker]);
      await sql(
        f,
        `CREATE TRIGGER fail_review_audit BEFORE INSERT ON ${TABLE_WORKFLOW_SNAPSHOT}
      WHEN NEW.run_id = '${interrupted.runId}' AND json_extract(NEW.snapshot, '$.context."publish-review".status') IN ('success', 'failed', 'suspended')
      BEGIN SELECT RAISE(ABORT, 'synthetic terminal audit outage'); END`,
      );
      await sql(
        f,
        `CREATE TRIGGER fail_review_audit_update BEFORE UPDATE ON ${TABLE_WORKFLOW_SNAPSHOT}
      WHEN NEW.run_id = '${interrupted.runId}' AND json_extract(NEW.snapshot, '$.context."publish-review".status') IN ('success', 'failed', 'suspended')
      BEGIN SELECT RAISE(ABORT, 'synthetic terminal audit outage'); END`,
      );
      const request = post(f, `/workflows/review/resume-async?runId=${interrupted.runId}`, {
        step: ['review-decision'],
        resumeData: { ...decision(interrupted.proposal), decision: rejected ? 'reject' : 'approve' },
      }).catch(() => undefined);
      let written: Awaited<ReturnType<typeof effects>> = [];
      for (let attempt = 0; !rejected && attempt < 100; attempt++) {
        written = await effects();
        if (written.length) break;
        await setTimeout(100);
      }
      assert.equal(written.length, rejected ? 0 : 1, 'Only approved reviews write Knowledge');
      if (!rejected && !note)
        assert.equal(written[0]!.version, expectedVersion, 'A page publication increments the version once');
      // Wait for the native run to finish trying its terminal checkpoint. Core can suppress
      // persistence errors with logging disabled; the durable checkpoint must still be running.
      const transport = await request;
      assert.ok(transport);
      const transportBody = await transport.text();
      assert.match(
        transportBody,
        rejected ? /rejected|synthetic terminal audit outage/u : /published|synthetic terminal audit outage/u,
      );
      await assert.rejects(
        sql(
          f,
          `UPDATE ${TABLE_WORKFLOW_SNAPSHOT}
      SET snapshot = jsonb(json_set(snapshot, '$.context."publish-review".status', 'success')) WHERE run_id = ?`,
          [interrupted.runId],
        ),
        /synthetic terminal audit outage/u,
      );
      const durable = await sql(
        f,
        `SELECT json(snapshot) AS snapshot FROM ${TABLE_WORKFLOW_SNAPSHOT} WHERE run_id = ?`,
        [interrupted.runId],
      );
      const checkpoint = JSON.parse(durable[0]!.snapshot!);
      assert.ok(checkpoint.context, JSON.stringify(checkpoint));
      assert.equal(checkpoint.context['review-decision'].status, 'success');
      assert.equal(checkpoint.context['publish-review'].status, 'running');
      await f.stop();
      await sql(f, 'DROP TRIGGER fail_review_audit');
      await sql(f, 'DROP TRIGGER fail_review_audit_update');
      await afterCommit?.();
      // The child exits with the writer transaction still open. The next process can take over.
      await execute(
        process.execPath,
        [
          '--input-type=module',
          '-e',
          `const { acquireWriterLock } = await import('./src/mastra/knowledge/writer-lock.ts'); await acquireWriterLock(${JSON.stringify(f.databaseUrl)});`,
        ],
        { cwd: fileURLToPath(new URL('../..', import.meta.url)), timeout: 10000 },
      );
      if (note) {
        const { scope, path } = interrupted.proposal.destination;
        const { page } = await f.supportKnowledge.upsertPage({
          scope,
          path,
          name: 'Case edited after the note committed',
          body: 'A separate edit after the approval was already published.',
          author: 'synthetic-fixture',
        });
        assert.equal(page.version, interrupted.proposal.candidate.target!.expectedVersion + 1);
        await f.supportKnowledge.upsertPage({ scope, path: 'archive', name: 'Archive' });
        await f.supportKnowledge.movePage({ scope, path, parent: 'archive' });
      }
      await f.start();
      const beforeRetry = await snapshot(f);
      const restartPath = `/workflows/review/restart-async?runId=${interrupted.runId}`;
      for (const body of [{ inputData: {} }, { requestContext: { extra: true } }])
        assert.equal((await post(f, restartPath, body)).status, 403);
      const recovered = await json(await post(f, restartPath, note ? {} : { requestContext: {} }));
      assert.deepEqual(await snapshot(f), beforeRetry, 'Recovery must preserve the stored Knowledge');
      assert.deepEqual(await effects(), superseded ? [] : written, 'Recovery must never reapply the original effect');
      assert.equal(
        recovered.status,
        'success',
        JSON.stringify({ runId: interrupted.runId, status: recovered.status, error: recovered.error }),
      );
      assert.equal(recovered.result.status, rejected ? 'rejected' : 'published', JSON.stringify(recovered));
      if (rejected) {
        assert.equal(recovered.result.reference, null);
        assert.deepEqual(await effects(), []);
        return null;
      }
      const { scope, path } = interrupted.proposal.destination;
      const originalRef = `${scope}#${path}${note ? `?note=${written[0]!.id}` : ''}`;
      assert.equal(recovered.result.reference, originalRef);
      assert.equal((await inspect(f, interrupted.runId)).result.reference, originalRef);
      assert.equal(
        (await inspect(f, interrupted.runId)).steps['review-decision'].output.proposal.id,
        interrupted.proposal.id,
      );
      return originalRef;
    }
    const interrupted = await next({ evidence: [] }, freshInput);
    const originalRef = (await interruptAndRecover(interrupted, 1))!;
    const interruptedRejection = await next({ evidence: [] }, freshInput);
    await interruptAndRecover(interruptedRejection, undefined, undefined, false, true);
    const original = (await snapshot(f)).find(item =>
      item.page.body?.includes(`knowledge-review:${interrupted.proposal.id}:`),
    )!.page;
    const secondEvidence = `${customer}#cases/separate-evidence`;
    const { page: separate } = await f.supportKnowledge.upsertPage({
      scope: customer,
      path: 'cases/separate-evidence',
      name: 'Separate evidence',
      body: 'Independent evidence for the update.',
      author: 'synthetic-fixture',
    });
    const interruptedUpdate = await next(
      {
        action: 'update',
        target: { path: interrupted.proposal.destination.path, expectedVersion: original.version },
        evidence: [
          { ref: originalRef, version: original.version },
          { ref: secondEvidence, version: separate.version },
        ],
      },
      freshInput,
    );
    assert.equal(
      await interruptAndRecover(
        interruptedUpdate,
        original.version + 1,
        async () => {
          await f.supportKnowledge.upsertPage({
            scope: customer,
            path: 'cases/separate-evidence',
            name: 'Separately revised evidence',
            body: 'Another technician added details after the update committed.',
            author: 'synthetic-fixture',
          });
          await f.start();
          const successor = await next(
            {
              action: 'update',
              target: { path: interrupted.proposal.destination.path, expectedVersion: original.version + 1 },
              evidence: [],
            },
            freshInput,
          );
          assert.equal((await resume(f, successor)).result.status, 'published');
          const successorEffect = (await snapshot(f)).find(item => item.page.id === original.id)!.page;
          assert.equal(successorEffect.version, original.version + 2);
          assert.match(successorEffect.body!, new RegExp(`knowledge-review:${successor.proposal.id}:`));
          await f.stop();
        },
        true,
      ),
      originalRef,
    );

    // Preserve exact native checkpoints around the publisher, including the decision-only
    // window where the Knowledge writer has never run and the completed-step audit window.
    await sql(f, 'CREATE TABLE review_recovery_checkpoints (snapshot TEXT)');
    for (const boundary of ['before-publisher', 'after-publisher'] as const) {
      const interrupted = await next({ evidence: [] }, freshInput);
      await sql(f, 'DELETE FROM review_recovery_checkpoints');
      for (const operation of ['INSERT', 'UPDATE'])
        await sql(
          f,
          `CREATE TRIGGER capture_review_${operation} AFTER ${operation} ON ${TABLE_WORKFLOW_SNAPSHOT}
          WHEN NEW.run_id = '${interrupted.runId}'
          BEGIN INSERT INTO review_recovery_checkpoints VALUES(json(NEW.snapshot)); END`,
        );
      const before = await snapshot(f);
      const held = boundary === 'before-publisher' ? await acquireWriterLock(f.databaseUrl) : undefined;
      let completed;
      try {
        completed = await resume(f, interrupted);
      } finally {
        await held?.release();
      }
      assert.equal(completed.status, boundary === 'before-publisher' ? 'suspended' : 'success');
      if (boundary === 'before-publisher')
        assert.deepEqual(await snapshot(f), before, 'The decision-only checkpoint must have no Knowledge effect');
      const captures = await sql(f, 'SELECT snapshot FROM review_recovery_checkpoints');
      const captured = captures.find(row => {
        const state = JSON.parse(row.snapshot!);
        return (
          state.status === 'running' &&
          state.context?.['review-decision']?.status === 'success' &&
          (boundary === 'before-publisher'
            ? !state.context?.['publish-review']
            : state.context?.['publish-review']?.status === 'success')
        );
      });
      assert.ok(captured, `Native storage must produce the ${boundary} running checkpoint`);
      const checkpoint = JSON.parse(captured.snapshot!);
      assert.deepEqual(checkpoint.context['review-decision'].output.decision, decision(interrupted.proposal));
      const restartPath = `/workflows/review/restart-async?runId=${interrupted.runId}`;
      assert.equal(
        (await post(f, restartPath, {})).status,
        403,
        'A later suspended or terminal state supersedes restart',
      );
      await f.stop();
      for (const operation of ['INSERT', 'UPDATE']) await sql(f, `DROP TRIGGER capture_review_${operation}`);
      // Restore the captured native commit after stopping its owner; never synthesize a workflow state.
      await sql(f, `UPDATE ${TABLE_WORKFLOW_SNAPSHOT} SET snapshot = jsonb(?) WHERE run_id = ?`, [
        captured.snapshot!,
        interrupted.runId,
      ]);
      await f.start();
      const restored = await inspect(f, interrupted.runId);
      assert.equal(restored.status, 'running');
      assert.deepEqual(restored.steps['review-decision'].output.decision, decision(interrupted.proposal));
      if (boundary === 'before-publisher') assert.equal(restored.steps['publish-review'], undefined);
      else assert.equal(restored.steps['publish-review'].status, 'success');
      const beforeRecovery = await snapshot(f);
      const priorEffects = beforeRecovery.filter(item =>
        item.page.body?.includes(`knowledge-review:${interrupted.proposal.id}:`),
      );
      assert.equal(priorEffects.length, boundary === 'before-publisher' ? 0 : 1);
      await credentials(f, true, [3]);
      assert.equal(
        (await post(f, restartPath, {}, 3)).status,
        403,
        'Another granted reviewer cannot recover the owner run',
      );
      await credentials(f, false);
      assert.equal((await post(f, restartPath, {})).status, 403, 'Recovery requires the current review grant');
      await credentials(f);
      assert.equal((await post(f, restartPath, { resumeData: decision(interrupted.proposal) })).status, 403);
      assert.deepEqual(await snapshot(f), beforeRecovery, 'Denied restart attempts must not change Knowledge');
      const recovered = await json(await post(f, restartPath, {}));
      assert.equal(recovered.status, 'success', JSON.stringify(recovered));
      const reference = `${interrupted.proposal.destination.scope}#${interrupted.proposal.destination.path}`;
      assert.equal(recovered.result.status, 'published');
      assert.equal(recovered.result.reference, reference);
      assert.deepEqual(recovered.result.decision, decision(interrupted.proposal));
      const afterRecovery = await snapshot(f);
      const effects = afterRecovery.filter(item =>
        item.page.body?.includes(`knowledge-review:${interrupted.proposal.id}:`),
      );
      assert.equal(effects.length, 1, 'Recovery across either native boundary produces one intended effect');
      assert.equal(effects[0]!.page.version, 1);
      assert.equal((await read(f, reference)).page.body, effects[0]!.page.body);
      if (boundary === 'after-publisher') {
        assert.equal(recovered.result.reference, completed.result.reference);
        assert.deepEqual(afterRecovery, beforeRecovery, 'Finalizing the completed publisher must not write again');
      }
      assert.equal((await inspect(f, interrupted.runId)).result.reference, reference);
      assert.equal((await post(f, restartPath, {})).status, 403, 'A settled run cannot be restarted');
    }

    const path = 'cases/note-limit';
    const { page } = await f.supportKnowledge.upsertPage({
      scope: customer,
      path,
      name: 'Case with a full note scan',
      author: 'synthetic-fixture',
    });
    const interruptedNote = await next(
      { action: 'note', target: { path, expectedVersion: page.version }, evidence: [] },
      freshInput,
    );
    for (let index = 0; index < 1001; index++)
      await f.supportKnowledge.addNote({ scope: customer, path, text: `Existing observation ${index}` });
    const noteRef = await interruptAndRecover(interruptedNote, undefined, () =>
      f.supportKnowledge.addNote({ scope: customer, path, text: 'An unrelated observation after the commit' }),
    );
    assert.equal(noteRef, `${customer}#${path}?note=${interruptedNote.proposal.id}`);
    const store = await f.supportKnowledge.getStorage();
    assert.deepEqual(await store.countNotes({ pageIds: [page.id], read: 'all' }), { [page.id]: 1003 });
  } finally {
    await f.close();
  }
});
