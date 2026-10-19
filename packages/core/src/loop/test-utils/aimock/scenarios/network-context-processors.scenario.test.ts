import { expect, it } from 'vitest';
import { z } from 'zod/v4';
import { Agent } from '../../../../agent';
import type { MastraDBMessage } from '../../../../memory';
import { MockMemory } from '../../../../memory/mock';
import { RequestContext } from '../../../../request-context';
import { createTool } from '../../../../tools';
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
 * agent.network() run-level options that must reach every part of the run:
 * the network agent's output processors run on messages the network saves
 * (#12300), and the caller's requestContext reaches tools the router calls
 * (#12330).
 */
describeForAllEngines(
  'AIMock network scenario: output processors and requestContext',
  engine => {
    const getMock = useLoopScenarioAimock();

    it('runs the network output processors on the assistant messages it saves (#12300)', async () => {
      const llm = getMock();
      llm.on({ endpoint: 'chat', predicate: isRoutingRequest }, routeTo('subAgent', 'agent', 'Do the task'));
      llm.on({ endpoint: 'chat', predicate: isAgentRequest('SUB_MARK') }, { content: 'Sub-agent response' });
      llm.on({ endpoint: 'chat', predicate: isCompletionRequest }, complete('Task completed'));
      const memory = new MockMemory();
      const subAgent = new Agent({
        id: 'subAgent',
        name: 'subAgent',
        description: 'Does the task',
        instructions: 'SUB_MARK',
        model: scenarioModel(llm),
      });
      const network = new Agent({
        id: 'processor-network',
        name: 'processor-network',
        instructions: 'Delegate tasks.',
        model: scenarioModel(llm),
        agents: { subAgent },
        memory,
        outputProcessors: [
          {
            id: 'trace-id-injector',
            processOutputResult: ({ messages }: { messages: MastraDBMessage[] }) =>
              messages.map(msg =>
                msg.role === 'assistant'
                  ? {
                      ...msg,
                      content: { ...msg.content, metadata: { ...msg.content.metadata, traceId: 'trace-12300' } },
                    }
                  : msg,
              ),
          },
        ],
      });

      const chunks = await drain(
        await forEngine(network, engine).network('Do the task', { memory: { thread: 'op-t', resource: 'op-r' } }),
      );

      expect(chunks.at(-1)?.type).toBe('network-execution-event-finish');
      const { messages } = await memory.recall({ threadId: 'op-t', resourceId: 'op-r' });
      const assistant = messages.filter(m => m.role === 'assistant');
      expect(assistant.length).toBeGreaterThan(0);
      expect(assistant.map(m => m.content.metadata?.traceId)).toEqual(assistant.map(() => 'trace-12300'));
    });

    it('passes the caller requestContext to a tool the router calls (#12330)', async () => {
      const llm = getMock();
      llm.on(
        { endpoint: 'chat', predicate: isRoutingRequest },
        routeTo('contextCaptureTool', 'tool', JSON.stringify({ message: 'test' })),
      );
      llm.on({ endpoint: 'chat', predicate: isCompletionRequest }, complete('Done'));
      const seen: unknown[] = [];
      const contextCaptureTool = createTool({
        id: 'contextCaptureTool',
        description: 'Captures requestContext values',
        inputSchema: z.object({ message: z.string() }),
        execute: async ({ message }, context) => {
          seen.push({ userId: context?.requestContext?.get('userId'), tenant: context?.requestContext?.get('tenant') });
          return { result: `Captured for: ${message}` };
        },
      });
      const network = new Agent({
        id: 'context-network',
        name: 'context-network',
        instructions: 'Use the tool.',
        model: scenarioModel(llm),
        tools: { contextCaptureTool },
        memory: new MockMemory(),
      });
      const requestContext = new RequestContext<{ userId: string; tenant: string }>();
      requestContext.set('userId', 'network-user-12330');
      requestContext.set('tenant', 'tenant-12330');

      await drain(
        await forEngine(network, engine).network('Test requestContext propagation', {
          requestContext,
          memory: { thread: 'rc-t', resource: 'rc-r' },
        }),
      );

      expect(seen).toEqual([{ userId: 'network-user-12330', tenant: 'tenant-12330' }]);
    });
  },
  NETWORK_ENGINE_SKIP,
);
