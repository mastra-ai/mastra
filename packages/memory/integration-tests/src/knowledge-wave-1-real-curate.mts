import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Knowledge } from '@mastra/core/knowledge';
import { Mastra } from '@mastra/core/mastra';
import { RequestContext } from '@mastra/core/request-context';
import { LibSQLStore } from '@mastra/libsql';
import { Memory, Subconscious } from '@mastra/memory';

// Linked built-package consumer; never logs prompts, responses, credentials, or local database paths.
assert(process.env.OPENAI_API_KEY, 'OPENAI_API_KEY is required for the real-provider proof');
const directory = await mkdtemp(join(tmpdir(), 'knowledge-real-curate-'));
const url = `file:${join(directory, 'proof.db')}`;
const scope = ['org:acme', 'resource:shipyard'];
const model = 'openai/gpt-5-mini';
let storage = new LibSQLStore({ id: 'real-curate', url });
let memory: Memory | undefined;
let failure: unknown;
try {
  for (const [entry, expected] of [
    ['@mastra/core/knowledge', '/packages/core/dist/knowledge/'],
    ['@mastra/memory', '/packages/memory/dist/'],
    ['@mastra/libsql', '/stores/libsql/dist/'],
  ] as const) {
    assert(import.meta.resolve(entry).includes(expected), 'Consumer must resolve linked built packages');
  }
  const knowledge = new Knowledge({
    id: 'mastra',
    storage,
    structure: {
      scopes: [
        { address: 'org:acme', name: 'Acme' },
        { address: 'resource:shipyard', name: 'Shipyard', parentAddresses: ['org:acme'] },
      ],
    },
  });
  memory = new Memory({
    storage,
    knowledge: 'mastra',
    options: {
      observationalMemory: {
        enabled: true,
        model,
        observation: { messageTokens: 1, bufferTokens: false },
        experimental_subconscious: new Subconscious({
          observation: [
            {
              name: 'curate',
              model,
              instructions:
                'For this bounded synthetic proof, create exactly one feature node named "Atlas refund launch" using knowledge_create, with one record: "[[Maya Chen]] owns the [[Atlas refund launch]]." Use resource scope. Do not create other nodes or records. Verify existing evidence first; do not duplicate it.',
            },
          ],
        }),
      },
    },
  });
  const mastra = new Mastra({ knowledge: { mastra: knowledge }, memory: { default: memory }, logger: false });
  assert.equal(mastra.getKnowledge('mastra'), knowledge);
  await knowledge.reconcile();
  const threadId = randomUUID();
  await memory.createThread({ threadId, resourceId: 'shipyard', title: 'Synthetic curation proof' });
  await memory.saveMessages({
    messages: [
      {
        id: randomUUID(),
        threadId,
        resourceId: 'shipyard',
        role: 'user',
        createdAt: new Date(),
        content: {
          format: 2,
          parts: [
            {
              type: 'text',
              text: 'Confirmed durable project fact: Maya Chen owns the Atlas refund launch. Remember this ownership for future work.',
            },
          ],
        },
      },
    ],
  });
  const requestContext = new RequestContext();
  requestContext.set('organizationId', 'acme');
  const observed = await (await memory.omEngine)!.observe({ threadId, resourceId: 'shipyard', requestContext });
  assert(observed.observed, 'Observer must process the synthetic message');
  await memory.settled();
  const node = await knowledge.resolveNode({ name: 'Atlas refund launch', scope });
  assert(node, 'Curator must create the expected feature');
  assert.equal(node.kind, 'feature');
  const records = (await knowledge.listKnowledgeAbout({ node: node.id, scope })).records;
  assert.equal(records.length, 1);
  assert.equal(records[0]!.text, '[[Maya Chen]] owns the [[Atlas refund launch]].');
  assert.equal(records[0]!.sourceThreadId, threadId);
  assert(records[0]!.capturedAt instanceof Date);
  assert.deepEqual(records[0]!.scope, scope);
  assert.deepEqual(node.scope, scope);
  const activity = await knowledge.listActivity({ scope, limit: 100 });
  assert(
    activity.some(
      event =>
        event.action === 'node-created' &&
        event.recordId === node.id &&
        JSON.stringify(event.scope) === JSON.stringify(scope),
    ),
  );
  assert(
    activity.some(
      event =>
        event.action === 'record-created' &&
        event.recordId === records[0]!.id &&
        event.sourceThreadId === threadId &&
        JSON.stringify(event.scope) === JSON.stringify(scope),
    ),
  );
  memory = undefined;
  await storage.close();
  storage = new LibSQLStore({ id: 'real-curate-reopened', url });
  const restartedKnowledge = new Knowledge({ id: 'mastra', storage });
  memory = new Memory({ storage, knowledge: 'mastra', options: { observationalMemory: false } });
  const restartedMastra = new Mastra({
    knowledge: { mastra: restartedKnowledge },
    memory: { default: memory },
    logger: false,
  });
  const reopened = restartedMastra.getKnowledge('mastra');
  assert.equal(await memory.getKnowledgeStore(), await reopened.getStorage());
  assert.equal((await reopened.resolveNode({ name: 'Atlas refund launch', scope }))?.id, node.id);
  assert.equal((await reopened.listKnowledgeAbout({ node: node.id, scope })).records[0]?.id, records[0]!.id);
  console.log(
    JSON.stringify({
      model,
      observationTimeCuration: true,
      keyedRuntime: true,
      records: 1,
      provenance: true,
      activity: true,
      settledBeforeClose: true,
      restart: true,
    }),
  );
} catch (error) {
  failure = error;
} finally {
  for (const cleanup of [
    () => memory?.settled(),
    () => storage.close(),
    () => rm(directory, { recursive: true, force: true }),
  ]) {
    try {
      await cleanup();
    } catch (error) {
      failure ??= error;
    }
  }
}
if (failure) throw failure;
console.log('PROOF: GREEN — real-provider observation-time curation and durable restart');
