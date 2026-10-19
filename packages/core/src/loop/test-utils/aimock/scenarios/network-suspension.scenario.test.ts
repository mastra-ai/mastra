import type { ChatCompletionRequest } from '@copilotkit/aimock';
import { beforeEach, expect, it } from 'vitest';
import { z } from 'zod/v4';
import { Agent } from '../../../../agent';
import { Mastra } from '../../../../mastra';
import { MockMemory } from '../../../../memory/mock';
import { MASTRA_SCOPES_KEY, RequestContext } from '../../../../request-context';
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
  routeTo,
  scenarioModel,
  forEngine,
  NETWORK_ENGINE_SKIP,
} from '../network-fixtures';

/**
 * agent.network() suspension and resumeNetwork: a suspending tool the router
 * calls directly, a suspending tool inside a sub-agent, a suspending workflow,
 * and the scope checks applied when a suspended network run is resumed.
 */
describeForAllEngines(
  'AIMock network scenario: suspension and resumeNetwork',
  engine => {
    const getMock = useLoopScenarioAimock();
    const lastIsToolResult = (req: ChatCompletionRequest | null) => req?.messages.at(-1)?.role === 'tool';

    // Scopes the resumed tool call ran with; reset per test.
    let resumedScopes: unknown[] = [];
    beforeEach(() => {
      resumedScopes = [];
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
        resumedScopes.push(context.requestContext?.get(MASTRA_SCOPES_KEY));
        return { result: `Received: ${input.initialQuery} and ${context.agent.resumeData.userResponse}` };
      },
    });

    function directToolNetwork(id: string, initialQuery: string) {
      const llm = getMock();
      llm.on(
        { endpoint: 'chat', predicate: isRoutingRequest },
        routeTo('suspendingTool', 'tool', JSON.stringify({ initialQuery })),
      );
      llm.on({ endpoint: 'chat', predicate: isCompletionRequest }, complete('Task completed successfully'));
      const memory = new MockMemory();
      const network = new Agent({
        id,
        name: id,
        instructions: 'Use the suspending tool.',
        model: scenarioModel(llm),
        tools: { suspendingTool },
        memory,
      });
      const mastra = new Mastra({
        agents: { network: forEngine(network, engine) },
        storage: new InMemoryStore(),
        logger: false,
      });
      return { agent: mastra.getAgent('network'), mastra, memory };
    }

    async function loadSnapshot(mastra: Mastra, runId: string) {
      const store = await mastra.getStorage()!.getStore('workflows');
      const snapshot = await store!.loadWorkflowSnapshot({ workflowName: 'agent-loop-main-workflow', runId });
      return { store: store!, snapshot: snapshot as unknown as { requestContext?: Record<string, unknown> } };
    }

    it('suspends a directly routed tool and resumes it with the resume data', async () => {
      const { agent } = directToolNetwork('suspend-direct', 'starting data');
      const memory = { thread: 'sd-t', resource: 'sd-r' };

      const stream = await forEngine(agent, engine).network('Collect information', { memory });
      const chunks = await drain(stream);
      const suspended = chunks.at(-1);
      expect(suspended?.type).toBe('tool-execution-suspended');
      expect((suspended?.payload as { suspendPayload: unknown }).suspendPayload).toEqual({
        message: 'Please provide additional information',
      });

      const resumed = await drain(
        await forEngine(agent, engine).resumeNetwork(
          { userResponse: 'my additional info' },
          { runId: stream.runId, memory },
        ),
      );

      expect(resumed[0]?.type).toBe('tool-execution-start');
      expect(resumed.at(-1)?.type).toBe('network-execution-event-finish');
      const end = resumed.find(c => c.type === 'tool-execution-end');
      expect((end?.payload as { result: unknown }).result).toEqual({
        result: 'Received: starting data and my additional info',
      });
    });

    it('resumes with a subset of the run scopes and rejects a resume that adds a scope', async () => {
      const { agent } = directToolNetwork('scoped', 'scoped');
      const stream = await forEngine(agent, engine).network('Collect information', {
        scopes: ['org:a', 'resource:scoped-resource', 'thread:scoped-thread'],
      });
      await drain(stream);

      await expect(
        forEngine(agent, engine).resumeNetwork(
          { userResponse: 'nope' },
          { runId: stream.runId, requestContext: new RequestContext([[MASTRA_SCOPES_KEY, ['org:b']]]) },
        ),
      ).rejects.toMatchObject({ id: 'AGENT_SCOPES_CONFLICT' });

      const resumed = await drain(
        await forEngine(agent, engine).resumeNetwork(
          { userResponse: 'scoped info' },
          {
            runId: stream.runId,
            requestContext: new RequestContext([[MASTRA_SCOPES_KEY, ['org:a', 'thread:scoped-thread']]]),
          },
        ),
      );
      const end = resumed.find(c => c.type === 'tool-execution-end');
      expect((end?.payload as { result: unknown }).result).toEqual({ result: 'Received: scoped and scoped info' });
    });

    it('records an empty scope set so a scopeless run rejects a resume that adds scopes', async () => {
      const { agent, mastra } = directToolNetwork('stamped', 'stamped');
      const stream = await forEngine(agent, engine).network('Collect information', {
        memory: { thread: 'st-t', resource: 'st-r' },
      });
      await drain(stream);

      const { snapshot } = await loadSnapshot(mastra, stream.runId);
      expect(snapshot.requestContext?.[MASTRA_SCOPES_KEY]).toEqual([]);
      await expect(
        forEngine(agent, engine).resumeNetwork(
          { userResponse: 'nope' },
          { runId: stream.runId, requestContext: new RequestContext([[MASTRA_SCOPES_KEY, ['org:a']]]) },
        ),
      ).rejects.toMatchObject({ id: 'AGENT_SCOPES_CONFLICT' });
    });

    it('adopts the supplied scopes when resuming a snapshot saved before scopes were recorded', async () => {
      const { agent, mastra } = directToolNetwork('legacy', 'legacy');
      const stream = await forEngine(agent, engine).network('Collect information', {
        memory: { thread: 'lg-t', resource: 'lg-r' },
      });
      await drain(stream);

      // Simulate a run suspended by a release that did not record scopes.
      const { store, snapshot } = await loadSnapshot(mastra, stream.runId);
      delete snapshot.requestContext?.[MASTRA_SCOPES_KEY];
      await store.persistWorkflowSnapshot({
        workflowName: 'agent-loop-main-workflow',
        runId: stream.runId,
        snapshot: snapshot as never,
      });

      const resumed = await drain(
        await forEngine(agent, engine).resumeNetwork(
          { userResponse: 'legacy info' },
          { runId: stream.runId, requestContext: new RequestContext([[MASTRA_SCOPES_KEY, ['org:a']]]) },
        ),
      );
      const end = resumed.find(c => c.type === 'tool-execution-end');
      expect((end?.payload as { result: unknown }).result).toEqual({ result: 'Received: legacy and legacy info' });
      expect(resumedScopes).toEqual([['org:a']]);
    });

    it('uses the run id as the thread when resuming without memory options', async () => {
      const { agent, memory } = directToolNetwork('unscoped', 'plain');
      const stream = await forEngine(agent, engine).network('Collect information', {
        memory: { thread: 'un-t', resource: 'un-r' },
      });
      await drain(stream);
      expect(await memory.getThreadById({ threadId: stream.runId })).toBeNull();

      const resumed = await drain(
        await forEngine(agent, engine).resumeNetwork({ userResponse: 'plain info' }, { runId: stream.runId }),
      );

      expect(resumed.at(-1)?.type).toBe('network-execution-event-finish');
      expect(await memory.getThreadById({ threadId: stream.runId })).not.toBeNull();
    });

    it('suspends a tool inside a sub-agent and resumes the sub-agent with the resume data', async () => {
      const llm = getMock();
      llm.on({ endpoint: 'chat', predicate: isRoutingRequest }, routeTo('subAgent', 'agent', 'Collect information'));
      llm.on(
        { endpoint: 'chat', predicate: req => isAgentRequest('SUBAGENT_MARK')(req) && !lastIsToolResult(req) },
        { toolCalls: [{ id: 'call-sus-1', name: 'suspendingTool', arguments: { initialQuery: 'nested' } }] },
      );
      llm.on(
        { endpoint: 'chat', predicate: req => isAgentRequest('SUBAGENT_MARK')(req) && lastIsToolResult(req) },
        { content: 'Collected.' },
      );
      llm.on({ endpoint: 'chat', predicate: isCompletionRequest }, complete('Task completed successfully'));
      const subAgent = new Agent({
        id: 'subAgent',
        name: 'subAgent',
        description: 'Collects information with the suspending tool',
        instructions: 'SUBAGENT_MARK',
        model: scenarioModel(llm),
        tools: { suspendingTool },
      });
      const network = new Agent({
        id: 'suspend-nested',
        name: 'suspend-nested',
        instructions: 'Delegate to subAgent.',
        model: scenarioModel(llm),
        agents: { subAgent },
        memory: new MockMemory(),
      });
      const agent = new Mastra({
        agents: { network: forEngine(network, engine) },
        storage: new InMemoryStore(),
        logger: false,
      }).getAgent('network');
      const memory = { thread: 'sn-t', resource: 'sn-r' };

      const stream = await forEngine(agent, engine).network('Collect information', { memory });
      const chunks = await drain(stream);
      const suspended = chunks.at(-1);
      expect(suspended?.type).toBe('agent-execution-suspended');
      expect((suspended?.payload as { suspendPayload: unknown }).suspendPayload).toEqual({
        message: 'Please provide additional information',
      });

      const resumed = await drain(
        await forEngine(agent, engine).resumeNetwork(
          { userResponse: 'nested resume data' },
          { runId: stream.runId, memory },
        ),
      );

      expect(resumed[0]?.type).toBe('agent-execution-start');
      expect(resumed.at(-1)?.type).toBe('network-execution-event-finish');
      expect(resumed.map(c => c.type)).toContain('agent-execution-end');
      const subAgentFollowUp = llm
        .getRequests()
        .find(r => isAgentRequest('SUBAGENT_MARK')(r.body) && lastIsToolResult(r.body));
      expect(JSON.stringify(subAgentFollowUp?.body?.messages.at(-1))).toContain(
        'Received: nested and nested resume data',
      );
    });

    it('suspends a routed workflow and resumes it with the resume data', async () => {
      const llm = getMock();
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
      const network = new Agent({
        id: 'suspend-workflow',
        name: 'suspend-workflow',
        instructions: 'Run the workflow.',
        model: scenarioModel(llm),
        workflows: { suspendingWorkflow },
        memory: new MockMemory(),
      });
      const agent = new Mastra({
        agents: { network: forEngine(network, engine) },
        storage: new InMemoryStore(),
        logger: false,
      }).getAgent('network');
      const memory = { thread: 'sw-t', resource: 'sw-r' };

      const stream = await forEngine(agent, engine).network('Run the workflow', { memory });
      const chunks = await drain(stream);
      const suspended = chunks.at(-1);
      expect(suspended?.type).toBe('workflow-execution-suspended');
      expect((suspended?.payload as { suspendPayload: unknown }).suspendPayload).toEqual({
        message: 'Please provide user input for workflow',
      });

      const resumed = await drain(
        await forEngine(agent, engine).resumeNetwork(
          { userInput: 'workflow resume input' },
          { runId: stream.runId, memory },
        ),
      );

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
