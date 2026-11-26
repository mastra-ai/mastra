import assert from 'node:assert/strict';
import test from 'node:test';
import { examples, selectProfile } from '../../src/examples/runtime.ts';
import { datasets } from '../../src/examples/datasets.ts';
import { seedDataset } from '../../src/mastra/knowledge/seed.ts';
import { resourceId } from '../../src/mastra/identity.ts';
import { encodeConfirmationReference } from '../../src/mastra/review/confirmation.ts';
import type { Candidate, Proposal } from '../../src/mastra/review/contracts.ts';
import { fixtureFetch, runtimeFixture, useLocalTestDatabase } from '../fixtures/runtime.ts';
import { history, json, latest, messages } from '../fixtures/demo.ts';

useLocalTestDatabase();

const guide = 'docs:helpdesk#guides/network-configuration';
const source = 'https://learn.microsoft.com/en-us/windows-server/administration/windows-commands/ipconfig';

test(
  'IT helpdesk uses configured evidence and attributed confirmation without Memory IDs',
  { timeout: 120000 },
  async () => {
    const example = examples['it-helpdesk']!;
    const profile = (id: string) => selectProfile(example, id);
    let candidate: Candidate = {
      action: 'page',
      target: null,
      title: 'Authorized connection check',
      content:
        'In the fictional case, the operator confirmed the active adapter and three checks succeeded after the authorized selection.',
      record: {
        topicTags: ['connectivity'],
        observedOn: '2026-11-20',
        state: 'approved',
        summary: 'An authorized check confirmed access in the fictional case.',
        applicability: 'Applies only when the operator has confirmed that the wrong adapter was selected.',
      },
      evidence: [],
      publicSource: null,
    };
    const f = await runtimeFixture({
      example: 'it-helpdesk',
      syntheticKnowledge: false,
      generatedCredentials: true,
      profiles: [
        profile('helpdesk-office'),
        profile('helpdesk-branch'),
        { ...profile('helpdesk-reviewer'), review: true },
        { ...profile('helpdesk-branch-reviewer'), review: true },
      ],
      modelScript: body => {
        const list = messages(body);
        assert.match(JSON.stringify(list), /locale en-US/u);
        if (list.some(message => message.content?.includes('Review one confirmed customer outcome'))) {
          const tools = list.filter(message => message.role === 'tool');
          if (!tools.length) return { tool: { name: 'knowledge_search', arguments: { query: 'adapter' } } };
          assert.doesNotMatch(JSON.stringify(tools), /HELPDESK_BRANCH|customer:helpdesk:branch|docs:|tenant:/u);
          return { content: JSON.stringify(candidate) };
        }
        const prepared = history(body);
        assert.equal(prepared.status, 'ready', 'Connection questions must select approved customer history');
        assert.ok(prepared.records.some(record => record.ref.includes('customer:helpdesk:office#')));
        assert.doesNotMatch(JSON.stringify(prepared), /branch/iu);
        const { tools } = latest(body);
        if (!tools.length) return { tool: { name: 'knowledge_read', arguments: { page: guide } } };
        assert.match(JSON.stringify(tools), /ipconfig/u);
        assert.match(JSON.stringify(tools), new RegExp(source.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')));
        assert.match(JSON.stringify(list), /policies\/helpdesk-safety/u);
        return { content: `The configuration check provides observations. See ${guide}. ${source}` };
      },
    });
    const request = (path: string, owner = 0, options: RequestInit = {}) =>
      path.startsWith('/support/')
        ? fixtureFetch(`${f.base}${path}`, {
            ...options,
            headers: {
              authorization: `Bearer ${f.credentials[owner]!.token}`,
              'content-type': 'application/json',
              ...options.headers,
            },
          })
        : f.request(path, owner, options);
    const post = (path: string, body: unknown, owner = 0) =>
      request(path, owner, { method: 'POST', body: JSON.stringify(body) });
    const newThread = async (owner = 0) =>
      (
        await json(
          await post(
            '/memory/threads?agentId=support',
            { resourceId: resourceId(f.credentials[owner]!.profile) },
            owner,
          ),
        )
      ).id as string;
    const review = async (input: unknown, owner = 2) => {
      const { runId } = await json(await post('/workflows/review/create-run', {}, owner));
      const state = await json(await post(`/workflows/review/start-async?runId=${runId}`, { inputData: input }, owner));
      return { runId, state };
    };
    try {
      const seeded = await seedDataset(datasets['it-helpdesk']!, { databaseUrl: f.databaseUrl });
      assert.equal(seeded.pages.length, 4);
      const repeated = await seedDataset(datasets['it-helpdesk']!, { databaseUrl: f.databaseUrl });
      assert.deepEqual(
        repeated.pages.map(page => [page.id, page.status]),
        seeded.pages.map(page => [page.id, 'unchanged']),
      );
      await f.start();
      const threadId = await newThread();
      const response = await json(
        await post('/agents/support/generate', {
          messages: [
            { role: 'user', content: 'I need to investigate a Windows network CONNECTION. What should I check?' },
          ],
          memory: { thread: threadId },
        }),
      );
      assert.match(response.text, /configuration check/u);
      const confirmation = {
        threadId,
        observation:
          'The operator identified the active adapter in a local configuration check.\nOutcome: operator note.',
        outcome: 'After the authorized selection, three checks confirmed access in the fictional case. \n',
      };
      const before = f.model.requests.length;
      const created = await json(await post('/support/confirmations', confirmation), 201);
      assert.deepEqual(Object.keys(created), ['confirmationReference']);
      assert.ok(created.confirmationReference.length < 1000);
      assert.equal(f.model.requests.length, before, 'Confirmation persistence does not invoke a model');
      const memoryStore = await f.storage.getStore('memory');
      const persisted = (
        await memoryStore!.listMessages({ threadId, resourceId: resourceId(f.credentials[0]!.profile), perPage: 100 })
      ).messages.find(message => message.content.metadata?.supportConfirmation);
      assert.ok(persisted);
      assert.equal((persisted.content.metadata!.supportConfirmation as { sourceActorId: string }).sourceActorId, 'ana');
      assert.equal(
        (persisted.content.metadata!.supportConfirmation as { outcome: string }).outcome,
        confirmation.outcome.trim(),
      );
      assert.equal(
        persisted.content.parts
          .filter(part => part.type === 'text')
          .map(part => part.text)
          .join('\n')
          .endsWith(confirmation.outcome.trim()),
        true,
      );
      for (const body of [
        {},
        { ...confirmation, sourceActorId: 'bruno' },
        { ...confirmation, outcome: '' },
        { ...confirmation, metadata: {} },
      ])
        assert.deepEqual(await json(await post('/support/confirmations', body), 400), {
          error: 'Invalid confirmation',
        });
      assert.deepEqual(await json(await request('/support/confirmations', 0, { method: 'POST', body: '{' }), 400), {
        error: 'Invalid confirmation',
      });
      for (const owner of [1, 2]) assert.equal((await post('/support/confirmations', confirmation, owner)).status, 403);
      const branchThread = await newThread(1);
      assert.equal((await post('/support/confirmations', { ...confirmation, threadId: branchThread })).status, 403);
      assert.equal((await request('/support/confirmations')).status, 403);
      assert.equal((await post('/support/confirmations?actorId=bruno', confirmation)).status, 403);
      assert.equal(
        (
          await fixtureFetch(`${f.base}/support/confirmations`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(confirmation),
          })
        ).status,
        401,
      );
      const input = { confirmationReference: created.confirmationReference, audience: 'private' };
      const foreign = await review(input, 3);
      assert.equal(foreign.state.status, 'failed');
      assert.equal(f.model.requests.length, before, 'Foreign ownership fails before any evidence reaches the curator');
      const pending = await review(input);
      assert.equal(pending.state.status, 'suspended', JSON.stringify(pending.state));
      const curatorInput = messages(f.model.requests[before]!)
        .filter(message => message.role === 'user')
        .map(message => JSON.parse(message.content ?? '{}'))
        .find(message => message.audience === 'private');
      assert.deepEqual(curatorInput?.confirmation, {
        observation: confirmation.observation,
        outcome: confirmation.outcome.trim(),
      });
      const snapshot = await json(await f.request(`/workflows/review/runs/${pending.runId}`, 2));
      const proposal = snapshot.steps['review-decision'].suspendPayload as Proposal;
      assert.equal(proposal.source.sourceActorId, 'ana');
      assert.equal(proposal.source.threadId, threadId);
      assert.match(proposal.source.confirmation, /three checks/u);
      assert.ok(proposal.source.confirmation.endsWith(confirmation.outcome.trim()));
      assert.equal(proposal.reviewer.actorId, 'davi');
      const outcome = await json(
        await post(
          `/workflows/review/resume-async?runId=${pending.runId}`,
          {
            step: 'review-decision',
            resumeData: {
              decision: 'approve',
              revision: proposal.revision,
              reason: 'Verified the attributed fictional observation and applicability.',
            },
          },
          2,
        ),
      );
      assert.equal(outcome.result.status, 'published', JSON.stringify(outcome));
      const published = await json(
        await f.request(`/knowledge/support/pages/${encodeURIComponent(outcome.result.reference)}`),
      );
      assert.match(JSON.stringify(published), /Source technician: ana/u);
      assert.equal(
        (await f.request(`/knowledge/support/pages/${encodeURIComponent(outcome.result.reference)}`, 1)).status,
        404,
      );
      candidate = {
        ...candidate,
        title: 'Observation pending independent review',
        content:
          'A separate fictional observation that must stay out of published Knowledge if the reviewer rejects it.',
      };
      const rejected = await review(input);
      assert.equal(rejected.state.status, 'suspended');
      const rejectedSnapshot = await json(await f.request(`/workflows/review/runs/${rejected.runId}`, 2));
      const rejectedProposal = rejectedSnapshot.steps['review-decision'].suspendPayload as Proposal;
      const decision = await json(
        await post(
          `/workflows/review/resume-async?runId=${rejected.runId}`,
          {
            step: 'review-decision',
            resumeData: {
              decision: 'reject',
              revision: rejectedProposal.revision,
              reason: 'The observation does not establish a reusable procedure.',
            },
          },
          2,
        ),
      );
      assert.equal(decision.result.status, 'rejected');
      assert.equal(
        (
          await f.request(
            `/knowledge/support/pages/${encodeURIComponent(`${rejectedProposal.destination.scope}#${rejectedProposal.destination.path}`)}`,
          )
        ).status,
        404,
      );
      // A guessed locator is never sufficient: it must point to the server-attributed stored turn.
      const forged = encodeConfirmationReference({
        threadId,
        messageId: persisted.id as `${string}-${string}-${string}-${string}-${string}`,
        sourceActorId: 'bruno',
      });
      const count = f.model.requests.length;
      assert.equal((await review({ ...input, confirmationReference: forged })).state.status, 'failed');
      assert.equal(f.model.requests.length, count);
    } catch (error) {
      console.error(f.output());
      throw error;
    } finally {
      await f.close();
    }
  },
);
