import { MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Agent } from '../../../agent';
import { getAgentVersionPins } from '../../../agent/version-pins';
import { Mastra } from '../../../mastra';
import type { VersionOverrides, VersionSelector } from '../../../mastra/types';
import { MASTRA_VERSIONS_KEY } from '../../../request-context';
import { runExperiment } from '../index';

function model(onGenerate?: () => void) {
  return new MockLanguageModelV2({
    doGenerate: async () => {
      onGenerate?.();
      return {
        content: [{ type: 'text' as const, text: 'done' }],
        finishReason: 'stop' as const,
        usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
        warnings: [],
      };
    },
  });
}

function delegatingModel() {
  let calls = 0;
  return new MockLanguageModelV2({
    doGenerate: async () => {
      const delegate = calls++ % 2 === 0;
      return {
        content: delegate
          ? [
              {
                type: 'tool-call' as const,
                toolCallId: `delegate-${calls}`,
                toolName: 'agent-dependency',
                input: '{"prompt":"help"}',
              },
            ]
          : [{ type: 'text' as const, text: 'done' }],
        finishReason: delegate ? ('tool-calls' as const) : ('stop' as const),
        usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
        warnings: [],
      };
    },
  });
}

describe('dataset experiment agent version pins', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it.each(['invocation', 'instance', 'context', 'defaultOptions'] as const)(
    'resolves %s default labels once before sequential items and retries',
    async source => {
      const dependency = new Agent({
        id: 'dependency',
        name: 'dependency',
        instructions: 'dependency',
        model: model(),
      });
      const root = new Agent({
        id: 'root',
        name: 'root',
        instructions: 'root',
        model: model(),
        agents: { dependency },
        ...(source === 'defaultOptions' ? { defaultOptions: { versions: { defaultLabel: 'candidate' } } } : {}),
      });
      const mastra = new Mastra({
        agents: { root, dependency },
        logger: false,
        ...(source === 'instance' ? { versions: { defaultLabel: 'candidate' } } : {}),
      });

      let rootLabelTarget = 'root-v1';
      let dependencyLabelTarget = 'dependency-v1';
      const resolutions: Array<{ agentId: string; selector: VersionSelector }> = [];
      const executionVersions: VersionOverrides[] = [];

      vi.spyOn(mastra, 'resolveVersionedAgent').mockImplementation(async (agent, selector) => {
        resolutions.push({ agentId: agent.id, selector: selector as VersionSelector });
        const versionId =
          'versionId' in selector ? selector.versionId : agent.id === 'root' ? rootLabelTarget : dependencyLabelTarget;
        const fork = agent.__fork();
        fork.__setRawConfig({
          ...(fork.toRawConfig() ?? {}),
          resolvedVersionId: versionId,
          ...('label' in selector ? { selectedVersionLabel: selector.label } : {}),
        });
        fork.__markStoredVersionApplied();

        if (agent.id === 'root') {
          fork.generate = vi.fn(async (_input, options) => {
            executionVersions.push(options?.versions ?? {});
            if (executionVersions.length === 1) {
              // Move both labels after the first failed attempt. The retry and
              // second item must continue to receive the run-start exact IDs.
              rootLabelTarget = 'root-v2';
              dependencyLabelTarget = 'dependency-v2';
              throw new Error('retry once after label movement');
            }
            return { text: versionId } as Awaited<ReturnType<typeof fork.generate>>;
          }) as typeof fork.generate;
        }

        return fork;
      });
      vi.spyOn(Math, 'random').mockReturnValue(0);

      const result = await runExperiment(mastra, {
        data: [
          { id: 'first', input: 'first' },
          { id: 'second', input: 'second' },
        ],
        targetType: 'agent',
        targetId: 'root',
        ...(source === 'invocation' ? { versions: { defaultLabel: 'candidate' } } : {}),
        ...(source === 'context' ? { requestContext: { [MASTRA_VERSIONS_KEY]: { defaultLabel: 'candidate' } } } : {}),
        maxConcurrency: 1,
        maxRetries: 1,
        persistence: { experiments: 'none', scores: 'none' },
      });

      expect(result.succeededCount).toBe(2);
      expect(result.results.map(item => item.retryCount)).toEqual([1, 0]);
      expect(result.results.map(item => item.output)).toEqual([
        expect.objectContaining({ text: 'root-v1' }),
        expect.objectContaining({ text: 'root-v1' }),
      ]);
      expect(executionVersions).toEqual([
        {
          agents: { root: { versionId: 'root-v1' }, dependency: { versionId: 'dependency-v1' } },
        },
        {
          agents: { root: { versionId: 'root-v1' }, dependency: { versionId: 'dependency-v1' } },
        },
        {
          agents: { root: { versionId: 'root-v1' }, dependency: { versionId: 'dependency-v1' } },
        },
      ]);
      expect(resolutions.filter(({ selector }) => 'label' in selector)).toEqual([
        { agentId: 'root', selector: { label: 'candidate' } },
        { agentId: 'dependency', selector: { label: 'candidate' } },
      ]);
    },
  );

  it.each(['defaultStatus', 'explicit', 'unrelatedExact'] as const)(
    'keeps code fallback frozen with %s selectors across real items and retries',
    async source => {
      let published = false;
      let attempts = 0;
      const dependencyVersions: Array<string | undefined> = [];
      const dependency = new Agent({
        id: 'dependency',
        name: 'dependency',
        instructions: ({ requestContext }) => {
          dependencyVersions.push(getAgentVersionPins(requestContext)?.root?.versionId);
          return 'dependency';
        },
        model: model(),
      });
      const root = new Agent({
        id: 'root',
        name: 'root',
        instructions: () => {
          if (++attempts === 1) {
            published = true;
            throw new Error('retry after publication');
          }
          return 'delegate';
        },
        model: delegatingModel(),
        agents: { dependency },
        defaultOptions: { maxSteps: 3 },
      });
      const mastra = new Mastra({ agents: { root, dependency }, logger: false });
      const resolve = vi.spyOn(mastra, 'resolveVersionedAgent').mockImplementation(async (agent, selector) => {
        if (agent.id === 'dependency' && !published) return agent;
        const fork = agent.__fork();
        fork.__setRawConfig({
          resolvedVersionId: 'versionId' in selector ? selector.versionId : `${agent.id}-published`,
        });
        fork.__markStoredVersionApplied();
        return fork;
      });
      vi.spyOn(Math, 'random').mockReturnValue(0);

      const result = await runExperiment(mastra, {
        data: [
          { id: 'first', input: 'first' },
          { id: 'second', input: 'second' },
        ],
        targetType: 'agent',
        targetId: 'root',
        versions:
          source === 'explicit'
            ? { agents: { root: { status: 'published' }, dependency: { status: 'published' } } }
            : {
                defaultStatus: 'published',
                ...(source === 'unrelatedExact' ? { agents: { unrelated: { versionId: 'unused-v1' } } } : {}),
              },
        maxConcurrency: 1,
        maxRetries: 1,
        persistence: { experiments: 'none', scores: 'none' },
      });

      expect(result.succeededCount).toBe(2);
      expect(result.results.map(item => item.retryCount)).toEqual([1, 0]);
      expect(dependencyVersions).toEqual([undefined, undefined]);
      expect(
        resolve.mock.calls.filter(([agent, selector]) => agent.id === 'dependency' && 'status' in selector),
      ).toHaveLength(1);
      expect(resolve.mock.calls.some(([agent]) => agent.id === 'unrelated')).toBe(false);
    },
  );

  it('rejects a late dynamic dependency on later real items and retries without resolving its label', async () => {
    let added = false;
    const dependency = new Agent({ id: 'dependency', name: 'dependency', instructions: 'dependency', model: model() });
    const late = new Agent({ id: 'late', name: 'late', instructions: 'late', model: model() });
    const behavior = vi.fn(() => {
      added = true;
    });
    const root = new Agent({
      id: 'root',
      name: 'root',
      instructions: 'root',
      model: model(behavior),
      agents: () => (added ? { dependency, late } : { dependency }),
    });
    const mastra = new Mastra({ agents: { root, dependency, late }, logger: false });
    const resolve = vi.spyOn(mastra, 'resolveVersionedAgent').mockImplementation(async (agent, selector) => {
      const fork = agent.__fork();
      fork.__setRawConfig({
        resolvedVersionId: 'versionId' in selector ? selector.versionId : `${agent.id}-candidate`,
      });
      fork.__markStoredVersionApplied();
      return fork;
    });
    vi.spyOn(Math, 'random').mockReturnValue(0);

    const result = await runExperiment(mastra, {
      data: [
        { id: 'first', input: 'first' },
        { id: 'second', input: 'second' },
      ],
      targetType: 'agent',
      targetId: 'root',
      versions: { defaultLabel: 'candidate' },
      maxConcurrency: 1,
      maxRetries: 1,
      persistence: { experiments: 'none', scores: 'none' },
    });

    expect(result.succeededCount).toBe(1);
    expect(result.failedCount).toBe(1);
    expect(result.results[1]).toMatchObject({
      retryCount: 1,
      error: { message: expect.stringContaining('was not pinned') },
    });
    expect(behavior).toHaveBeenCalledOnce();
    expect(resolve.mock.calls.some(([agent]) => agent.id === 'late')).toBe(false);
  });
});
