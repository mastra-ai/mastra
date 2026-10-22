import { createOpenAI } from '@ai-sdk/openai-v5';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';
import { Agent } from '../../../../agent';
import { createDurableAgent } from '../../../../agent/durable';
import { useLoopScenarioAimock } from '../../../../loop/test-utils/aimock/aimock-scenario';
import { Mastra } from '../../../../mastra';
import { InMemoryStore } from '../../../../storage';
import { createStep, createWorkflow } from '../../../../workflows';
import { runExperiment } from '../../index';

/**
 * BDD scenario: an experiment runs an agent on a different model.
 *
 * Given a registered agent whose configured model answers "from base"
 * When an experiment runs against it with `agentModel` set to another model
 * Then every item is answered by the override model,
 *  and the registered agent still uses its own model afterwards.
 */
const getMock = useLoopScenarioAimock();

const BASE_MODEL = 'gpt-4o-mini';
const OVERRIDE_MODEL = 'gpt-4.1';

function aimockBaseURL() {
  return `${getMock().url.replace(/\/+$/, '')}/v1`;
}

function aimockModel(modelId: string) {
  return createOpenAI({ apiKey: 'aimock', baseURL: aimockBaseURL() })(modelId);
}

function scriptModels() {
  const llm = getMock();
  llm.on({ endpoint: 'chat', model: BASE_MODEL }, { content: 'from base' });
  llm.on({ endpoint: 'chat', model: OVERRIDE_MODEL }, { content: 'from override' });
}

function requestedModels(): string[] {
  return getMock()
    .getRequests()
    .map(request => (request.body as { model?: string } | undefined)?.model ?? 'unknown');
}

async function setup(wrap: (agent: Agent) => Agent = agent => agent) {
  const agent = wrap(
    new Agent({
      id: 'model-override-agent',
      name: 'Model Override Agent',
      instructions: 'Answer the prompt.',
      model: aimockModel(BASE_MODEL),
    }),
  );
  const storage = new InMemoryStore();
  const mastra = new Mastra({ agents: { 'model-override-agent': agent }, storage, logger: false });
  const datasetsStore = (await storage.getStore('datasets'))!;
  const dataset = await datasetsStore.createDataset({ name: 'model override ds' });
  await datasetsStore.addItem({ datasetId: dataset.id, input: 'first prompt' });
  await datasetsStore.addItem({ datasetId: dataset.id, input: 'second prompt' });
  return { mastra, datasetId: dataset.id };
}

const engines = [
  { name: 'agent', wrap: (agent: Agent) => agent },
  { name: 'durable agent', wrap: (agent: Agent) => createDurableAgent({ agent }) as unknown as Agent },
];

describe('Experiment scenario: override the agent model', () => {
  for (const engine of engines) {
    describe(`with a ${engine.name}`, () => {
      it('answers every item with the override model', async () => {
        scriptModels();
        const { mastra, datasetId } = await setup(engine.wrap);

        const summary = await runExperiment(mastra, {
          datasetId,
          targetType: 'agent',
          targetId: 'model-override-agent',
          agentModel: aimockModel(OVERRIDE_MODEL),
          scorers: [],
        });

        expect(summary.status).toBe('completed');
        expect(summary.succeededCount).toBe(2);
        for (const item of summary.results) {
          expect(item.error).toBeNull();
          expect((item.output as { text?: string } | null)?.text).toBe('from override');
        }
        expect(requestedModels()).toEqual([OVERRIDE_MODEL, OVERRIDE_MODEL]);
      });

      it('leaves the registered agent on its own model', async () => {
        scriptModels();
        const { mastra, datasetId } = await setup(engine.wrap);

        await runExperiment(mastra, {
          datasetId,
          targetType: 'agent',
          targetId: 'model-override-agent',
          agentModel: aimockModel(OVERRIDE_MODEL),
          scorers: [],
        });
        getMock().clearRequests();

        const baseline = await runExperiment(mastra, {
          datasetId,
          targetType: 'agent',
          targetId: 'model-override-agent',
          scorers: [],
        });

        for (const item of baseline.results) {
          expect((item.output as { text?: string } | null)?.text).toBe('from base');
        }
        expect(requestedModels()).toEqual([BASE_MODEL, BASE_MODEL]);
        const direct = await mastra.getAgentById('model-override-agent').generate('direct call');
        expect(direct.text).toBe('from base');
      });
    });
  }

  it('accepts a serializable provider/model config', async () => {
    scriptModels();
    const { mastra, datasetId } = await setup();

    const summary = await runExperiment(mastra, {
      datasetId,
      targetType: 'agent',
      targetId: 'model-override-agent',
      agentModel: { id: `openai/${OVERRIDE_MODEL}`, url: aimockBaseURL(), apiKey: 'aimock' },
      scorers: [],
    });

    expect(summary.succeededCount).toBe(2);
    expect(summary.results.map(item => (item.output as { text?: string } | null)?.text)).toEqual([
      'from override',
      'from override',
    ]);
  });

  it('keeps the override when experiment versions select the target agent', async () => {
    scriptModels();
    const { mastra, datasetId } = await setup();
    // Core has no editor to store versions; stub the version lookup so a
    // selected stored version would answer on the base model.
    const storedVersion = mastra.getAgentById('model-override-agent').__fork();
    const resolveSpy = vi.spyOn(mastra, 'resolveVersionedAgent').mockResolvedValue(storedVersion);

    const summary = await runExperiment(mastra, {
      datasetId,
      targetType: 'agent',
      targetId: 'model-override-agent',
      agentModel: aimockModel(OVERRIDE_MODEL),
      versions: { agents: { 'model-override-agent': { status: 'draft' } } },
      scorers: [],
    });

    expect(summary.results.map(item => (item.output as { text?: string } | null)?.text)).toEqual([
      'from override',
      'from override',
    ]);
    expect(resolveSpy).not.toHaveBeenCalledWith(expect.anything(), { status: 'draft' });
  });

  it('rejects a model override for a non-agent target', async () => {
    const step = createStep({
      id: 'echo',
      inputSchema: z.unknown(),
      outputSchema: z.unknown(),
      execute: async ({ inputData }) => inputData,
    });
    const workflow = createWorkflow({ id: 'echo-workflow', inputSchema: z.unknown(), outputSchema: z.unknown() })
      .then(step)
      .commit();
    const storage = new InMemoryStore();
    const mastra = new Mastra({ workflows: { 'echo-workflow': workflow }, storage, logger: false });
    const datasetsStore = (await storage.getStore('datasets'))!;
    const dataset = await datasetsStore.createDataset({ name: 'workflow ds' });
    await datasetsStore.addItem({ datasetId: dataset.id, input: 'x' });

    await expect(
      runExperiment(mastra, {
        datasetId: dataset.id,
        targetType: 'workflow',
        targetId: 'echo-workflow',
        agentModel: aimockModel(OVERRIDE_MODEL),
        scorers: [],
      }),
    ).rejects.toThrow(/agentModel.*agent target/);
  });
});
