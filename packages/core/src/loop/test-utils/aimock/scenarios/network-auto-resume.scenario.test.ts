import type { ChatCompletionRequest } from '@copilotkit/aimock';
import { expect, it } from 'vitest';
import { z } from 'zod/v4';
import { Agent } from '../../../../agent';
import { Mastra } from '../../../../mastra';
import { MockMemory } from '../../../../memory/mock';
import { InMemoryStore } from '../../../../storage';
import { createTool } from '../../../../tools';
import { createStep, createWorkflow } from '../../../../workflows';
import { describeForAllEngines, useLoopScenarioAimock } from '../aimock-scenario';
import {
  complete,
  drain,
  isAgentRequest,
  isCompletionRequest,
  isRoutingRequest,
  requestText,
  routeTo,
  scenarioModel,
  forEngine,
  NETWORK_ENGINE_SKIP,
} from '../network-fixtures';

/**
 * agent.network() with `defaultNetworkOptions.autoResumeSuspendedTools`: after a
 * run suspends, a plain follow-up `network(message)` call on the same thread
 * reads the suspended primitive from memory, asks the model to build resume data
 * from the message, and resumes the suspended run instead of starting a new one.
 * Covers a tool the router calls directly, a tool inside a sub-agent, and a
 * routed workflow.
 *
 * Replaces the skipped "autoResumeSuspendedTools" block from
 * packages/core/src/agent/agent-network.e2e.test.ts.
 */
describeForAllEngines(
  'AIMock network scenario: autoResumeSuspendedTools',
  engine => {
    const getMock = useLoopScenarioAimock();
    const lastIsToolResult = (req: ChatCompletionRequest | null) => req?.messages.at(-1)?.role === 'tool';
    const isResumeDataRequest = (req: ChatCompletionRequest | null) =>
      requestText(req).includes('You are an assistant used to resume a suspended tool call.');
    const resumeWith = (resumeData: Record<string, unknown>) => ({
      content: JSON.stringify({ resumeData: JSON.stringify(resumeData) }),
    });

    const suspendingTool = createTool({
      id: 'suspendingTool',
      description: 'Collects user information.',
      inputSchema: z.object({ initialQuery: z.string() }),
      suspendSchema: z.object({ message: z.string() }),
      resumeSchema: z.object({ userResponse: z.string() }),
      execute: async (input, context) => {
        if (!context?.agent?.resumeData) {
          return await context?.agent?.suspend({ message: 'Please provide additional information' });
        }
        return { result: `Received: ${input.initialQuery} and ${context.agent.resumeData.userResponse}` };
      },
    });

    function register(network: Agent) {
      return new Mastra({
        agents: { network: forEngine(network, engine) },
        storage: new InMemoryStore(),
        logger: false,
      }).getAgent('network');
    }

    it('resumes a suspended directly routed tool from a follow-up message', async () => {
      const llm = getMock();
      llm.on({ endpoint: 'chat', predicate: isResumeDataRequest }, resumeWith({ userResponse: 'my additional info' }));
      llm.on(
        { endpoint: 'chat', predicate: isRoutingRequest },
        routeTo('suspendingTool', 'tool', JSON.stringify({ initialQuery: 'starting data' })),
      );
      llm.on({ endpoint: 'chat', predicate: isCompletionRequest }, complete('Task completed successfully'));
      const agent = register(
        new Agent({
          id: 'auto-resume-direct',
          name: 'auto-resume-direct',
          instructions: 'Use the suspending tool.',
          model: scenarioModel(llm),
          tools: { suspendingTool },
          memory: new MockMemory(),
          defaultNetworkOptions: { autoResumeSuspendedTools: true },
        }),
      );
      const memory = { thread: 'ard-t', resource: 'ard-r' };

      const first = await drain(await forEngine(agent, engine).network('Collect information', { memory }));
      expect(first.at(-1)?.type).toBe('tool-execution-suspended');
      expect((first.at(-1)?.payload as { suspendPayload: unknown }).suspendPayload).toEqual({
        message: 'Please provide additional information',
      });

      const resumed = await drain(await forEngine(agent, engine).network('my additional info', { memory }));

      expect(resumed[0]?.type).toBe('tool-execution-start');
      expect(resumed.at(-1)?.type).toBe('network-execution-event-finish');
      const end = resumed.find(c => c.type === 'tool-execution-end');
      expect((end?.payload as { result: unknown }).result).toEqual({
        result: 'Received: starting data and my additional info',
      });
      const resumeRequest = llm.getRequests().find(r => isResumeDataRequest(r.body));
      expect(requestText(resumeRequest!.body)).toContain('my additional info');
    });

    it('resumes a tool suspended inside a sub-agent from a follow-up message', async () => {
      const llm = getMock();
      llm.on({ endpoint: 'chat', predicate: isResumeDataRequest }, resumeWith({ userResponse: 'nested resume data' }));
      llm.on({ endpoint: 'chat', predicate: isRoutingRequest }, routeTo('subAgent', 'agent', 'Collect information'));
      llm.on(
        { endpoint: 'chat', predicate: req => isAgentRequest('ARSUB_MARK')(req) && !lastIsToolResult(req) },
        { toolCalls: [{ id: 'call-ar-1', name: 'suspendingTool', arguments: { initialQuery: 'nested' } }] },
      );
      llm.on(
        { endpoint: 'chat', predicate: req => isAgentRequest('ARSUB_MARK')(req) && lastIsToolResult(req) },
        { content: 'Collected.' },
      );
      llm.on({ endpoint: 'chat', predicate: isCompletionRequest }, complete('Task completed successfully'));
      const subAgent = new Agent({
        id: 'subAgent',
        name: 'subAgent',
        description: 'Collects information with the suspending tool',
        instructions: 'ARSUB_MARK',
        model: scenarioModel(llm),
        tools: { suspendingTool },
      });
      const agent = register(
        new Agent({
          id: 'auto-resume-nested',
          name: 'auto-resume-nested',
          instructions: 'Delegate to subAgent.',
          model: scenarioModel(llm),
          agents: { subAgent },
          memory: new MockMemory(),
          defaultNetworkOptions: { autoResumeSuspendedTools: true },
        }),
      );
      const memory = { thread: 'arn-t', resource: 'arn-r' };

      const first = await drain(await forEngine(agent, engine).network('Collect information', { memory }));
      expect(first.at(-1)?.type).toBe('agent-execution-suspended');
      expect((first.at(-1)?.payload as { suspendPayload: unknown }).suspendPayload).toEqual({
        message: 'Please provide additional information',
      });

      const resumed = await drain(await forEngine(agent, engine).network('nested resume data', { memory }));

      expect(resumed[0]?.type).toBe('agent-execution-start');
      expect(resumed.at(-1)?.type).toBe('network-execution-event-finish');
      expect(resumed.map(c => c.type)).toContain('agent-execution-end');
      const toolResult = resumed.find(c => c.type === 'agent-execution-event-tool-result');
      expect((toolResult?.payload as { payload?: { result?: unknown } }).payload?.result).toEqual({
        result: 'Received: nested and nested resume data',
      });
    });

    it('resumes a suspended routed workflow from a follow-up message', async () => {
      const llm = getMock();
      llm.on({ endpoint: 'chat', predicate: isResumeDataRequest }, resumeWith({ userInput: 'workflow resume input' }));
      llm.on(
        { endpoint: 'chat', predicate: isRoutingRequest },
        routeTo('suspendingWorkflow', 'workflow', JSON.stringify({ query: 'workflow test' })),
      );
      llm.on({ endpoint: 'chat', predicate: isCompletionRequest }, complete('Task completed successfully'));
      const suspendingStep = createStep({
        id: 'suspending-step',
        inputSchema: z.object({ query: z.string() }),
        suspendSchema: z.object({ message: z.string() }),
        resumeSchema: z.object({ userInput: z.string() }),
        outputSchema: z.object({ result: z.string() }),
        execute: async ({ inputData, suspend, resumeData }) => {
          if (!resumeData) return await suspend({ message: 'Please provide user input for workflow' });
          return { result: `Workflow received: ${inputData.query} and ${resumeData.userInput}` };
        },
      });
      const suspendingWorkflow = createWorkflow({
        id: 'suspending-workflow',
        description: 'Collects user input.',
        inputSchema: z.object({ query: z.string() }),
        outputSchema: z.object({ result: z.string() }),
      })
        .then(suspendingStep)
        .commit();
      const agent = register(
        new Agent({
          id: 'auto-resume-workflow',
          name: 'auto-resume-workflow',
          instructions: 'Run the workflow.',
          model: scenarioModel(llm),
          workflows: { suspendingWorkflow },
          memory: new MockMemory(),
          defaultNetworkOptions: { autoResumeSuspendedTools: true },
        }),
      );
      const memory = { thread: 'arw-t', resource: 'arw-r' };

      const first = await drain(await forEngine(agent, engine).network('Run the workflow', { memory }));
      expect(first.at(-1)?.type).toBe('workflow-execution-suspended');
      expect((first.at(-1)?.payload as { suspendPayload: unknown }).suspendPayload).toEqual({
        message: 'Please provide user input for workflow',
      });

      const resumed = await drain(await forEngine(agent, engine).network('workflow resume input', { memory }));

      expect(resumed[0]?.type).toBe('workflow-execution-start');
      expect(resumed.at(-1)?.type).toBe('network-execution-event-finish');
      const end = resumed.find(c => c.type === 'workflow-execution-end');
      // WorkflowExecutionEndPayload declares `result: string`, but the network emits the workflow's result object.
      expect((end?.payload as unknown as { result: { result: unknown } }).result.result).toEqual({
        result: 'Workflow received: workflow test and workflow resume input',
      });
    });
  },
  NETWORK_ENGINE_SKIP,
);
