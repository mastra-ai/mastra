import { createOpenAI } from '@ai-sdk/openai-v5';
import { LLMock } from '@copilotkit/aimock';
import { Agent } from '@mastra/core/agent';
import { Mastra } from '@mastra/core/mastra';
import { InMemoryStore } from '@mastra/core/storage';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { TRIGGER_EXPERIMENT_ROUTE } from './datasets';
import { createTestServerContext } from './test-utils';

/**
 * BDD: trigger an experiment over HTTP with a different agent model.
 *
 * Given a registered agent whose configured model answers "from base"
 * When POST /datasets/:datasetId/experiments carries agentModel { provider, modelId }
 * Then the experiment answers every item with that model
 *  and the registered agent keeps its own model.
 */
describe('TRIGGER_EXPERIMENT_ROUTE agentModel', () => {
  let llm: LLMock;
  let storage: InMemoryStore;
  let mastra: Mastra;

  beforeAll(async () => {
    llm = new LLMock({ port: 0 });
    await llm.start();
  });

  afterAll(async () => {
    await llm.stop();
  });

  beforeEach(async () => {
    const baseURL = `${llm.url.replace(/\/+$/, '')}/v1`;
    // Model-router strings like "openai/gpt-4.1" read these, so the override reaches aimock.
    vi.stubEnv('OPENAI_BASE_URL', baseURL);
    vi.stubEnv('OPENAI_API_KEY', 'aimock');
    llm.on({ endpoint: 'chat', model: 'gpt-4o-mini' }, { content: 'from base' });
    llm.on({ endpoint: 'chat', model: 'gpt-4.1' }, { content: 'from override' });

    storage = new InMemoryStore();
    await storage.init();
    const agent = new Agent({
      id: 'support-agent',
      name: 'Support Agent',
      instructions: 'Answer the prompt.',
      model: createOpenAI({ apiKey: 'aimock', baseURL })('gpt-4o-mini'),
    });
    mastra = new Mastra({ logger: false, storage, agents: { 'support-agent': agent } });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    llm.clearFixtures();
    llm.clearRequests();
  });

  async function trigger(body: Record<string, unknown>) {
    const dataset = await mastra.datasets.create({ name: 'Agent model DS' });
    await dataset.addItem({ input: 'first prompt' });
    await dataset.addItem({ input: 'second prompt' });
    const parsed = TRIGGER_EXPERIMENT_ROUTE.bodySchema.parse(body);
    const triggered = (await TRIGGER_EXPERIMENT_ROUTE.handler({
      ...createTestServerContext({ mastra }),
      datasetId: dataset.id,
      ...parsed,
    } as any)) as { experimentId: string };
    return triggered.experimentId;
  }

  async function outputsOf(experimentId: string) {
    const experiments = (await storage.getStore('experiments'))!;
    await vi.waitFor(
      async () => {
        const experiment = await experiments.getExperimentById({ id: experimentId });
        expect(experiment?.status).toBe('completed');
      },
      { timeout: 10_000 },
    );
    const { results } = await experiments.listExperimentResults({
      experimentId,
      pagination: { page: 0, perPage: 10 },
    });
    return results.map(result => (result.output as { text?: string } | null)?.text);
  }

  it('runs the agent on the requested model', async () => {
    const experimentId = await trigger({
      targetType: 'agent',
      targetId: 'support-agent',
      agentModel: { provider: 'openai', modelId: 'gpt-4.1' },
    });

    expect(await outputsOf(experimentId)).toEqual(['from override', 'from override']);
    expect(llm.getRequests().map(request => (request.body as { model?: string }).model)).toEqual([
      'gpt-4.1',
      'gpt-4.1',
    ]);

    const direct = await mastra.getAgentById('support-agent').generate('direct call');
    expect(direct.text).toBe('from base');
  });

  it('runs the agent on its own model when agentModel is omitted', async () => {
    const experimentId = await trigger({ targetType: 'agent', targetId: 'support-agent' });

    expect(await outputsOf(experimentId)).toEqual(['from base', 'from base']);
  });

  function agentModelIssues(body: Record<string, unknown>) {
    const result = TRIGGER_EXPERIMENT_ROUTE.bodySchema.safeParse(body);
    expect(result.success).toBe(false);
    return result.error!.issues.filter(issue => issue.path.join('.') === 'agentModel').map(issue => issue.message);
  }

  it('rejects agentModel for a non-agent target before the handler', () => {
    expect(
      agentModelIssues({
        targetType: 'workflow',
        targetId: 'some-workflow',
        agentModel: { provider: 'openai', modelId: 'gpt-4.1' },
      }),
    ).toEqual(['agentModel is only supported for agent targets']);
  });

  it('rejects agentModel on a create-only experiment before the handler', () => {
    expect(
      agentModelIssues({
        start: false,
        targetType: 'agent',
        targetId: 'support-agent',
        agentModel: { provider: 'openai', modelId: 'gpt-4.1' },
      }),
    ).toEqual(['agentModel requires start: true; create-only experiments do not keep a model override']);
  });

  it('rejects an incomplete agentModel before the handler', () => {
    const base = { targetType: 'agent', targetId: 'support-agent' };
    expect(TRIGGER_EXPERIMENT_ROUTE.bodySchema.safeParse({ ...base, agentModel: { provider: 'openai' } }).success).toBe(
      false,
    );
    expect(
      TRIGGER_EXPERIMENT_ROUTE.bodySchema.safeParse({ ...base, agentModel: { provider: '', modelId: 'gpt-4.1' } })
        .success,
    ).toBe(false);
  });
});
