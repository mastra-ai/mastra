import { InMemoryStore } from '@mastra/core/storage';
import type { KnowledgeRecord, KnowledgeScope } from '@mastra/core/storage';
import { RequestContext } from '@mastra/core/request-context';
import type { MastraEmbeddingModel, MastraVector } from '@mastra/core/vector';
import { describe, expect, it } from 'vitest';

import { Memory, Subconscious } from '../../../index';

/**
 * Real-model eval of what the curator saves from a noisy work transcript, modeled on a dogfooding
 * run where a service survey produced a work log instead of knowledge. It calls a live provider, so
 * it only runs when opted in: `RUN_CURATOR_EVAL=1` with `ANTHROPIC_API_KEY` set.
 */
const runEval = process.env.RUN_CURATOR_EVAL === '1' && !!process.env.ANTHROPIC_API_KEY;

const NOISY_OBSERVATIONS = `Date: Oct 8, 2026
* 🟡 (21:02) Progress update: service survey phase 2 of 3 complete. SURVEY COMPLETION STATUS: 80% done, 4 of 5 services checked.
* 🟡 (21:03) Work item FAC-1234 is at revision 2; the agent's move of the card to the Review stage was rejected.
* 🟡 (21:05) launchctl list shows com.acme.gateway running as PID 48213; its last exit code was 78.
* 🟡 (21:06) The gateway is launched with the node binary at /var/folders/xy/T/fnm_multishells/48213_1791406437841/bin/node.
* 🟡 (21:07) The agent opened inspector port 9229 to debug the gateway; it will be closed after debugging.
* 🟡 (21:09) The agent web-searched "orbit-cache", found no matching open-source project, and concluded orbit-cache is definitively a bespoke tool.
* 🔴 (21:12) User stated: the payments gateway serves HTTPS on port 8443 behind Caddy, and the platform team owns it.`;

const TRANSIENT = [
  'progress',
  'completion status',
  'phase 2',
  'fac-1234',
  'revision 2',
  'review stage',
  '48213',
  'exit code',
  'fnm_multishells',
  '/var/folders',
  '9229',
  'bespoke',
];

const scope: KnowledgeScope = ['org:acme', 'resource:user-42', 'thread:alpha'];

const vector = {
  createIndex: async () => {},
  upsert: async ({ ids }: { ids?: string[] }) => ids ?? [],
  query: async () => [],
  deleteVector: async () => {},
  deleteVectors: async () => {},
  describeIndex: async () => ({ dimension: 4, count: 0, metric: 'cosine' }),
  listIndexes: async () => [],
} as unknown as MastraVector;

const embedder = {
  specificationVersion: 'v2',
  provider: 'eval',
  modelId: 'deterministic-embedding',
  maxEmbeddingsPerCall: 128,
  supportsParallelCalls: true,
  doEmbed: async ({ values }: { values: string[] }) => ({ embeddings: values.map(() => [0.1, 0.2, 0.3, 0.4]) }),
} as unknown as MastraEmbeddingModel<string>;

describe.skipIf(!runEval)('Subconscious curator on a noisy transcript (live model)', () => {
  it('saves the durable fact and none of the progress, IDs, PIDs, temp paths, or guesses', async () => {
    const memory = new Memory({ storage: new InMemoryStore(), vector, embedder });
    const subconscious = new Subconscious({ defaultScope: 'resource', model: 'anthropic/claude-haiku-4-5' });
    const curate = subconscious
      .createObservationExtractors('anthropic/claude-haiku-4-5', () => memory)
      .find(extractor => extractor.name === 'Curate')!;
    const requestContext = new RequestContext();
    requestContext.set('organizationId', 'acme');

    await curate.onExtracted!({
      source: 'observer',
      extractor: curate,
      threadId: 'alpha',
      resourceId: 'user-42',
      current: NOISY_OBSERVATIONS,
      rawObservations: NOISY_OBSERVATIONS,
      memory,
      requestContext,
      observationCommitted: Promise.resolve(true),
    } as any);
    await subconscious.settled();

    const store = (await memory.storage.getStore('knowledge'))!;
    const nodes = await store.listNodes({ scope, limit: 100 });
    const records: KnowledgeRecord[] = [];
    for (const node of nodes) {
      records.push(...(await store.listKnowledgeAbout({ node, scope, limit: 100 })).records);
    }
    const saved = [
      ...nodes.map(node => `${node.name}\n${node.description ?? ''}\n${node.content ?? ''}`),
      ...records.map(record => record.text),
    ].join('\n---\n');
    console.info(`Curator saved ${nodes.length} nodes and ${records.length} records:\n${saved}`);

    expect(records.map(record => record.text).join('\n')).toContain('8443');
    for (const transient of TRANSIENT) {
      expect(saved.toLocaleLowerCase(), `saved transient detail "${transient}"`).not.toContain(transient);
    }
    for (const node of nodes) {
      expect(node.name).not.toMatch(/\d{4}-\d{2}-\d{2}/);
    }
  }, 180_000);
});
