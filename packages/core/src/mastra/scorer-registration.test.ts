import { MockLanguageModelV1 } from '@internal/ai-sdk-v4/test';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';
import { Agent } from '../agent';
import { createScorer } from '../evals/base';
import { RequestContext } from '../request-context';
import { createStep, createWorkflow } from '../workflows';
import { DefaultExecutionEngine } from '../workflows/default';
import { runScorersForStep } from '../workflows/handlers/step';
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

  it('should prefer an exact id match over a name match in getScorerById', () => {
    const nameCollision = createScorer({ id: 'other-scorer', name: 'target-scorer', description: 'collides by name' });
    const exact = createTestScorer('target-scorer');

    const mastra = new Mastra({
      logger: false,
      scorers: { nameCollision, exact },
    });

    expect(mastra.getScorerById('target-scorer')).toBe(exact);
    expect(mastra.getScorerById('target-scorer-name')).toBe(exact);
  });

  it('should register static workflow step scorers before addWorkflow returns', () => {
    const workflowScorer = createTestScorer('workflow-step-scorer');
    const step = createStep({
      id: 'scored-step',
      inputSchema: z.object({ value: z.string() }),
      outputSchema: z.object({ value: z.string() }),
      scorers: {
        workflowStep: { scorer: workflowScorer },
      },
      execute: async ({ inputData }) => inputData,
    });
    const workflow = createWorkflow({
      id: 'scored-workflow',
      inputSchema: z.object({ value: z.string() }),
      outputSchema: z.object({ value: z.string() }),
    })
      .then(step)
      .commit();

    const mastra = new Mastra({ logger: false });
    mastra.addWorkflow(workflow);

    expect(mastra.getScorerById('workflow-step-scorer')).toBe(workflowScorer);
  });

  it('should register a shared workflow step scorer once by id', () => {
    const workflowScorer = createTestScorer('shared-workflow-step-scorer');
    const firstStep = createStep({
      id: 'first-scored-step',
      inputSchema: z.object({ value: z.string() }),
      outputSchema: z.object({ value: z.string() }),
      scorers: {
        shared: { scorer: workflowScorer },
      },
      execute: async ({ inputData }) => inputData,
    });
    const secondStep = createStep({
      id: 'second-scored-step',
      inputSchema: z.object({ value: z.string() }),
      outputSchema: z.object({ value: z.string() }),
      scorers: {
        shared: { scorer: workflowScorer },
      },
      execute: async ({ inputData }) => inputData,
    });
    const workflow = createWorkflow({
      id: 'shared-scorer-workflow',
      inputSchema: z.object({ value: z.string() }),
      outputSchema: z.object({ value: z.string() }),
    })
      .then(firstStep)
      .then(secondStep)
      .commit();

    const mastra = new Mastra({ logger: false });
    mastra.addWorkflow(workflow);

    const allScorers = mastra.listScorers();
    expect(Object.keys(allScorers || {})).toEqual(['shared-workflow-step-scorer']);
    expect(mastra.getScorerById('shared-workflow-step-scorer')).toBe(workflowScorer);
  });

  it('should register dynamic workflow step scorers before running them', async () => {
    const workflowScorer = createTestScorer('dynamic-workflow-step-scorer');
    const mastra = new Mastra({ logger: false });
    const engine = new DefaultExecutionEngine({
      mastra,
      options: {
        validateInputs: true,
        shouldPersistSnapshot: () => true,
      },
    });

    await runScorersForStep({
      engine,
      scorers: async () => ({
        dynamicWorkflowStep: { scorer: workflowScorer },
      }),
      runId: 'run-1',
      workflowId: 'workflow-1',
      stepId: 'step-1',
      input: { value: 'input' },
      output: { value: 'output' },
      requestContext: new RequestContext(),
      disableScorers: false,
    });

    expect(mastra.getScorerById('dynamic-workflow-step-scorer')).toBe(workflowScorer);
  });

  it('should emit score events when workflow step scorers run', async () => {
    const workflowScorer = createTestScorer('workflow-score-event-scorer');
    const workflowScorers = vi.fn().mockReturnValue({
      workflowStep: { scorer: workflowScorer },
    });
    const step = createStep({
      id: 'scored-step',
      inputSchema: z.object({ value: z.string() }),
      outputSchema: z.object({ value: z.string() }),
      scorers: workflowScorers,
      execute: async ({ inputData }) => inputData,
    });
    const workflow = createWorkflow({
      id: 'workflow-score-event',
      inputSchema: z.object({ value: z.string() }),
      outputSchema: z.object({ value: z.string() }),
    })
      .then(step)
      .commit();

    const mastra = new Mastra({
      logger: false,
      storage: {
        init: vi.fn().mockResolvedValue(undefined),
        getStore: vi.fn(async (domain: string) => {
          if (domain === 'scores') {
            return {
              saveScore: vi.fn().mockResolvedValue({ score: {} }),
            };
          }
          return null;
        }),
        __setLogger: vi.fn(),
      } as any,
      workflows: { workflow },
    });
    const addScoreSpy = vi.spyOn(mastra.observability, 'addScore').mockResolvedValue(undefined);
    const scorerRunSpy = vi.spyOn(workflowScorer, 'run');

    const run = await workflow.createRun({ disableScorers: false });
    const result = await run.start({ inputData: { value: 'input' } });

    expect(result.status).toBe('success');
    expect(workflowScorers).toHaveBeenCalled();
    await vi.waitFor(() => {
      expect(scorerRunSpy).toHaveBeenCalled();
    });

    await vi.waitFor(() => {
      expect(addScoreSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          score: expect.objectContaining({
            scorerId: 'workflow-score-event-scorer',
            scorerName: 'workflow-score-event-scorer-name',
            targetEntityType: 'workflow_run',
            score: 1,
          }),
        }),
      );
    });
  });

  it('should save step scores from a nested workflow that is not registered on the Mastra instance', async () => {
    const nestedScorer = createTestScorer('nested-step-scorer');
    const saveScore = vi.fn().mockResolvedValue({ score: {} });
    const innerStep = createStep({
      id: 'inner-step',
      inputSchema: z.object({ value: z.string() }),
      outputSchema: z.object({ value: z.string() }),
      scorers: { nested: { scorer: nestedScorer } },
      execute: async ({ inputData }) => inputData,
    });
    const inner = createWorkflow({
      id: 'inner-workflow',
      inputSchema: z.object({ value: z.string() }),
      outputSchema: z.object({ value: z.string() }),
    })
      .then(innerStep)
      .commit();
    const outer = createWorkflow({
      id: 'outer-workflow',
      inputSchema: z.object({ value: z.string() }),
      outputSchema: z.object({ value: z.string() }),
    })
      .then(inner)
      .commit();

    const mastra = new Mastra({
      logger: false,
      storage: {
        init: vi.fn().mockResolvedValue(undefined),
        getStore: vi.fn(async (domain: string) => (domain === 'scores' ? { saveScore } : null)),
        __setLogger: vi.fn(),
      } as any,
      workflows: { outer },
    });
    vi.spyOn(mastra.observability, 'addScore').mockResolvedValue(undefined);

    const run = await outer.createRun({ disableScorers: false });
    const result = await run.start({ inputData: { value: 'input' } });

    expect(result.status).toBe('success');
    await vi.waitFor(() => {
      expect(saveScore).toHaveBeenCalledWith(expect.objectContaining({ scorerId: 'nested-step-scorer' }));
    });
  });

  describe.each([
    ['top-level', false],
    ['nested, unregistered', true],
  ])('step scorer whose id is also registered on the instance (%s workflow)', (_label, nested) => {
    it("scores with the step's own scorer, not the instance-registered one", async () => {
      const instanceScorer = createScorer({ id: 'quality', description: 'instance' }).generateScore(() => 0.1);
      const stepScorer = createScorer({ id: 'quality', description: 'step' }).generateScore(() => 0.9);
      const saveScore = vi.fn().mockResolvedValue({ score: {} });
      const step = createStep({
        id: 'draft',
        inputSchema: z.object({ value: z.string() }),
        outputSchema: z.object({ value: z.string() }),
        scorers: { quality: { scorer: stepScorer } },
        execute: async ({ inputData }) => inputData,
      });
      const io = { inputSchema: z.object({ value: z.string() }), outputSchema: z.object({ value: z.string() }) };
      const inner = createWorkflow({ id: 'inner', ...io })
        .then(step)
        .commit();
      const wf = nested
        ? createWorkflow({ id: 'outer', ...io })
            .then(inner)
            .commit()
        : createWorkflow({ id: 'outer', ...io })
            .then(step)
            .commit();

      const mastra = new Mastra({
        logger: false,
        storage: {
          init: vi.fn().mockResolvedValue(undefined),
          getStore: vi.fn(async (domain: string) => (domain === 'scores' ? { saveScore } : null)),
          __setLogger: vi.fn(),
        } as any,
        scorers: { quality: instanceScorer },
        workflows: { wf },
      });
      vi.spyOn(mastra.observability, 'addScore').mockResolvedValue(undefined);

      const result = await (await wf.createRun({ disableScorers: false })).start({ inputData: { value: 'x' } });

      expect(result.status).toBe('success');
      await vi.waitFor(() => expect(saveScore).toHaveBeenCalled());
      expect(saveScore).toHaveBeenCalledWith(expect.objectContaining({ scorerId: 'quality', score: 0.9 }));
    });
  });
});
