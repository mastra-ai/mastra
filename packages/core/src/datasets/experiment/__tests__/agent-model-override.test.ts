/**
 * agentModel: run an experiment's agent target against a different model
 * without editing or versioning the agent. Real Agent + real Mastra + real
 * Dataset.startExperiment; the models and the editor's stored versions are the only fakes.
 */
import { convertArrayToReadableStream, MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { describe, expect, it, vi } from 'vitest';
import { Agent } from '../../../agent';
import { Mastra } from '../../../mastra';
import type { VersionOverrides } from '../../../mastra/types';
import { MASTRA_VERSIONS_KEY } from '../../../request-context';
import { InMemoryStore } from '../../../storage/mock';

function textModel(text: string) {
  return new MockLanguageModelV2({
    doGenerate: async () => ({
      rawCall: { rawPrompt: null, rawSettings: {} },
      finishReason: 'stop' as const,
      usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
      content: [{ type: 'text' as const, text }],
      warnings: [],
    }),
    doStream: async () => ({
      rawCall: { rawPrompt: null, rawSettings: {} },
      stream: convertArrayToReadableStream([
        { type: 'text-start' as const, id: 't1' },
        { type: 'text-delta' as const, id: 't1', delta: text },
        { type: 'text-end' as const, id: 't1' },
        {
          type: 'finish' as const,
          finishReason: 'stop' as const,
          usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
        },
      ]),
      warnings: [],
    }),
  });
}

/** A supervisor model that delegates once to the `helper` sub-agent, then answers. */
function delegatingModel(text: string) {
  let calls = 0;
  return new MockLanguageModelV2({
    doGenerate: async () => {
      calls += 1;
      if (calls % 2 === 1) {
        return {
          rawCall: { rawPrompt: null, rawSettings: {} },
          finishReason: 'tool-calls' as const,
          usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
          content: [
            {
              type: 'tool-call' as const,
              toolCallId: `call-${calls}`,
              toolName: 'agent-helper',
              input: JSON.stringify({ prompt: 'help me' }),
            },
          ],
          warnings: [],
        };
      }
      return {
        rawCall: { rawPrompt: null, rawSettings: {} },
        finishReason: 'stop' as const,
        usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
        content: [{ type: 'text' as const, text }],
        warnings: [],
      };
    },
  });
}

const callCount = (m: MockLanguageModelV2) => m.doGenerateCalls.length + m.doStreamCalls.length;
const texts = (summary: { results: { output: unknown }[] }) =>
  summary.results.map(r => (r.output as { text?: string } | null)?.text);
const promptsOf = (m: MockLanguageModelV2) =>
  JSON.stringify([...m.doStreamCalls, ...m.doGenerateCalls].map(call => call.prompt));

/** Editor stub whose stored versions carry instructions naming the selected version. */
function versionedEditor() {
  const applyStoredOverrides = vi.fn(async (a: Agent, selector: { versionId?: string; status?: string }) => {
    const fork = a.__fork();
    fork.__updateInstructions(`${selector.versionId ?? selector.status} instructions`);
    return fork;
  });
  return { agent: { applyStoredOverrides } };
}

async function setup({
  editor,
  versions,
  itemRequestContext,
}: { editor?: unknown; versions?: VersionOverrides; itemRequestContext?: Record<string, unknown> } = {}) {
  const defaultModel = textModel('from-default');
  const agent = new Agent({
    id: 'eval-agent',
    name: 'Eval Agent',
    instructions: 'code instructions',
    model: defaultModel,
  });
  const mastra = new Mastra({
    agents: { agent },
    storage: new InMemoryStore(),
    logger: false,
    ...(editor ? { editor: editor as any } : {}),
    ...(versions ? { versions } : {}),
  });
  const dataset = await mastra.datasets.create({ name: 'agentModel DS' });
  await dataset.addItem({ input: 'first', ...(itemRequestContext ? { requestContext: itemRequestContext } : {}) });
  await dataset.addItem({ input: 'second', ...(itemRequestContext ? { requestContext: itemRequestContext } : {}) });
  return { mastra, dataset, defaultModel };
}

describe('experiment agentModel override', () => {
  it('runs every item on the override model, never the agent default', async () => {
    const { dataset, defaultModel } = await setup();
    const overrideModel = textModel('from-override');

    const summary = await dataset.startExperiment({
      targetType: 'agent',
      targetId: 'eval-agent',
      agentModel: overrideModel,
    });

    expect(summary.succeededCount).toBe(2);
    expect(texts(summary)).toEqual(['from-override', 'from-override']);
    expect(callCount(defaultModel)).toBe(0);
  });

  it('leaves the registered agent on its own model afterwards', async () => {
    const { mastra, dataset } = await setup();
    await dataset.startExperiment({
      targetType: 'agent',
      targetId: 'eval-agent',
      agentModel: textModel('from-override'),
    });

    const result = await mastra.getAgentById('eval-agent').generate('hello');
    expect(result.text).toBe('from-default');
  });

  it('isolates concurrent experiments with different overrides', async () => {
    const { dataset } = await setup();
    const [a, b] = await Promise.all([
      dataset.startExperiment({ targetType: 'agent', targetId: 'eval-agent', agentModel: textModel('from-a') }),
      dataset.startExperiment({ targetType: 'agent', targetId: 'eval-agent', agentModel: textModel('from-b') }),
    ]);

    expect(texts(a)).toEqual(['from-a', 'from-a']);
    expect(texts(b)).toEqual(['from-b', 'from-b']);
  });

  it('uses the agent default model when no override is given', async () => {
    const { dataset } = await setup();

    const summary = await dataset.startExperiment({ targetType: 'agent', targetId: 'eval-agent' });

    expect(texts(summary)).toEqual(['from-default', 'from-default']);
  });

  it('keeps sub-agents on their own model', async () => {
    const helperModel = textModel('from-helper');
    const helper = new Agent({ id: 'helper', name: 'helper', instructions: 'help', model: helperModel });
    const supervisor = new Agent({
      id: 'supervisor',
      name: 'supervisor',
      instructions: 'delegate',
      model: textModel('from-default'),
      agents: { helper },
    });
    const mastra = new Mastra({ agents: { supervisor, helper }, storage: new InMemoryStore(), logger: false });
    const dataset = await mastra.datasets.create({ name: 'sub-agent DS' });
    await dataset.addItem({ input: 'first' });

    const summary = await dataset.startExperiment({
      targetType: 'agent',
      targetId: 'supervisor',
      agentModel: delegatingModel('from-override'),
    });

    expect(texts(summary)).toEqual(['from-override']);
    expect(callCount(helperModel)).toBe(1);
  });

  describe('tags each trace with the override so it can be told apart from the agent default', () => {
    it.each([
      {
        scenario: 'a model instance',
        agentModel: () => textModel('x'),
        expected: 'mock-provider/mock-model-id',
        model: { provider: 'mock-provider', name: 'mock-model-id' },
      },
      {
        scenario: 'a labeled model',
        agentModel: () => ({ model: textModel('x'), id: 'anthropic/claude-haiku-5-5' }),
        expected: 'anthropic/claude-haiku-5-5',
        model: { provider: 'anthropic', name: 'claude-haiku-5-5' },
      },
      { scenario: 'no override', agentModel: () => undefined, expected: undefined, model: undefined },
    ])('$scenario', async ({ agentModel, expected, model }) => {
      const { mastra, dataset } = await setup();
      const generate = vi.spyOn(mastra.getAgentById('eval-agent'), 'generate');

      const summary = await dataset.startExperiment({
        targetType: 'agent',
        targetId: 'eval-agent',
        agentModel: agentModel(),
      });

      expect(generate).toHaveBeenCalledTimes(2);
      for (const [, options] of generate.mock.calls) {
        expect(options?.tracingOptions?.metadata).toEqual({
          experimentId: summary.experimentId,
          ...(expected ? { agentModel: expected, agentOverrides: { model } } : {}),
        });
      }
    });
  });

  describe('records the override on the experiment so runs on different models can be told apart', () => {
    it.each([
      {
        path: 'startExperiment',
        start: (dataset: Awaited<ReturnType<typeof setup>>['dataset'], config: Record<string, unknown>) =>
          dataset.startExperiment({ targetType: 'agent', targetId: 'eval-agent', ...config }),
      },
      {
        path: 'startExperimentAsync',
        start: (dataset: Awaited<ReturnType<typeof setup>>['dataset'], config: Record<string, unknown>) =>
          dataset.startExperimentAsync({ targetType: 'agent', targetId: 'eval-agent', ...config }),
      },
    ])('$path', async ({ start }) => {
      const { dataset } = await setup();

      const withOverride = await start(dataset, {
        agentModel: { model: textModel('x'), id: 'anthropic/claude-haiku-5-5' },
        metadata: { owner: 'evals', agentModel: 'stale-label' },
      });
      const withoutOverride = await start(dataset, { metadata: { owner: 'evals' } });

      expect((await dataset.getExperiment({ experimentId: withOverride.experimentId }))?.metadata).toEqual({
        owner: 'evals',
        agentModel: 'anthropic/claude-haiku-5-5',
        agentOverrides: { model: { provider: 'anthropic', name: 'claude-haiku-5-5' } },
      });
      expect((await dataset.getExperiment({ experimentId: withoutOverride.experimentId }))?.metadata).toEqual({
        owner: 'evals',
      });
    });
  });

  describe('only the model changes compared to the same run without an override', () => {
    it.each<{
      scenario: string;
      global?: VersionOverrides;
      experiment?: VersionOverrides;
      experimentRequestContext?: Record<string, unknown>;
      itemRequestContext?: Record<string, unknown>;
      agentVersion?: string;
      expected: string;
    }>([
      {
        scenario: 'experiment versions.defaultStatus',
        experiment: { defaultStatus: 'published' },
        expected: 'published instructions',
      },
      {
        scenario: 'global Mastra versions.defaultStatus',
        global: { defaultStatus: 'published' },
        expected: 'published instructions',
      },
      {
        scenario: 'experiment versions.agents entry over defaultStatus',
        experiment: { agents: { 'eval-agent': { versionId: 'v-7' } }, defaultStatus: 'published' },
        expected: 'v-7 instructions',
      },
      {
        scenario: 'experiment versions over global versions',
        global: { agents: { 'eval-agent': { versionId: 'v-global' } } },
        experiment: { agents: { 'eval-agent': { status: 'draft' } } },
        expected: 'draft instructions',
      },
      {
        scenario: 'versions on the experiment requestContext',
        experimentRequestContext: { [MASTRA_VERSIONS_KEY]: { agents: { 'eval-agent': { versionId: 'v-ctx' } } } },
        expected: 'v-ctx instructions',
      },
      {
        scenario: 'versions on each item requestContext',
        itemRequestContext: { [MASTRA_VERSIONS_KEY]: { defaultStatus: 'draft' } },
        expected: 'draft instructions',
      },
      {
        scenario: 'an explicit agentVersion over versions',
        experiment: { defaultStatus: 'published' },
        agentVersion: 'v-explicit',
        expected: 'v-explicit instructions',
      },
    ])(
      'resolves the root version from $scenario',
      async ({ global, experiment, experimentRequestContext, itemRequestContext, agentVersion, expected }) => {
        const { dataset, defaultModel } = await setup({
          editor: versionedEditor(),
          versions: global,
          itemRequestContext,
        });
        const overrideModel = textModel('from-override');
        const config = {
          targetType: 'agent' as const,
          targetId: 'eval-agent',
          versions: experiment,
          requestContext: experimentRequestContext,
          agentVersion,
        };

        const baseline = await dataset.startExperiment(config);
        const overridden = await dataset.startExperiment({ ...config, agentModel: overrideModel });

        expect(texts(baseline)).toEqual(['from-default', 'from-default']);
        expect(promptsOf(defaultModel)).toContain(expected);
        expect(texts(overridden)).toEqual(['from-override', 'from-override']);
        expect(promptsOf(overrideModel)).toContain(expected);
        expect(promptsOf(overrideModel)).not.toContain('code instructions');
        expect(callCount(defaultModel)).toBe(2);
      },
    );
  });

  it('rejects agentModel for non-agent targets', async () => {
    const { dataset } = await setup();

    await expect(
      dataset.startExperiment({ targetType: 'workflow', targetId: 'wf', agentModel: textModel('x') }),
    ).rejects.toThrow(/agentModel/);
    await expect(dataset.startExperiment({ task: async () => 'out', agentModel: textModel('x') })).rejects.toThrow(
      /agentModel/,
    );
  });

  it('rejects agentModel for non-agent targets in startExperimentAsync before creating an experiment', async () => {
    const { dataset } = await setup();

    await expect(
      dataset.startExperimentAsync({ targetType: 'workflow', targetId: 'wf', agentModel: textModel('x') }),
    ).rejects.toThrow(/agentModel/);
    await expect(dataset.startExperimentAsync({ task: async () => 'out', agentModel: textModel('x') })).rejects.toThrow(
      /agentModel/,
    );

    const { experiments } = await dataset.listExperiments();
    expect(experiments).toEqual([]);
  });
});
