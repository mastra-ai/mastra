import { expect, it } from 'vitest';
import { z } from 'zod/v4';
import { Agent } from '../../../../agent';
import { MockMemory } from '../../../../memory/mock';
import { createTool } from '../../../../tools';
import { describeForAllEngines, useLoopScenarioAimock } from '../aimock-scenario';
import {
  complete,
  drain,
  isCompletionRequest,
  isRoutingRequest,
  requestText,
  routeTo,
  scenarioModel,
  forEngine,
  NETWORK_ENGINE_SKIP,
} from '../network-fixtures';

/**
 * How agent.network() turns the router's tool prompt into tool input: an
 * unparseable prompt skips the tool without failing the run (#12477; the router
 * not seeing the error is #27622), and client tools from defaultOptions are routable.
 */
describeForAllEngines(
  'AIMock network scenario: routed tool input',
  engine => {
    const getMock = useLoopScenarioAimock();

    async function runUnparseablePrompt(llm: ReturnType<typeof getMock>) {
      let routingCalls = 0;
      llm.on(
        { endpoint: 'chat', predicate: req => isRoutingRequest(req) && ++routingCalls === 1 },
        routeTo('testTool', 'tool', '{message input}'),
      );
      llm.on({ endpoint: 'chat', predicate: isRoutingRequest }, routeTo('none', 'none', ''));
      let completionCalls = 0;
      llm.on(
        { endpoint: 'chat', predicate: req => isCompletionRequest(req) && ++completionCalls === 1 },
        complete('', false),
      );
      llm.on({ endpoint: 'chat', predicate: isCompletionRequest }, complete('Gave up on the tool'));
      const executed: unknown[] = [];
      const testTool = createTool({
        id: 'testTool',
        description: 'Processes a message',
        inputSchema: z.object({ message: z.string() }),
        execute: async input => {
          executed.push(input);
          return { result: 'processed' };
        },
      });
      const network = new Agent({
        id: 'invalid-input-network',
        name: 'invalid-input-network',
        instructions: 'Execute tools',
        model: scenarioModel(llm),
        tools: { testTool },
        memory: new MockMemory(),
      });

      const stream = await forEngine(network, engine).network('Process a message using the test tool', {
        memory: { thread: 'ii-t', resource: 'ii-r' },
      });
      await drain(stream);
      return { stream, executed };
    }

    it('does not run the tool or fail the run when the router gives an unparseable tool prompt (#12477)', async () => {
      const llm = getMock();
      const { stream, executed } = await runUnparseablePrompt(llm);

      expect(await stream.status).toBe('success');
      expect(executed).toEqual([]);
      const completion = llm.getRequests().filter(r => isCompletionRequest(r.body));
      expect(requestText(completion[0]!.body)).toContain('is not valid JSON');
      expect(llm.getRequests().filter(r => isRoutingRequest(r.body))).toHaveLength(2);
    });

    // Known gap #27622: the parse-error result skips the memory save, so the router's retry never sees it.
    it.fails('shows the parse error to the router on its retry (#27622)', async () => {
      const llm = getMock();
      await runUnparseablePrompt(llm);

      const routing = llm.getRequests().filter(r => isRoutingRequest(r.body));
      expect(requestText(routing[1]!.body)).toContain('is not valid JSON');
    });

    it('routes to a client tool declared in defaultOptions', async () => {
      const llm = getMock();
      llm.on(
        { endpoint: 'chat', predicate: isRoutingRequest },
        routeTo('changeColor', 'tool', JSON.stringify({ color: 'blue' })),
      );
      llm.on({ endpoint: 'chat', predicate: isCompletionRequest }, complete('Color has been changed to blue'));
      const network = new Agent({
        id: 'client-tools-network',
        name: 'client-tools-network',
        instructions: 'Use the available tools to change colors',
        model: scenarioModel(llm),
        memory: new MockMemory(),
        defaultOptions: {
          clientTools: {
            changeColor: {
              id: 'changeColor',
              description: 'Change the color on the client side',
              inputSchema: z.object({ color: z.string() }),
              outputSchema: z.object({ success: z.boolean(), message: z.string() }),
              execute: async ({ color }: { color: string }) => ({
                success: true,
                message: `Color changed to ${color}`,
              }),
            },
          },
        },
      });

      const stream = await forEngine(network, engine).network('Change the color to blue', {
        memory: { thread: 'ct-t', resource: 'ct-r' },
      });
      const chunks = await drain(stream);

      expect(await stream.status).toBe('success');
      expect(chunks.filter(c => c.type === 'tool-execution-end').map(c => (c.payload as any).result)).toEqual([
        { success: true, message: 'Color changed to blue' },
      ]);
    });
  },
  NETWORK_ENGINE_SKIP,
);
