import { MockLanguageModelV1 } from '@internal/ai-sdk-v4/test';
import { describe, expect, it } from 'vitest';
import { Agent } from '../agent';
import { createScorer } from '../evals/base';
import { Mastra } from './index';

/**
 * Tests for scorer registration in Mastra.addAgent.
 *
 * When an agent is added to Mastra, its scorers should be
 * automatically registered with the Mastra instance so they
 * are discoverable via mastra.getScorer()/getScorerById().
 */
describe('Scorer Registration', () => {
  const waitForScorerRegistration = () => new Promise(resolve => setTimeout(resolve, 50));

  const createMockModel = () =>
    new MockLanguageModelV1({
      doGenerate: async () => ({
        rawCall: { rawPrompt: null, rawSettings: {} },
        finishReason: 'stop',
        usage: { promptTokens: 10, completionTokens: 20 },
        text: 'Test response',
      }),
    });

  const createTestScorer = (id: string) =>
    createScorer({
      id,
      name: `${id}-name`,
      description: `A test scorer: ${id}`,
    }).generateScore(() => 1);

  it('should register agent-level scorers to the Mastra instance', async () => {
    const scorer = createTestScorer('my-scorer');

    const agent = new Agent({
      id: 'test-agent',
      name: 'Test Agent',
      instructions: 'Test',
      model: createMockModel(),
      scorers: {
        myScorer: { scorer },
      },
    });

    const mastra = new Mastra({
      logger: false,
      agents: { testAgent: agent },
    });

    await waitForScorerRegistration();

    const registered = mastra.getScorer('my-scorer');
    expect(registered).toBeDefined();
    expect(registered.id).toBe('my-scorer');
  });

  it('should make agent-level scorers findable by getScorerById', async () => {
    const scorer = createTestScorer('findable-scorer');

    const agent = new Agent({
      id: 'test-agent-findable',
      name: 'Test Agent',
      instructions: 'Test',
      model: createMockModel(),
      scorers: {
        findable: { scorer },
      },
    });

    const mastra = new Mastra({
      logger: false,
      agents: { testAgent: agent },
    });

    await waitForScorerRegistration();

    const registered = mastra.getScorerById('findable-scorer');
    expect(registered).toBeDefined();
    expect(registered.id).toBe('findable-scorer');
  });

  it('should register multiple scorers from a single agent', async () => {
    const scorer1 = createTestScorer('scorer-a');
    const scorer2 = createTestScorer('scorer-b');

    const agent = new Agent({
      id: 'test-agent-multi',
      name: 'Test Agent',
      instructions: 'Test',
      model: createMockModel(),
      scorers: {
        a: { scorer: scorer1 },
        b: { scorer: scorer2 },
      },
    });

    const mastra = new Mastra({
      logger: false,
      agents: { testAgent: agent },
    });

    await waitForScorerRegistration();

    expect(mastra.getScorer('scorer-a')).toBeDefined();
    expect(mastra.getScorer('scorer-b')).toBeDefined();
  });

  it('should register scorers from multiple agents', async () => {
    const scorer1 = createTestScorer('agent1-scorer');
    const scorer2 = createTestScorer('agent2-scorer');

    const agent1 = new Agent({
      id: 'agent-1',
      name: 'Agent 1',
      instructions: 'Test',
      model: createMockModel(),
      scorers: { s: { scorer: scorer1 } },
    });

    const agent2 = new Agent({
      id: 'agent-2',
      name: 'Agent 2',
      instructions: 'Test',
      model: createMockModel(),
      scorers: { s: { scorer: scorer2 } },
    });

    const mastra = new Mastra({
      logger: false,
      agents: { agent1, agent2 },
    });

    await waitForScorerRegistration();

    expect(mastra.getScorer('agent1-scorer')).toBeDefined();
    expect(mastra.getScorer('agent2-scorer')).toBeDefined();
  });

  it('should not fail when agent has no scorers', async () => {
    const agent = new Agent({
      id: 'test-agent-no-scorers',
      name: 'Test Agent',
      instructions: 'Test',
      model: createMockModel(),
    });

    const mastra = new Mastra({
      logger: false,
      agents: { testAgent: agent },
    });

    await waitForScorerRegistration();

    const allScorers = mastra.listScorers();
    expect(Object.keys(allScorers || {})).toHaveLength(0);
  });

  it('should not duplicate scorers already registered at the Mastra level', async () => {
    const scorer = createTestScorer('shared-scorer');

    const agent = new Agent({
      id: 'test-agent-dup',
      name: 'Test Agent',
      instructions: 'Test',
      model: createMockModel(),
      scorers: { s: { scorer } },
    });

    const mastra = new Mastra({
      logger: false,
      scorers: { 'shared-scorer': scorer },
      agents: { testAgent: agent },
    });

    await waitForScorerRegistration();

    // Should still only have one entry
    const allScorers = mastra.listScorers();
    expect(Object.keys(allScorers || {})).toHaveLength(1);
    expect(mastra.getScorer('shared-scorer')).toBeDefined();
  });

  it('should include agent-level scorers in listScorers()', async () => {
    const agentScorer = createTestScorer('agent-level-scorer');
    const mastraScorer = createTestScorer('mastra-level-scorer');

    const agent = new Agent({
      id: 'test-agent-list',
      name: 'Test Agent',
      instructions: 'Test',
      model: createMockModel(),
      scorers: { s: { scorer: agentScorer } },
    });

    const mastra = new Mastra({
      logger: false,
      scorers: { 'mastra-level-scorer': mastraScorer },
      agents: { testAgent: agent },
    });

    await waitForScorerRegistration();

    const allScorers = mastra.listScorers();
    expect(Object.keys(allScorers || {})).toHaveLength(2);
    expect(allScorers?.['mastra-level-scorer']).toBeDefined();
    expect(allScorers?.['agent-level-scorer']).toBeDefined();
  });
});
