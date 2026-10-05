import { MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Agent } from '../../../agent';
import { Mastra } from '../../../mastra';
import type { VersionOverrides, VersionSelector } from '../../../mastra/types';
import { runExperiment } from '../index';

function model() {
  return new MockLanguageModelV2({
    doGenerate: async () => ({
      content: [{ type: 'text' as const, text: 'unused' }],
      finishReason: 'stop' as const,
      usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
      warnings: [],
    }),
  });
}

describe('dataset experiment agent version pins', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('resolves root and dependency labels once before sequential items and retries', async () => {
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
    });
    const mastra = new Mastra({ agents: { root, dependency }, logger: false });

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
      versions: {
        agents: {
          root: { label: 'candidate' },
          dependency: { label: 'candidate' },
        },
      },
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
        self: { versionId: 'root-v1' },
        agents: { dependency: { versionId: 'dependency-v1' } },
      },
      {
        self: { versionId: 'root-v1' },
        agents: { dependency: { versionId: 'dependency-v1' } },
      },
      {
        self: { versionId: 'root-v1' },
        agents: { dependency: { versionId: 'dependency-v1' } },
      },
    ]);
    expect(resolutions.filter(({ selector }) => 'label' in selector)).toEqual([
      { agentId: 'root', selector: { label: 'candidate' } },
      { agentId: 'dependency', selector: { label: 'candidate' } },
    ]);
  });
});
