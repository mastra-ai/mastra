import assert from 'node:assert/strict';
import test from 'node:test';
import { examples, selectProfile } from '../../src/examples/runtime.ts';
import { datasets } from '../../src/examples/datasets.ts';
import { seedDataset } from '../../src/mastra/knowledge/seed.ts';
import { resourceId } from '../../src/mastra/identity.ts';
import { encodeConfirmationReference } from '../../src/mastra/review/confirmation.ts';
import type { Candidate, Proposal } from '../../src/mastra/review/contracts.ts';
import { runtimeFixture } from '../fixtures/runtime.ts';
import { history, json, latest, messages } from '../fixtures/demo.ts';

const guide = 'docs:helpdesk#guides/network-configuration';
const source = 'https://learn.microsoft.com/pt-br/windows-server/administration/windows-commands/ipconfig';

test(
  'Portuguese helpdesk uses configured evidence and attributed confirmation without Memory IDs',
  { timeout: 120000 },
  async () => {
    const example = examples['it-helpdesk']!;
    const profile = (id: string) => selectProfile(example, id);
    let candidate: Candidate = {
      action: 'page',
      target: null,
      title: 'Verificação autorizada de conexão',
      content:
        'No cenário fictício, o operador confirmou o adaptador ativo e três verificações tiveram sucesso após seleção autorizada.',
      record: {
        topicTags: ['connectivity'],
        observedOn: '2026-11-20',
        state: 'approved',
        summary: 'Verificação autorizada confirmou acesso no cenário fictício.',
        applicability: 'Somente seleção de adaptador incorreta e confirmada pelo operador.',
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
        assert.match(JSON.stringify(list), /pt-BR/u);
        if (list.some(message => message.content?.includes('Review one confirmed customer outcome'))) {
          const tools = list.filter(message => message.role === 'tool');
          if (!tools.length) return { tool: { name: 'knowledge_search', arguments: { query: 'seleção' } } };
          assert.doesNotMatch(JSON.stringify(tools), /HELPDESK_BRANCH|docs:|tenant:/u);
          return { content: JSON.stringify(candidate) };
        }
        const prepared = history(body);
        assert.equal(prepared.status, 'ready', 'Accented Portuguese topics must select approved customer history');
        assert.ok(prepared.records.some(record => record.ref.includes('customer:helpdesk:office#')));
        assert.doesNotMatch(JSON.stringify(prepared), /branch|Filial/u);
        const { tools } = latest(body);
        if (!tools.length) return { tool: { name: 'knowledge_read', arguments: { page: guide } } };
        assert.match(JSON.stringify(tools), /ipconfig/u);
        assert.match(JSON.stringify(tools), new RegExp(source.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')));
        assert.match(JSON.stringify(list), /policies\/helpdesk-safety/u);
        return { content: `A consulta fornece observações, sem determinar a causa. Fonte: ${guide}. ${source}` };
      },
    });
    const request = (path: string, owner = 0, options: RequestInit = {}) =>
      path.startsWith('/support/')
        ? fetch(`${f.base}${path}`, {
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
      const seeded = await seedDataset(datasets['it-helpdesk']!);
      assert.equal(seeded.pages.length, 4);
      assert.ok((await seedDataset(datasets['it-helpdesk']!)).pages.every(page => page.status === 'unchanged'));
      await f.start();
      const threadId = await newThread();
      const response = await json(
        await post('/agents/support/generate', {
          messages: [{ role: 'user', content: 'Preciso investigar uma CONEXÃO e sua configuração.' }],
          memory: { thread: threadId },
        }),
      );
      assert.match(response.text, /observações/u);
      const confirmation = {
        threadId,
        observation: 'O operador identificou o adaptador ativo na consulta local.',
        outcome: 'Após seleção autorizada, três verificações confirmaram acesso no cenário fictício. \n',
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
        { ...confirmation, sourceActorId: 'bruno' },
        { ...confirmation, outcome: '' },
        { ...confirmation, metadata: {} },
      ])
        assert.equal((await post('/support/confirmations', body)).status, 403);
      for (const owner of [1, 2]) assert.equal((await post('/support/confirmations', confirmation, owner)).status, 403);
      const branchThread = await newThread(1);
      assert.equal((await post('/support/confirmations', { ...confirmation, threadId: branchThread })).status, 403);
      assert.equal((await request('/support/confirmations')).status, 403);
      assert.equal((await post('/support/confirmations?actorId=bruno', confirmation)).status, 403);
      assert.equal(
        (
          await fetch(`${f.base}/support/confirmations`, {
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
      const snapshot = await json(await f.request(`/workflows/review/runs/${pending.runId}`, 2));
      const proposal = snapshot.steps['review-decision'].suspendPayload as Proposal;
      assert.equal(proposal.source.sourceActorId, 'ana');
      assert.equal(proposal.source.threadId, threadId);
      assert.match(proposal.source.confirmation, /três verificações/u);
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
        title: 'Observação que não deve ser publicada',
        content: 'Registro fictício distinto que aguarda revisão independente e não deve ser publicado após rejeição.',
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
