/**
 * agentOverrides: tweak an experiment's agent target (instructions, model, generation
 * options) per run without editing or versioning the agent. Real Agent + real Mastra +
 * real Dataset.startExperiment; the language models are the only fakes.
 */
import { convertArrayToReadableStream, MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { describe, expect, it, vi } from 'vitest';
import { Agent } from '../../../agent';
import { MastraModelGateway } from '../../../llm/model/gateways/base';
import type { ProviderConfig } from '../../../llm/model/gateways/base';
import { Mastra } from '../../../mastra';
import { InMemoryStore } from '../../../storage/mock';
import { recordingTool, scriptedModel } from './scenarios/scenario-helpers';

/** Real gateway that serves `eval-test/fake/<name>` from a fake model, so `{ provider, name }` resolves through Mastra's real string→model path. */
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

async function setup() {
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
  });
  const dataset = await mastra.datasets.create({ name: 'agentOverrides DS' });
  await dataset.addItem({ input: 'first' });
  await dataset.addItem({ input: 'second' });
  return { mastra, dataset, defaultModel, overrideModel };
}

describe('Feature: tweak an agent per experiment without changing it', () => {
  describe('Scenario: the experiment runs on tweaked instructions', () => {
    it('sends the tweaked instructions, never the code instructions, on every item', async () => {
      // Given agent "eval-agent" with instructions "code instructions" and a 2-item dataset
      const { dataset, defaultModel } = await setup();

      // When I start an experiment with tweaked instructions
      const summary = await dataset.startExperiment({
        targetType: 'agent',
        targetId: 'eval-agent',
        agentOverrides: { instructions: 'tweaked instructions' },
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
        agentOverrides: { instructions: 'tweaked instructions' },
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
    it('routes every item to the override model and never calls the default model', async () => {
      // Given agent "eval-agent" on a default model, and a gateway serving "eval-test/fake/override-model"
      const { dataset, defaultModel, overrideModel } = await setup();

      // When I start an experiment with a serializable model override
      const summary = await dataset.startExperiment({
        targetType: 'agent',
        targetId: 'eval-agent',
        agentOverrides: { model: { provider: 'eval-test/fake', name: 'override-model' } },
      });

      // Then every item output comes from the override model
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

  describe('Scenario: the experiment runs with tweaked generation settings', () => {
    async function toolLoopSetup() {
      // A model that keeps calling `lookup` for 2 steps, then answers: 3 model calls by default.
      const model = scriptedModel([
        { toolCalls: [{ id: 'c1', toolName: 'lookup', args: {} }] },
        { toolCalls: [{ id: 'c2', toolName: 'lookup', args: {} }] },
        { text: 'done' },
      ]);
      const agent = new Agent({
        id: 'eval-agent',
        name: 'Eval Agent',
        instructions: 'code instructions',
        model,
        tools: { lookup: recordingTool('lookup', []) },
      });
      const mastra = new Mastra({ agents: { agent }, storage: new InMemoryStore(), logger: false });
      const dataset = await mastra.datasets.create({ name: 'agentOverrides tools DS' });
      await dataset.addItem({ input: 'only' });
      return { dataset, model };
    }

    it('sends the tweaked temperature and toolChoice on the model call', async () => {
      // Given agent "eval-agent" with a tool
      const { dataset, model } = await toolLoopSetup();

      // When I start an experiment with tweaked modelSettings and toolChoice
      await dataset.startExperiment({
        targetType: 'agent',
        targetId: 'eval-agent',
        agentOverrides: { defaultOptions: { modelSettings: { temperature: 0.1 }, toolChoice: 'none', maxSteps: 1 } },
      });

      // Then the model call receives temperature 0.1 and toolChoice "none"
      const [call] = callsOf(model);
      expect(call?.temperature).toBe(0.1);
      expect(call?.toolChoice).toEqual({ type: 'none' });
    });

    it('stops the tool loop after maxSteps', async () => {
      // Given a tool-calling agent that would take 3 model calls by default
      const { dataset, model } = await toolLoopSetup();

      // When I start an experiment with maxSteps 1
      await dataset.startExperiment({
        targetType: 'agent',
        targetId: 'eval-agent',
        agentOverrides: { defaultOptions: { maxSteps: 1 } },
      });

      // Then the loop stops after 1 step
      expect(callsOf(model)).toHaveLength(1);
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
          agentOverrides: { instructions: 'A' },
        }),
        datasetB.startExperiment({
          targetType: 'agent',
          targetId: 'eval-agent',
          agentOverrides: { instructions: 'B' },
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
    const overrides = {
      instructions: 'tweaked instructions',
      model: { provider: 'eval-test/fake', name: 'override-model' },
      defaultOptions: { modelSettings: { temperature: 0.2 }, maxSteps: 2 },
    };

    it('stores the overrides on the experiment, alongside caller metadata', async () => {
      // Given an experiment started with agentOverrides and caller metadata
      const { dataset } = await setup();
      const summary = await dataset.startExperiment({
        targetType: 'agent',
        targetId: 'eval-agent',
        agentOverrides: overrides,
        metadata: { owner: 'evals', agentOverrides: 'stale' },
      });

      // When I load it
      const experiment = await dataset.getExperiment({ experimentId: summary.experimentId });

      // Then metadata.agentOverrides deep-equals the overrides, and caller metadata is kept
      expect(experiment?.metadata).toEqual({ owner: 'evals', agentOverrides: overrides });
    });

    it('tags every item trace with the overrides', async () => {
      // Given an experiment started with agentOverrides
      const { mastra, dataset } = await setup();
      const generate = vi.spyOn(mastra.getAgentById('eval-agent'), 'generate');

      // When it runs
      const summary = await dataset.startExperiment({
        targetType: 'agent',
        targetId: 'eval-agent',
        agentOverrides: overrides,
      });

      // Then every item's trace metadata carries the overrides
      expect(generate).toHaveBeenCalledTimes(2);
      for (const [, options] of generate.mock.calls) {
        expect(options?.tracingOptions?.metadata).toEqual({
          experimentId: summary.experimentId,
          agentOverrides: overrides,
        });
      }
    });
  });

  describe('Scenario: agentModel is shorthand for agentOverrides.model', () => {
    it('records agentModel as agentOverrides.model on the experiment and on every trace', async () => {
      // Given a gateway serving "eval-test/fake/override-model"
      const { mastra, dataset, defaultModel, overrideModel } = await setup();
      const generate = vi.spyOn(mastra.getAgentById('eval-agent'), 'generate');

      // When I start an experiment with agentModel and tweaked instructions
      const summary = await dataset.startExperiment({
        targetType: 'agent',
        targetId: 'eval-agent',
        agentModel: 'eval-test/fake/override-model',
        agentOverrides: { instructions: 'tweaked instructions' },
      });

      // Then it runs on that model
      expect(callsOf(overrideModel)).toHaveLength(2);
      expect(callsOf(defaultModel)).toHaveLength(0);
      // And the model is recorded in agentOverrides, merged with the other tweaks
      const expected = {
        instructions: 'tweaked instructions',
        model: { provider: 'eval-test', name: 'fake/override-model' },
      };
      const experiment = await dataset.getExperiment({ experimentId: summary.experimentId });
      expect(experiment?.metadata).toEqual({ agentModel: 'eval-test/fake/override-model', agentOverrides: expected });
      for (const [, options] of generate.mock.calls) {
        expect(options?.tracingOptions?.metadata).toMatchObject({ agentOverrides: expected });
      }
    });

    it('accepts agentModel and agentOverrides.model when they name the same model', async () => {
      // Given a gateway serving "eval-test/fake/override-model"
      const { dataset, overrideModel } = await setup();
      const model = { provider: 'eval-test/fake', name: 'override-model' };

      // When both name the same model
      const summary = await dataset.startExperiment({
        targetType: 'agent',
        targetId: 'eval-agent',
        agentModel: 'eval-test/fake/override-model',
        agentOverrides: { model },
      });

      // Then it runs on that model and keeps the caller's agentOverrides.model as given
      expect(summary.succeededCount).toBe(2);
      expect(callsOf(overrideModel)).toHaveLength(2);
      const experiment = await dataset.getExperiment({ experimentId: summary.experimentId });
      expect(experiment?.metadata?.agentOverrides).toEqual({ model });
    });
  });

  describe('Scenario Outline: agentOverrides is rejected where it is meaningless', () => {
    const agentOverrides = { instructions: 'tweaked instructions' };
    const examples = [
      { condition: 'a workflow target', config: { targetType: 'workflow' as const, targetId: 'wf', agentOverrides } },
      { condition: 'an inline task', config: { task: async () => 'out', agentOverrides } },
      {
        condition: 'agentModel naming a different model than agentOverrides.model',
        config: {
          targetType: 'agent' as const,
          targetId: 'eval-agent',
          agentModel: textModel('x'),
          agentOverrides: { model: { provider: 'eval-test/fake', name: 'override-model' } },
        },
      },
    ];

    it.each(examples)('startExperiment with $condition throws', async ({ config }) => {
      // Given a dataset
      const { dataset } = await setup();

      // When I start an experiment with agentOverrides and <condition>
      // Then it throws EXPERIMENT_INVALID_AGENT_OVERRIDES
      await expect(dataset.startExperiment(config)).rejects.toMatchObject({ id: 'EXPERIMENT_INVALID_AGENT_OVERRIDES' });
    });

    it.each(examples)(
      'startExperimentAsync with $condition throws before creating an experiment',
      async ({ config }) => {
        // Given a dataset
        const { dataset } = await setup();

        // When I start an async experiment with agentOverrides and <condition>
        // Then it throws EXPERIMENT_INVALID_AGENT_OVERRIDES and nothing is stored
        await expect(dataset.startExperimentAsync(config)).rejects.toMatchObject({
          id: 'EXPERIMENT_INVALID_AGENT_OVERRIDES',
        });
        const { experiments } = await dataset.listExperiments();
        expect(experiments).toEqual([]);
      },
    );
  });
});
