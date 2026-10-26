import { expect, it } from 'vitest';
import { z } from 'zod/v4';
import { Agent } from '../../../../agent';
import { MockMemory } from '../../../../memory/mock';
import { createStep, createWorkflow } from '../../../../workflows';
import { describeForAllEngines, useLoopScenarioAimock } from '../aimock-scenario';
import {
  complete,
  drain,
  forEngine,
  isAgentRequest,
  isCompletionRequest,
  isRoutingRequest,
  NETWORK_ENGINE_SKIP,
  routeTo,
  scenarioModel,
} from '../network-fixtures';

/**
 * agent.network() routing to a workflow that runs to completion: the step calls
 * an agent with structured output, and the workflow result reaches the network's
 * workflow-execution-end chunk before the run finishes.
 */
describeForAllEngines(
  'AIMock network scenario: routed workflow completes',
  engine => {
    const getMock = useLoopScenarioAimock();

    it('runs a routed workflow whose step generates structured output', async () => {
      const llm = getMock();
      llm.on(
        { endpoint: 'chat', predicate: isRoutingRequest },
        routeTo('researchWorkflow', 'workflow', JSON.stringify({ topic: 'machine learning' })),
      );
      llm.on(
        { endpoint: 'chat', predicate: isAgentRequest('RESEARCH_MARK') },
        { content: JSON.stringify({ summary: 'ML learns patterns from data.' }) },
      );
      llm.on({ endpoint: 'chat', predicate: isCompletionRequest }, complete('Research done'));

      const researchAgent = new Agent({
        id: 'research-agent',
        name: 'research-agent',
        instructions: 'RESEARCH_MARK',
        model: scenarioModel(llm),
      });
      const researchStep = createStep({
        id: 'research-step',
        inputSchema: z.object({ topic: z.string() }),
        outputSchema: z.object({ summary: z.string() }),
        execute: async ({ inputData }) => {
          const resp = await researchAgent.generate(`Research: ${inputData.topic}`, {
            structuredOutput: { schema: z.object({ summary: z.string() }) },
          });
          return { summary: resp.object.summary };
        },
      });
      const researchWorkflow = createWorkflow({
        id: 'research-workflow',
        description: 'Workflow for researching topics',
        inputSchema: z.object({ topic: z.string() }),
        outputSchema: z.object({ summary: z.string() }),
      })
        .then(researchStep)
        .commit();
      const network = new Agent({
        id: 'network-workflow-agent',
        name: 'network-workflow-agent',
        instructions: 'Coordinate research workflows.',
        model: scenarioModel(llm),
        workflows: { researchWorkflow },
        memory: new MockMemory(),
      });

      const chunks = await drain(
        await forEngine(network, engine).network('Execute research-workflow on machine learning', {
          maxSteps: 2,
          memory: { thread: 'wf-t', resource: 'wf-r' },
        }),
      );

      const types = chunks.map(c => c.type);
      expect(types).toContain('workflow-execution-start');
      expect(types.at(-1)).toBe('network-execution-event-finish');
      const end = chunks.find(c => c.type === 'workflow-execution-end');
      // WorkflowExecutionEndPayload declares `result: string`, but the network emits the workflow's result object.
      expect((end?.payload as unknown as { result: { result: unknown } }).result.result).toEqual({
        summary: 'ML learns patterns from data.',
      });
      const finish = chunks.at(-1);
      expect((finish?.payload as { result: string }).result).toBe('Research done');
    });
  },
  NETWORK_ENGINE_SKIP,
);
