import { expect, it } from 'vitest';
import { z } from 'zod/v4';
import { Agent } from '../../../../agent';
import { MockMemory } from '../../../../memory/mock';
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
 * agent.network() abort handling: onAbort fires with the primitive that was
 * running, the matching *-abort chunk is emitted, aborted work is neither
 * executed nor saved. Aborts mid-request are triggered from the fixture
 * predicate, which runs when AIMock receives the request.
 */
describeForAllEngines(
  'AIMock network scenario: abort',
  engine => {
    const getMock = useLoopScenarioAimock();

    const abortChunks = (chunks: { type: string; payload?: any }[]) =>
      chunks.filter(c => c.type.endsWith('-abort')).map(c => ({ type: c.type, payload: c.payload }));

    it('stops before routing when the signal is already aborted', async () => {
      const llm = getMock();
      const controller = new AbortController();
      controller.abort();
      const events: unknown[] = [];
      const network = new Agent({
        id: 'pre-abort-network',
        name: 'pre-abort-network',
        instructions: 'Route.',
        model: scenarioModel(llm),
        memory: new MockMemory(),
      });

      const chunks = await drain(
        await forEngine(network, engine).network('Do something', {
          abortSignal: controller.signal,
          onAbort: event => void events.push(event),
          memory: { thread: 'pa-t', resource: 'pa-r' },
        }),
      );

      // The abort is caught before the first iteration starts.
      expect(events).toEqual([{ primitiveType: 'routing', primitiveId: 'routing-agent', iteration: -1 }]);
      expect(abortChunks(chunks)).toEqual([
        { type: 'routing-agent-abort', payload: { primitiveType: 'routing', primitiveId: 'routing-agent' } },
      ]);
      expect(llm.getRequests()).toHaveLength(0);
    });

    it('does not run the routed tool when the signal aborts during routing (#10874)', async () => {
      const llm = getMock();
      const controller = new AbortController();
      llm.on(
        {
          endpoint: 'chat',
          predicate: req => {
            if (!isRoutingRequest(req)) return false;
            controller.abort();
            return true;
          },
        },
        routeTo('guardedTool', 'tool', JSON.stringify({ q: 'x' })),
      );
      const executed: unknown[] = [];
      const guardedTool = createTool({
        id: 'guardedTool',
        description: 'Must not run after abort',
        inputSchema: z.object({ q: z.string() }),
        execute: async input => {
          executed.push(input);
          return 'ran';
        },
      });
      const events: unknown[] = [];
      const network = new Agent({
        id: 'route-abort-network',
        name: 'route-abort-network',
        instructions: 'Route.',
        model: scenarioModel(llm),
        tools: { guardedTool },
        memory: new MockMemory(),
      });

      const chunks = await drain(
        await forEngine(network, engine).network('Use the tool', {
          abortSignal: controller.signal,
          onAbort: event => void events.push(event),
          memory: { thread: 'ra-t', resource: 'ra-r' },
        }),
      );

      expect(executed).toEqual([]);
      expect(abortChunks(chunks).map(c => c.type)).toEqual(['routing-agent-abort']);
      expect(events).toContainEqual({ primitiveType: 'routing', primitiveId: 'routing-agent', iteration: 0 });
    });

    it('does not run the routed tool when the signal aborts after routing finished', async () => {
      const llm = getMock();
      const controller = new AbortController();
      llm.on(
        { endpoint: 'chat', predicate: isRoutingRequest },
        routeTo('guardedTool', 'tool', JSON.stringify({ q: 'x' })),
      );
      const executed: unknown[] = [];
      const guardedTool = createTool({
        id: 'guardedTool',
        description: 'Must not run after abort',
        inputSchema: z.object({ q: z.string() }),
        execute: async input => {
          executed.push(input);
          return 'ran';
        },
      });
      const events: unknown[] = [];
      const network = new Agent({
        id: 'post-route-abort-network',
        name: 'post-route-abort-network',
        instructions: 'Route.',
        model: scenarioModel(llm),
        tools: { guardedTool },
        memory: new MockMemory(),
      });

      const stream = await forEngine(network, engine).network('Use the tool', {
        abortSignal: controller.signal,
        onAbort: event => void events.push(event),
        memory: { thread: 'pra-t', resource: 'pra-r' },
      });
      const chunks: any[] = [];
      for await (const chunk of stream) {
        chunks.push(chunk);
        // No public hook runs between routing and tool dispatch. There is no I/O between them, so the
        // consumer reads routing-agent-end before the workflow moves to the tool step. That ordering
        // depends on the engine's microtask scheduling and will break if a step transition becomes synchronous.
        if (chunk.type === 'routing-agent-end') controller.abort();
      }

      expect(executed).toEqual([]);
      expect(abortChunks(chunks).map(c => c.type)).toEqual(['tool-execution-abort']);
      expect(events).toContainEqual({ primitiveType: 'tool', primitiveId: 'guardedTool', iteration: 0 });
    });

    it('reports a sub-agent abort and saves none of its partial result', async () => {
      const llm = getMock();
      const controller = new AbortController();
      llm.on({ endpoint: 'chat', predicate: isRoutingRequest }, routeTo('subAgent', 'agent', 'Do it'));
      llm.on(
        {
          endpoint: 'chat',
          predicate: req => {
            if (!isAgentRequest('SUB_MARK')(req)) return false;
            controller.abort();
            return true;
          },
        },
        { content: 'PARTIAL_SUB_RESULT' },
      );
      llm.on({ endpoint: 'chat', predicate: isCompletionRequest }, complete('Done'));
      const memory = new MockMemory();
      const subAgent = new Agent({
        id: 'subAgent',
        name: 'subAgent',
        description: 'Gets aborted',
        instructions: 'SUB_MARK',
        model: scenarioModel(llm),
      });
      const events: unknown[] = [];
      const network = new Agent({
        id: 'agent-abort-network',
        name: 'agent-abort-network',
        instructions: 'Route.',
        model: scenarioModel(llm),
        agents: { subAgent },
        memory,
      });

      const chunks = await drain(
        await forEngine(network, engine).network('Do something', {
          abortSignal: controller.signal,
          onAbort: event => void events.push(event),
          memory: { thread: 'aa-t', resource: 'aa-r' },
        }),
      );

      expect(events).toContainEqual({ primitiveType: 'agent', primitiveId: 'subAgent', iteration: 0 });
      // The sub-agent's own abort chunk is forwarded first, then the network reports the aborted primitive.
      expect(abortChunks(chunks).map(c => c.type)).toEqual(['agent-execution-event-abort', 'agent-execution-abort']);
      expect(abortChunks(chunks)[1]?.payload).toEqual({ primitiveType: 'agent', primitiveId: 'subAgent' });
      const { messages } = await memory.recall({ threadId: 'aa-t', resourceId: 'aa-r' });
      expect(JSON.stringify(messages)).not.toContain('PARTIAL_SUB_RESULT');
      expect(llm.getRequests().filter(r => isCompletionRequest(r.body))).toHaveLength(0);
    });

    it('passes the signal to a routed tool and reports an abort raised inside it', async () => {
      const llm = getMock();
      const controller = new AbortController();
      llm.on(
        { endpoint: 'chat', predicate: isRoutingRequest },
        routeTo('abortingTool', 'tool', JSON.stringify({ q: 'x' })),
      );
      llm.on({ endpoint: 'chat', predicate: isCompletionRequest }, complete('Done'));
      const received: unknown[] = [];
      const abortingTool = createTool({
        id: 'abortingTool',
        description: 'Aborts while running',
        inputSchema: z.object({ q: z.string() }),
        execute: async (_input, options) => {
          received.push(options?.abortSignal);
          controller.abort();
          return 'partial';
        },
      });
      const events: unknown[] = [];
      const network = new Agent({
        id: 'tool-abort-network',
        name: 'tool-abort-network',
        instructions: 'Route.',
        model: scenarioModel(llm),
        tools: { abortingTool },
        memory: new MockMemory(),
      });

      const chunks = await drain(
        await forEngine(network, engine).network('Use the tool', {
          abortSignal: controller.signal,
          onAbort: event => void events.push(event),
          memory: { thread: 'ta-t', resource: 'ta-r' },
        }),
      );

      expect(received).toEqual([controller.signal]);
      expect(events).toEqual([{ primitiveType: 'tool', primitiveId: 'abortingTool', iteration: 0 }]);
      expect(abortChunks(chunks).map(c => c.type)).toEqual(['tool-execution-abort']);
    });

    it('reports a workflow abort raised inside a step', async () => {
      const llm = getMock();
      const controller = new AbortController();
      llm.on(
        { endpoint: 'chat', predicate: isRoutingRequest },
        routeTo('abortWorkflow', 'workflow', JSON.stringify({ city: 'Paris' })),
      );
      llm.on({ endpoint: 'chat', predicate: isCompletionRequest }, complete('Done'));
      const step = createStep({
        id: 'slow-step',
        inputSchema: z.object({ city: z.string() }),
        outputSchema: z.object({ result: z.string() }),
        execute: async ({ inputData }) => {
          controller.abort();
          return { result: `Researched ${inputData.city}` };
        },
      });
      const abortWorkflow = createWorkflow({
        id: 'abortWorkflow',
        description: 'Gets aborted',
        inputSchema: z.object({ city: z.string() }),
        outputSchema: z.object({ result: z.string() }),
      })
        .then(step)
        .commit();
      const events: unknown[] = [];
      const network = new Agent({
        id: 'workflow-abort-network',
        name: 'workflow-abort-network',
        instructions: 'Route.',
        model: scenarioModel(llm),
        workflows: { abortWorkflow },
        memory: new MockMemory(),
      });

      const chunks = await drain(
        await forEngine(network, engine).network('Research Paris', {
          abortSignal: controller.signal,
          onAbort: event => void events.push(event),
          memory: { thread: 'wa-t', resource: 'wa-r' },
        }),
      );

      expect(events).toContainEqual({ primitiveType: 'workflow', primitiveId: 'abortWorkflow', iteration: 0 });
      expect(abortChunks(chunks)).toEqual([
        { type: 'workflow-execution-abort', payload: { primitiveType: 'workflow', primitiveId: 'abortWorkflow' } },
      ]);
    });

    // Known gap #27618: network() forwards onAbort into the inner agent runs (which
    // call it with { steps, text }) and fires it twice for workflows.
    it.fails('calls onAbort once per abort with the network payload (#27618)', async () => {
      const llm = getMock();
      const controller = new AbortController();
      llm.on({ endpoint: 'chat', predicate: isRoutingRequest }, routeTo('subAgent', 'agent', 'Do it'));
      llm.on(
        {
          endpoint: 'chat',
          predicate: req => {
            if (!isAgentRequest('SUB_MARK')(req)) return false;
            controller.abort();
            return true;
          },
        },
        { content: 'partial' },
      );
      const subAgent = new Agent({
        id: 'subAgent',
        name: 'subAgent',
        description: 'Gets aborted',
        instructions: 'SUB_MARK',
        model: scenarioModel(llm),
      });
      const events: unknown[] = [];
      const network = new Agent({
        id: 'once-abort-network',
        name: 'once-abort-network',
        instructions: 'Route.',
        model: scenarioModel(llm),
        agents: { subAgent },
        memory: new MockMemory(),
      });

      await drain(
        await forEngine(network, engine).network('Do something', {
          abortSignal: controller.signal,
          onAbort: event => void events.push(event),
          memory: { thread: 'oa-t', resource: 'oa-r' },
        }),
      );

      expect(events).toEqual([{ primitiveType: 'agent', primitiveId: 'subAgent', iteration: 0 }]);
    });
  },
  NETWORK_ENGINE_SKIP,
);
