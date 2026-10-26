/**
 * agentCallOptions: per-call generate() options (instructions, model, modelSettings) for an
 * experiment's agent target, without editing or versioning the agent. Real Agent + real Mastra +
 * real Dataset.startExperiment; the language models are the only fakes.
 */
import { MockLanguageModelV1 } from '@internal/ai-sdk-v4/test';
import { convertArrayToReadableStream, MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { describe, expect, it, vi } from 'vitest';
import { Agent } from '../../../agent';
import { MastraModelGateway } from '../../../llm/model/gateways/base';
import type { ProviderConfig } from '../../../llm/model/gateways/base';
import { Mastra } from '../../../mastra';
import { InMemoryStore } from '../../../storage/mock';

/** Real gateway that serves `eval-test/fake/<name>` from a fake model, so a `provider/modelId` string resolves through Mastra's real string→model path. */
class FakeGateway extends MastraModelGateway {
  readonly id = 'eval-test';
  readonly name = 'eval-test-gateway';
  readonly prefix = 'eval-test';

  constructor(private readonly model: MockLanguageModelV2) {
    super();
  }

  async fetchProviders(): Promise<Record<string, ProviderConfig>> {
    return {
      fake: {
        name: 'Fake',
        models: ['override-model'],
        apiKeyEnvVar: 'EVAL_TEST_API_KEY',
        gateway: 'eval-test-gateway',
        url: 'https://fake.test/v1',
      },
    };
  }

  buildUrl(): string {
    return 'https://fake.test/v1';
  }

  async getApiKey(): Promise<string> {
    return 'test-key';
  }

  async resolveLanguageModel(): Promise<MockLanguageModelV2> {
    return this.model;
  }
}

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

const callsOf = (m: MockLanguageModelV2) => [...m.doStreamCalls, ...m.doGenerateCalls];
const systemPromptsOf = (m: MockLanguageModelV2) =>
  callsOf(m).map(call =>
    call.prompt
      .filter(message => message.role === 'system')
      .map(message => message.content)
      .join('\n'),
  );

async function setup({ editor }: { editor?: unknown } = {}) {
  const defaultModel = textModel('from-default');
  const overrideModel = textModel('from-override');
  const agent = new Agent({
    id: 'eval-agent',
    name: 'Eval Agent',
    instructions: 'code instructions',
    model: defaultModel,
  });
  const mastra = new Mastra({
    agents: { agent },
    storage: new InMemoryStore(),
    gateways: { evalTest: new FakeGateway(overrideModel) },
    logger: false,
    ...(editor ? { editor: editor as any } : {}),
  });
  const dataset = await mastra.datasets.create({ name: 'agentCallOptions DS' });
  await dataset.addItem({ input: 'first' });
  await dataset.addItem({ input: 'second' });
  return { mastra, dataset, defaultModel, overrideModel };
}

/** Agent "legacy-agent" on a v1 (legacy) model, with the fake gateway available for model overrides. */
async function legacySetup() {
  const legacyModel = new MockLanguageModelV1({
    doGenerate: async () => ({
      rawCall: { rawPrompt: null, rawSettings: {} },
      finishReason: 'stop' as const,
      usage: { promptTokens: 1, completionTokens: 1 },
      text: 'from-legacy',
    }),
  });
  const overrideModel = textModel('from-override');
  const agent = new Agent({ id: 'legacy-agent', name: 'Legacy Agent', instructions: 'code', model: legacyModel });
  const mastra = new Mastra({
    agents: { agent },
    storage: new InMemoryStore(),
    gateways: { evalTest: new FakeGateway(overrideModel) },
    logger: false,
  });
  const dataset = await mastra.datasets.create({ name: 'legacy DS' });
  await dataset.addItem({ input: 'first' });
  await dataset.addItem({ input: 'second' });
  return { dataset, overrideModel };
}

describe('Feature: tweak how an agent is called per experiment without changing it', () => {
  describe('Scenario: the experiment runs on tweaked instructions', () => {
    it('sends the tweaked instructions, never the code instructions, on every item', async () => {
      // Given agent "eval-agent" with instructions "code instructions" and a 2-item dataset
      const { dataset, defaultModel } = await setup();

      // When I start an experiment with tweaked instructions
      const summary = await dataset.startExperiment({
        targetType: 'agent',
        targetId: 'eval-agent',
        agentCallOptions: { instructions: 'tweaked instructions' },
      });

      // Then every model call's system prompt is the tweaked one
      expect(summary.succeededCount).toBe(2);
      expect(systemPromptsOf(defaultModel)).toEqual(['tweaked instructions', 'tweaked instructions']);
    });
  });

  describe('Scenario: tweaking does not mutate the registered agent', () => {
    it('keeps the code instructions for normal calls after the experiment', async () => {
      // Given an experiment ran with tweaked instructions
      const { mastra, dataset, defaultModel } = await setup();
      await dataset.startExperiment({
        targetType: 'agent',
        targetId: 'eval-agent',
        agentCallOptions: { instructions: 'tweaked instructions' },
      });

      // When I use the registered agent normally
      const agent = mastra.getAgentById('eval-agent');
      await agent.generate('hello');

      // Then it still has, and sends, the code instructions
      expect(await agent.getInstructions()).toBe('code instructions');
      expect(systemPromptsOf(defaultModel).at(-1)).toBe('code instructions');
    });
  });

  describe('Scenario: the experiment runs on a different model chosen by name', () => {
    it('routes every item to that model and never calls the default model', async () => {
      // Given agent "eval-agent" on a default model, and a gateway serving "eval-test/fake/override-model"
      const { dataset, defaultModel, overrideModel } = await setup();

      // When I start an experiment with a model id
      const summary = await dataset.startExperiment({
        targetType: 'agent',
        targetId: 'eval-agent',
        agentCallOptions: { model: 'eval-test/fake/override-model' },
      });

      // Then every item output comes from that model
      expect(summary.succeededCount).toBe(2);
      expect(summary.results.map(r => r.output)).toEqual([
        expect.objectContaining({ text: 'from-override' }),
        expect.objectContaining({ text: 'from-override' }),
      ]);
      // And the default model is never called
      expect(callsOf(overrideModel)).toHaveLength(2);
      expect(callsOf(defaultModel)).toHaveLength(0);
    });
  });

  describe('Scenario: the experiment runs with tweaked sampling settings', () => {
    it('sends the tweaked modelSettings on every model call', async () => {
      // Given agent "eval-agent"
      const { dataset, defaultModel } = await setup();

      // When I start an experiment with tweaked modelSettings
      await dataset.startExperiment({
        targetType: 'agent',
        targetId: 'eval-agent',
        agentCallOptions: { modelSettings: { temperature: 0.1, topP: 0.5 } },
      });

      // Then every model call receives them
      expect(callsOf(defaultModel).map(call => [call.temperature, call.topP])).toEqual([
        [0.1, 0.5],
        [0.1, 0.5],
      ]);
    });
  });

  describe('Scenario: call options are layered on top of the agentVersion', () => {
    /** Editor stub whose stored version "v-1" is a full agent with its own instructions, model and sampling. */
    function versionedEditor(versionModel: MockLanguageModelV2) {
      return {
        agent: {
          applyStoredOverrides: async (a: Agent, { versionId }: { versionId?: string }) => {
            const version = new Agent({
              id: a.id,
              name: a.name,
              instructions: `${versionId} instructions`,
              model: versionModel,
              defaultOptions: { modelSettings: { temperature: 0.9, topP: 0.3 } },
            });
            version.__registerMastra(a.getMastraInstance()!);
            return version;
          },
        },
      };
    }

    it('keeps the version for every field the call options leave unset, and merges modelSettings', async () => {
      // Given version "v-1" with its own instructions, model and modelSettings { temperature: 0.9, topP: 0.3 }
      const versionModel = textModel('from-version');
      const { dataset, defaultModel } = await setup({ editor: versionedEditor(versionModel) });

      // When I start an experiment on "v-1" that only tweaks the temperature
      await dataset.startExperiment({
        targetType: 'agent',
        targetId: 'eval-agent',
        agentVersion: 'v-1',
        agentCallOptions: { modelSettings: { temperature: 0.1 } },
      });

      // Then the version's instructions and model are used, with its topP and the tweaked temperature
      expect(callsOf(defaultModel)).toHaveLength(0);
      expect(systemPromptsOf(versionModel)).toEqual(['v-1 instructions', 'v-1 instructions']);
      expect(callsOf(versionModel).map(call => [call.temperature, call.topP])).toEqual([
        [0.1, 0.3],
        [0.1, 0.3],
      ]);
    });

    it('replaces the version instructions and model when the call options set them', async () => {
      // Given version "v-1" with its own instructions and model
      const versionModel = textModel('from-version');
      const { dataset, overrideModel } = await setup({ editor: versionedEditor(versionModel) });

      // When I start an experiment on "v-1" with tweaked instructions and model
      await dataset.startExperiment({
        targetType: 'agent',
        targetId: 'eval-agent',
        agentVersion: 'v-1',
        agentCallOptions: { instructions: 'tweaked instructions', model: 'eval-test/fake/override-model' },
      });

      // Then the call options win over the version
      expect(callsOf(versionModel)).toHaveLength(0);
      expect(systemPromptsOf(overrideModel)).toEqual(['tweaked instructions', 'tweaked instructions']);
    });
  });

  describe('Scenario: two experiments with different tweaks run at the same time', () => {
    it('never leaks one experiment’s instructions into the other', async () => {
      // Given agent "eval-agent" and one dataset per experiment
      const { mastra, defaultModel } = await setup();
      const datasetA = await mastra.datasets.create({ name: 'A' });
      const datasetB = await mastra.datasets.create({ name: 'B' });
      for (const i of [1, 2, 3]) {
        await datasetA.addItem({ input: `a-${i}` });
        await datasetB.addItem({ input: `b-${i}` });
      }

      // When experiments A and B start concurrently with different instructions
      await Promise.all([
        datasetA.startExperiment({
          targetType: 'agent',
          targetId: 'eval-agent',
          agentCallOptions: { instructions: 'A' },
        }),
        datasetB.startExperiment({
          targetType: 'agent',
          targetId: 'eval-agent',
          agentCallOptions: { instructions: 'B' },
        }),
      ]);

      // Then every call for A carries "A" and every call for B carries "B"
      const pairs = callsOf(defaultModel).map(call => ({
        system: call.prompt
          .filter(m => m.role === 'system')
          .map(m => m.content)
          .join('\n'),
        user: JSON.stringify(call.prompt.filter(m => m.role === 'user')),
      }));
      expect(pairs).toHaveLength(6);
      for (const { system, user } of pairs) {
        expect(system).toBe(user.includes('a-') ? 'A' : 'B');
      }
    });
  });

  describe('Scenario: the experiment remembers what was tweaked', () => {
    const callOptions = {
      instructions: 'tweaked instructions',
      model: 'eval-test/fake/override-model',
      modelSettings: { temperature: 0.2 },
    };

    it('stores the options on the experiment under one key, alongside caller metadata', async () => {
      // Given an experiment started with agentCallOptions and caller metadata
      const { dataset } = await setup();
      const summary = await dataset.startExperiment({
        targetType: 'agent',
        targetId: 'eval-agent',
        agentCallOptions: callOptions,
        metadata: { owner: 'evals', agentCallOptions: 'stale' },
      });

      // When I load it
      const experiment = await dataset.getExperiment({ experimentId: summary.experimentId });

      // Then metadata.agentCallOptions deep-equals the options, and caller metadata is kept
      expect(experiment?.metadata).toEqual({ owner: 'evals', agentCallOptions: callOptions });
    });

    it('records a model instance as its provider/modelId label, never the instance', async () => {
      // Given an experiment started with a model instance
      const { dataset } = await setup();
      const summary = await dataset.startExperiment({
        targetType: 'agent',
        targetId: 'eval-agent',
        agentCallOptions: { model: textModel('x') },
      });

      // Then the experiment records the label
      const experiment = await dataset.getExperiment({ experimentId: summary.experimentId });
      expect(experiment?.metadata).toEqual({ agentCallOptions: { model: 'mock-provider/mock-model-id' } });
    });

    it('tags every item trace with the model and settings, flagging instructions instead of copying the prompt', async () => {
      // Given an experiment started with agentCallOptions
      const { mastra, dataset } = await setup();
      const generate = vi.spyOn(mastra.getAgentById('eval-agent'), 'generate');

      // When it runs
      const summary = await dataset.startExperiment({
        targetType: 'agent',
        targetId: 'eval-agent',
        agentCallOptions: callOptions,
      });

      // Then every item's trace metadata carries the options without the prompt text,
      // which lives once on the experiment and on the AGENT_RUN span's instructions attribute
      expect(generate).toHaveBeenCalledTimes(2);
      for (const [, options] of generate.mock.calls) {
        expect(options?.tracingOptions?.metadata).toEqual({
          experimentId: summary.experimentId,
          agentCallOptions: { model: callOptions.model, modelSettings: callOptions.modelSettings },
          agentInstructionsOverridden: true,
        });
      }
    });
  });

  describe('Scenario: agentModel is an alias for agentCallOptions.model', () => {
    it('runs on agentModel and records it as agentCallOptions.model', async () => {
      // Given a gateway serving "eval-test/fake/override-model"
      const { dataset, defaultModel, overrideModel } = await setup();

      // When I start an experiment with agentModel and tweaked instructions
      const summary = await dataset.startExperiment({
        targetType: 'agent',
        targetId: 'eval-agent',
        agentModel: 'eval-test/fake/override-model',
        agentCallOptions: { instructions: 'tweaked instructions' },
      });

      // Then it runs on that model
      expect(callsOf(overrideModel)).toHaveLength(2);
      expect(callsOf(defaultModel)).toHaveLength(0);
      // And the model is recorded with the other options, under one key
      const experiment = await dataset.getExperiment({ experimentId: summary.experimentId });
      expect(experiment?.metadata).toEqual({
        agentCallOptions: { instructions: 'tweaked instructions', model: 'eval-test/fake/override-model' },
      });
    });

    it('lets agentCallOptions.model win when both are set', async () => {
      // Given a gateway serving "eval-test/fake/override-model"
      const { dataset, overrideModel } = await setup();
      const aliasModel = textModel('from-alias');

      // When agentModel and agentCallOptions.model name different models
      const summary = await dataset.startExperiment({
        targetType: 'agent',
        targetId: 'eval-agent',
        agentModel: aliasModel,
        agentCallOptions: { model: 'eval-test/fake/override-model' },
      });

      // Then it runs on agentCallOptions.model only
      expect(summary.succeededCount).toBe(2);
      expect(callsOf(overrideModel)).toHaveLength(2);
      expect(callsOf(aliasModel)).toHaveLength(0);
    });
  });

  describe('Scenario: empty call options leave a legacy-model agent on its legacy path', () => {
    it('runs every item when agentCallOptions sets nothing', async () => {
      // Given agent "legacy-agent" on a v1 (legacy) model
      const { dataset } = await legacySetup();

      // When I start an experiment with agentCallOptions that set no option
      const summary = await dataset.startExperiment({
        targetType: 'agent',
        targetId: 'legacy-agent',
        agentCallOptions: {},
      });

      // Then every item succeeds on the legacy model
      expect(summary.succeededCount).toBe(2);
      expect(summary.results.map(r => r.output)).toEqual([
        expect.objectContaining({ text: 'from-legacy' }),
        expect.objectContaining({ text: 'from-legacy' }),
      ]);
    });

    it('runs every item on the call options model when it replaces the legacy model', async () => {
      // Given agent "legacy-agent" on a v1 (legacy) model
      const { dataset, overrideModel } = await legacySetup();

      // When I start an experiment that moves it to a supported model
      const summary = await dataset.startExperiment({
        targetType: 'agent',
        targetId: 'legacy-agent',
        agentCallOptions: { instructions: 'tweaked instructions', model: 'eval-test/fake/override-model' },
      });

      // Then every item runs on the new model with the tweaked instructions
      expect(summary.succeededCount).toBe(2);
      expect(systemPromptsOf(overrideModel)).toEqual(['tweaked instructions', 'tweaked instructions']);
    });

    it('fails every item with a clear error when the options need the legacy model to support them', async () => {
      // Given agent "legacy-agent" on a v1 (legacy) model
      const { dataset } = await legacySetup();

      // When I start an experiment that tweaks only its instructions
      const summary = await dataset.startExperiment({
        targetType: 'agent',
        targetId: 'legacy-agent',
        agentCallOptions: { instructions: 'tweaked instructions' },
      });

      // Then no item runs, and the error says to also set agentCallOptions.model
      expect(summary.succeededCount).toBe(0);
      for (const result of summary.results) {
        expect(result.error?.message).toContain('agentCallOptions.model');
      }
    });
  });

  describe('Scenario Outline: agentCallOptions is rejected where it is meaningless', () => {
    const agentCallOptions = { instructions: 'tweaked instructions' };
    const examples = [
      { condition: 'a workflow target', config: { targetType: 'workflow' as const, targetId: 'wf', agentCallOptions } },
      { condition: 'an inline task', config: { task: async () => 'out', agentCallOptions } },
    ];

    it.each(examples)('startExperiment with $condition throws', async ({ config }) => {
      // Given a dataset
      const { dataset } = await setup();

      // When I start an experiment with agentCallOptions and <condition>
      // Then it throws EXPERIMENT_INVALID_AGENT_CALL_OPTIONS
      await expect(dataset.startExperiment(config)).rejects.toMatchObject({
        id: 'EXPERIMENT_INVALID_AGENT_CALL_OPTIONS',
      });
    });

    it.each(examples)(
      'startExperimentAsync with $condition throws before creating an experiment',
      async ({ config }) => {
        // Given a dataset
        const { dataset } = await setup();

        // When I start an async experiment with agentCallOptions and <condition>
        // Then it throws EXPERIMENT_INVALID_AGENT_CALL_OPTIONS and nothing is stored
        await expect(dataset.startExperimentAsync(config)).rejects.toMatchObject({
          id: 'EXPERIMENT_INVALID_AGENT_CALL_OPTIONS',
        });
        const { experiments } = await dataset.listExperiments();
        expect(experiments).toEqual([]);
      },
    );
  });
});
