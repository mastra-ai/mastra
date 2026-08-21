import { Agent } from '@mastra/core/agent';
import { RequestContext } from '@mastra/core/request-context';
import { InMemoryStore } from '@mastra/core/storage';
import type { MastraEmbeddingModel, MastraVector } from '@mastra/core/vector';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { Memory, Subconscious } from '../../../index';
import { armConfigHash, assertArmsComparable, buildArmSubconscious, replayCycles } from '../simulate/drive';
import type { ArmConfig } from '../simulate/drive';
import type { ReconstructedCycle } from '../simulate/reconstruct';

const semanticInfrastructure = {
  vector: {} as MastraVector,
  embedder: {} as MastraEmbeddingModel<string>,
};

const arm: ArmConfig = {
  name: 'a',
  prompts: { capture: 'Prefer durable facts.' },
  curationCadence: 1,
  defaultScope: 'resource',
  maxScope: 'resource',
  curateMaxSteps: 10,
};

function createMemory(options?: { subconscious?: Subconscious | undefined; omModel?: string | false }) {
  const subconscious = 'subconscious' in (options ?? {}) ? options?.subconscious : buildArmSubconscious(arm);
  return new Memory({
    storage: new InMemoryStore(),
    ...semanticInfrastructure,
    options: {
      observationalMemory: {
        ...(options?.omModel === false ? {} : { model: options?.omModel ?? 'openai/om-model' }),
        ...(subconscious ? { experimental_subconscious: subconscious } : {}),
      },
    },
  });
}

function cycles(count = 1): ReconstructedCycle[] {
  return Array.from({ length: count }, (_, index) => ({
    observations: `* The team shipped milestone ${index}.`,
    observedAt: new Date(`2026-08-0${index + 1}T00:00:00.000Z`),
    generationCount: 0,
    source: 'boundary' as const,
  }));
}

function captureAgent(calls: RequestContext[] = []) {
  return {
    generate: vi.fn(async (_prompt: string, options?: { requestContext?: RequestContext }) => {
      if (options?.requestContext) calls.push(options.requestContext);
      return {
        object: {
          nodes: [
            {
              name: 'Project Atlas',
              kind: 'project',
              records: [{ text: 'Atlas milestone shipped.', reason: 'Stated directly in the conversation.' }],
            },
          ],
        },
      };
    }),
  } as never;
}

function curatorAlwaysCompletes() {
  return vi.spyOn(Agent.prototype, 'generate').mockImplementation(async function (this: Agent, ...args: unknown[]) {
    const prompt = typeof args[0] === 'string' ? args[0] : '';
    const ids = [...prompt.matchAll(/"id":"([^"]+)"/g)].map(match => match[1]);
    return { text: ids.length ? `<curation-complete through="${ids.at(-1)}" />` : 'nothing to do' } as never;
  });
}

function run(memory: Memory, overrides: Partial<Parameters<typeof replayCycles>[0]> = {}) {
  return replayCycles({
    cycles: cycles(),
    threadId: 'alpha',
    resourceId: 'user-42',
    organizationId: 'acme',
    memory: memory as never,
    subconscious: buildArmSubconscious(arm),
    captureAgent: captureAgent(),
    curationCadence: 1,
    ...overrides,
  });
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('replayCycles', () => {
  it('captures knowledge from each cycle and advances the curation cursor', async () => {
    const memory = createMemory();
    curatorAlwaysCompletes();

    const result = await run(memory, { cycles: cycles(2) });

    expect(result.cyclesReplayed).toBe(2);
    const store = (await memory.storage.getStore('knowledge'))!;
    const nodes = await store.knowledgeBySource({
      sourceThreadId: 'alpha',
      scope: ['org:acme', 'resource:user-42', 'thread:alpha'],
      limit: 100,
    });
    expect(nodes.records.length).toBeGreaterThan(0);
    const cursor = await store.getCurationCursor({ sourceThreadId: 'alpha', agent: 'curate' });
    expect(cursor?.lastKnowledgeId).toBeTruthy();
    expect(result.curations.some(curation => curation.outcome === 'ran' && curation.cursorAdvanced)).toBe(true);
  });

  it('fails fast when no Subconscious is configured rather than reporting an empty run', async () => {
    const memory = createMemory({ subconscious: undefined });
    await expect(run(memory)).rejects.toThrow(/experimental_subconscious/);
  });

  it('fails fast when the Subconscious has no curate agent', async () => {
    const memory = createMemory({ subconscious: new Subconscious({ reflection: ['learn'] }) });
    await expect(run(memory)).rejects.toThrow(/"curate" reflection agent/);
  });

  it('aborts the arm when a curation is skipped because another is in flight', async () => {
    const memory = createMemory();
    // The curator only reaches its model with a non-empty worklist, so seed one.
    const store = (await memory.storage.getStore('knowledge'))!;
    const scope = ['org:acme', 'resource:user-42', 'thread:alpha'];
    const node = await store.createNode({ name: 'Project Atlas', kind: 'project', scope });
    await store.appendKnowledge({
      node: node.id,
      text: 'Atlas launches soon.',
      scope,
      sourceThreadId: 'alpha',
      resolutionScope: scope,
      defaultScope: scope,
    });
    let release: (() => void) | undefined;
    vi.spyOn(Agent.prototype, 'generate').mockImplementation(
      () =>
        new Promise(resolve => {
          release = () => resolve({ text: 'nothing to do' } as never);
        }) as never,
    );
    // Hold a curation for this thread open so the driver's own call returns 'skipped'.
    const inFlight = memory.runCuration({ threadId: 'alpha', resourceId: 'user-42', requestContext: orgContext() });
    await vi.waitFor(() => expect(release).toBeDefined());

    await expect(run(memory)).rejects.toThrow(/"skipped"/);
    release?.();
    // The held curation's own outcome is not what this test asserts.
    await inFlight.catch(() => {});
  });

  it('aborts the arm when no model can be resolved for the curator', async () => {
    const memory = createMemory({ omModel: false });
    await expect(run(memory)).rejects.toThrow(/"no-model"/);
  });

  it('passes organizationId on the request context reaching capture and curation', async () => {
    const memory = createMemory();
    const curator = curatorAlwaysCompletes();
    const captureContexts: RequestContext[] = [];

    await run(memory, { cycles: cycles(2), captureAgent: captureAgent(captureContexts) });

    expect(captureContexts).toHaveLength(2);
    for (const context of captureContexts) expect(context.get('organizationId')).toBe('acme');
    const curatorContexts = curator.mock.calls
      .map(call => ((call as unknown[])[1] as { requestContext?: RequestContext } | undefined)?.requestContext)
      .filter(Boolean) as RequestContext[];
    expect(curatorContexts.length).toBeGreaterThan(0);
    for (const context of curatorContexts) expect(context.get('organizationId')).toBe('acme');
  });

  it('does not complete quietly when the curator omits its completion marker', async () => {
    const memory = createMemory();
    // Fail-closed: without <curation-complete .../> the cursor cannot advance, and a
    // silent success here would read exactly like "this prompt produced nothing".
    vi.spyOn(Agent.prototype, 'generate').mockResolvedValue({ text: 'nothing to do' } as never);

    const result = await run(memory);
    expect(result.curations.map(curation => curation.outcome)).toEqual(['failed']);
    expect(result.curations[0]!.cursorAdvanced).toBe(false);
    expect(result.warnings.join('\n')).toMatch(/curation failed/);

    const store = (await memory.storage.getStore('knowledge'))!;
    expect(await store.getCurationCursor({ sourceThreadId: 'alpha', agent: 'curate' })).toBeFalsy();
  });
});

function orgContext() {
  const context = new RequestContext();
  context.set('organizationId', 'acme');
  return context;
}

describe('arm configuration', () => {
  it('refuses arms that differ outside their prompts', () => {
    const other: ArmConfig = { ...arm, name: 'b', curationCadence: 3 };
    expect(() => assertArmsComparable(arm, other)).toThrow(/curationCadence/);
  });

  it('accepts arms that differ only in prompts and hashes them differently', () => {
    const other: ArmConfig = { ...arm, name: 'b', prompts: { capture: 'Prefer terse facts.' } };
    expect(() => assertArmsComparable(arm, other)).not.toThrow();
    expect(armConfigHash(arm)).not.toBe(armConfigHash(other));
  });
});
