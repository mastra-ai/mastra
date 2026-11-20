import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { setTimeout } from 'node:timers/promises';
import { promisify } from 'node:util';
import { test } from 'node:test';
import { TABLE_WORKFLOW_SNAPSHOT } from '@mastra/core/storage';
import { runtimeFixture } from '../fixtures/runtime.ts';
import { resourceId } from '../../src/mastra/identity.ts';
import { acquireWriterLock } from '../../src/mastra/knowledge/writer-lock.ts';
import type { Candidate, Proposal } from '../../src/mastra/review/contracts.ts';

type Fixture = Awaited<ReturnType<typeof runtimeFixture>>;
type Message = { role: string; content?: string };
const execute = promisify(execFile);
const customer = 'customer:north:store-1';
const evidence = `${customer}#cases/synthetic`;
const publicRef = 'docs:north#public-network-guide';
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
async function fixture() {
  let selected = candidate('initial');
  let sharedRead: string | undefined;
  const f = await runtimeFixture({
    modelScript: body => {
      const list = messages(body);
      const curator = list.some(message =>
        JSON.stringify(message.content).includes('Review one confirmed customer outcome'),
      );
      const tools = list.filter(message => message.role === 'tool');
      if (curator) {
        const definitions = body.tools as Array<{ function: { name: string } }>;
        assert.deepEqual(definitions.map(tool => tool.function.name).sort(), [
          'knowledge_list',
          'knowledge_read',
          'knowledge_search',
        ]);
        if (!tools.length) return { tool: { name: 'knowledge_search', arguments: { query: 'SYNTHETIC' } } };
        if (tools.length === 1) return { tool: { name: 'knowledge_read', arguments: { page: evidence } } };
        if (tools.length === 2)
          return { tool: { name: 'knowledge_read', arguments: { page: 'customer:north:store-2#cases/synthetic' } } };
        if (
          tools.length === 3 &&
          selected.evidence[0]?.ref.startsWith(`${customer}#`) &&
          selected.evidence[0].ref !== evidence
        )
          return { tool: { name: 'knowledge_read', arguments: { page: selected.evidence[0].ref } } };
        const results = tools.map(tool => tool.content).join('\n');
        if (selected.evidence.some(item => item.ref === evidence)) assert.match(results, /SYNTHETIC_PRIVATE_0/u);
        if (tools.length > 3) assert.match(tools.at(-1)!.content!, /Reviewed by: morgan/u);
        assert.doesNotMatch(
          results,
          /SYNTHETIC_PRIVATE_[1245]|SYNTHETIC_DOC_|SYNTHETIC_FOREIGN|docs:north|tenant:north/u,
        );
        assert.match(tools[2]!.content!, /denied|not found|not readable|scope|access/iu);
        return { content: JSON.stringify(selected) };
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
  f.credentials.push({
    ...f.credentials[3]!,
    token: randomBytes(32).toString('base64url'),
    profile: { ...f.credentials[3]!.profile, id: 'north-reviewer', actorId: 'morgan' },
  });
  await credentials(f);
  await f.supportKnowledge.upsertPage({
    scope: 'docs:north',
    path: 'public-network-guide',
    name: 'Synthetic public network guide',
    body: `Synthetic guide: inspect Ethernet cabling.\nSource: ${publicUrl}\nVerified: 2026-11-20`,
    author: 'seed:synthetic',
  });
  return Object.assign(f, {
    select(value: Candidate) {
      selected = value;
    },
    shared(value: string) {
      sharedRead = value;
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
async function confirmation(f: Fixture, owner = 0) {
  const id = await thread(f, owner);
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
    for (const page of batch.pages)
      all.push({ page, notes: await store.listNotes({ pageId: page.id, read: 'all', limit: 100 }) });
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

test('approval_publishes_scoped_content_and_a_new_thread_reuses_knowledge', { timeout: 180000 }, async () => {
  const f = await fixture();
  try {
    await f.start();
    const input = await confirmation(f);
    const before = await snapshot(f);
    f.select(candidate('private-page'));
    const run = await pending(f, input);
    assert.deepEqual(await snapshot(f), before, 'Suspension cannot write Knowledge');
    await f.stop();
    await f.start();
    assert.deepEqual((await inspect(f, run.runId)).steps['review-decision'].suspendPayload, run.proposal);
    const result = await resume(f, run);
    assert.equal(result.result.status, 'published');
    const reference = result.result.reference as string;
    const published = JSON.stringify(await read(f, reference));
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
      }),
    );
    const update = await pending(f, input);
    assert.equal((await resume(f, update)).result.reference, reference);
    const updated = (await snapshot(f)).find(item => item.page.id === page.id)!.page;
    assert.equal(updated!.version, page.version + 1);
    assert.match(updated!.body!, /Finding private-update/u);

    f.select(candidate('sanitized-shared', { publicSource: { ref: publicRef, version: 1 } }));
    const shared = await pending(f, { ...input, audience: 'tenant' });
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
    assert.doesNotMatch(captured, /Source technician: alex|SYNTHETIC_PRIVATE_[1245]/u);
    assert.ok(!captured.includes(input.threadId) && !captured.includes(input.messageId));
    const audit = await inspect(f, shared.runId);
    assert.deepEqual(audit.steps['review-decision'].output.decision, decision(shared.proposal));
    assert.deepEqual(audit.steps['review-decision'].output.proposal.candidate, shared.proposal.candidate);
  } finally {
    await f.close();
  }
});

test('review_rejects_unsafe_resumes_and_recovers_publication_once', { timeout: 240000 }, async () => {
  const f = await fixture();
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
    for (const [changes, source] of [
      [{ evidence: [{ ref: 'customer:north:store-2#cases/synthetic', version: 1 }] }, input],
      [{ evidence: [{ ref: `${customer}#cases/missing`, version: 1 }] }, input],
      [{ action: 'update', target: { path: 'cases/synthetic', expectedVersion: 1 } }, input],
      [
        { content: 'Private store-1 information', publicSource: { ref: publicRef, version: 1 } },
        { ...input, audience: 'tenant' },
      ],
      [
        { content: 'password=synthetic-secret', publicSource: { ref: publicRef, version: 1 } },
        { ...input, audience: 'tenant' },
      ],
      [{ publicSource: null }, { ...input, audience: 'tenant' }],
      [{}, { ...input, sourceActorId: 'morgan' }],
      [{}, { ...input, messageId: 'missing-turn' }],
      [{}, await confirmation(f, 1)],
    ] as Array<[Partial<Candidate>, typeof input]>) {
      await unchanged(async () => {
        f.select(candidate(`invalid-${++serial}`, changes));
        const run = await begin(f, source);
        assert.equal(run.state.status, 'failed', JSON.stringify(run.state));
      });
    }

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
    const lock = await acquireWriterLock();
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
    const concurrent = await Promise.all(
      [0, 1].map(() =>
        post(f, `/workflows/review/resume-async?runId=${busy.runId}`, {
          step: ['publish-review'],
          resumeData: decision(busy.proposal),
        }),
      ),
    );
    assert.ok(concurrent.some(response => response.status === 200));
    await Promise.all(concurrent.map(response => response.text()));
    const completed = await inspect(f, busy.runId);
    assert.equal(completed.result.status, 'published', JSON.stringify(completed));
    const effects = (await snapshot(f)).filter(item =>
      item.page.body?.includes(`knowledge-review:${busy.proposal.id}:`),
    );
    assert.equal(effects.length, 1);
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
      const held = await acquireWriterLock();
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
      assert.ok(replies.some(reply => reply.status === 200));
      await Promise.all(replies.map(reply => reply.text()));
      const finished = await inspect(f, racing.runId);
      assert.equal(finished.result.status, 'published', JSON.stringify(finished));
      assert.equal(
        (await snapshot(f)).filter(item => item.page.body?.includes(`knowledge-review:${racing.proposal.id}:`)).length,
        1,
      );
      assert.equal(
        finished.result.reference,
        `${racing.proposal.destination.scope}#${racing.proposal.destination.path}`,
      );
    }

    // Reject terminal snapshot persistence after the actual Knowledge write. The last durable
    // publication checkpoint remains running, so the next process must reconcile that effect.
    async function interruptAndRecover(interrupted: Awaited<ReturnType<typeof next>>, expectedVersion: number) {
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
        resumeData: decision(interrupted.proposal),
      }).catch(() => undefined);
      let written: Awaited<ReturnType<typeof snapshot>> = [];
      for (let attempt = 0; attempt < 100; attempt++) {
        written = (await snapshot(f)).filter(item =>
          item.page.body?.includes(`knowledge-review:${interrupted.proposal.id}:`),
        );
        if (written.length) break;
        await setTimeout(100);
      }
      assert.equal(written.length, 1, 'Native write must precede the injected audit failure');
      assert.equal(
        written[0]!.page.version,
        expectedVersion,
        'The native publication must increment the version exactly once',
      );
      // Wait for the native run to finish trying its terminal checkpoint. Core can suppress
      // persistence errors with logging disabled; the durable checkpoint must still be running.
      const transport = await request;
      assert.ok(transport);
      const transportBody = await transport.text();
      assert.match(transportBody, /published|synthetic terminal audit outage/u);
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
      // This child really owns the lock, then exits without releasing it. Awaiting execFile
      // proves the owner stopped before recovery is permitted to remove the stale lock.
      const stoppedWriter = await execute(
        process.execPath,
        [
          '--input-type=module',
          '-e',
          "const { acquireWriterLock } = await import('./src/mastra/knowledge/writer-lock.ts'); const lock = await acquireWriterLock(); console.log(lock.lockPath);",
        ],
        { timeout: 10000 },
      );
      const staleLock = stoppedWriter.stdout.trim();
      assert.ok(JSON.parse(await readFile(staleLock, 'utf8')).pid > 0);
      await f.start();
      const beforeRetry = await snapshot(f);
      assert.equal(
        (await post(f, `/workflows/review/restart-async?runId=${interrupted.runId}`, { inputData: {} })).status,
        403,
      );
      const recovered = await json(await post(f, `/workflows/review/restart-async?runId=${interrupted.runId}`, {}));
      assert.deepEqual(await snapshot(f), beforeRetry, 'Recovery must preserve the single original page and version');
      assert.equal(
        recovered.status,
        'success',
        JSON.stringify({ runId: interrupted.runId, status: recovered.status, error: recovered.error }),
      );
      assert.equal(recovered.result.status, 'published', JSON.stringify(recovered));
      const originalRef = `${interrupted.proposal.destination.scope}#${interrupted.proposal.destination.path}`;
      assert.equal(recovered.result.reference, originalRef);
      await assert.rejects(readFile(staleLock), { code: 'ENOENT' });
      assert.equal((await inspect(f, interrupted.runId)).result.reference, originalRef);
      assert.equal(
        (await inspect(f, interrupted.runId)).steps['review-decision'].output.proposal.id,
        interrupted.proposal.id,
      );
      return originalRef;
    }
    const interrupted = await next({ evidence: [] }, freshInput);
    const originalRef = await interruptAndRecover(interrupted, 1);
    const original = (await snapshot(f)).find(item =>
      item.page.body?.includes(`knowledge-review:${interrupted.proposal.id}:`),
    )!.page;
    const interruptedUpdate = await next(
      {
        action: 'update',
        target: { path: interrupted.proposal.destination.path, expectedVersion: original.version },
        evidence: [{ ref: originalRef, version: original.version }],
      },
      freshInput,
    );
    assert.equal(await interruptAndRecover(interruptedUpdate, original.version + 1), originalRef);

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
      const held = boundary === 'before-publisher' ? await acquireWriterLock() : undefined;
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
  } finally {
    await f.close();
  }
});
