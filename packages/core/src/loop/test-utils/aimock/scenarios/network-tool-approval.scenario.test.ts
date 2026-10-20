import type { ChatCompletionRequest } from '@copilotkit/aimock';
import { expect, it } from 'vitest';
import { z } from 'zod/v4';
import { Agent } from '../../../../agent';
import { Mastra } from '../../../../mastra';
import { MockMemory } from '../../../../memory/mock';
import { RequestContext } from '../../../../request-context';
import { InMemoryStore } from '../../../../storage';
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
 * agent.network() tool approval: approve/decline of a tool the router calls
 * directly and of a tool a sub-agent calls, plus the approval gates that
 * resolve without suspending.
 */
describeForAllEngines(
  'AIMock network scenario: tool approval',
  engine => {
    const getMock = useLoopScenarioAimock();
    const lastIsToolResult = (req: ChatCompletionRequest | null) => req?.messages.at(-1)?.role === 'tool';

    function register(network: Agent) {
      const mastra = new Mastra({
        agents: { network: forEngine(network, engine) },
        storage: new InMemoryStore(),
        logger: false,
      });
      return mastra.getAgent('network');
    }

    function approvalTool(executed: unknown[]) {
      return createTool({
        id: 'approvalTool',
        description: 'Processes queries.',
        inputSchema: z.object({ query: z.string() }),
        requireApproval: true,
        execute: async input => {
          executed.push(input);
          return { result: `Processed: ${input.query}` };
        },
      });
    }

    function directToolNetwork(id: string, tool: ReturnType<typeof createTool>, args: unknown) {
      const llm = getMock();
      llm.on({ endpoint: 'chat', predicate: isRoutingRequest }, routeTo(tool.id, 'tool', JSON.stringify(args)));
      llm.on({ endpoint: 'chat', predicate: isCompletionRequest }, complete('Task completed successfully'));
      const network = new Agent({
        id,
        name: id,
        instructions: 'Use the tool.',
        model: scenarioModel(llm),
        tools: { [tool.id]: tool },
        memory: new MockMemory(),
      });
      return register(network);
    }

    function nestedToolNetwork(id: string, executed: unknown[]) {
      const llm = getMock();
      llm.on({ endpoint: 'chat', predicate: isRoutingRequest }, routeTo('subAgent', 'agent', 'Process "nested test"'));
      llm.on(
        { endpoint: 'chat', predicate: req => isAgentRequest('SUBAGENT_MARK')(req) && !lastIsToolResult(req) },
        { toolCalls: [{ id: 'call-sub-1', name: 'approvalTool', arguments: { query: 'nested test' } }] },
      );
      llm.on(
        { endpoint: 'chat', predicate: req => isAgentRequest('SUBAGENT_MARK')(req) && lastIsToolResult(req) },
        { content: 'Task completed with tool result.' },
      );
      llm.on({ endpoint: 'chat', predicate: isCompletionRequest }, complete('Task completed successfully'));
      const subAgent = new Agent({
        id: 'subAgent',
        name: 'subAgent',
        description: 'Processes queries with the approval tool',
        instructions: 'SUBAGENT_MARK',
        model: scenarioModel(llm),
        tools: { approvalTool: approvalTool(executed) },
      });
      const network = new Agent({
        id,
        name: id,
        instructions: 'Delegate to subAgent.',
        model: scenarioModel(llm),
        agents: { subAgent },
        memory: new MockMemory(),
      });
      return { llm, agent: register(network) };
    }

    it('suspends for approval, then runs a directly routed tool once approved', async () => {
      const executed: unknown[] = [];
      const agent = directToolNetwork('approve-direct', approvalTool(executed), { query: 'hello world' });
      const memory = { thread: 'ad-t', resource: 'ad-r' };

      const stream = await forEngine(agent, engine).network('Process "hello world"', { memory });
      const chunks = await drain(stream);
      expect(chunks.at(-1)?.type).toBe('tool-execution-approval');
      expect(executed).toEqual([]);

      const resumed = await drain(
        await forEngine(agent, engine).approveNetworkToolCall({ runId: stream.runId, memory }),
      );

      expect(resumed[0]?.type).toBe('tool-execution-start');
      expect(resumed.at(-1)?.type).toBe('network-execution-event-finish');
      const end = resumed.find(c => c.type === 'tool-execution-end');
      expect((end?.payload as { result: unknown }).result).toEqual({ result: 'Processed: hello world' });
      expect(executed).toEqual([{ query: 'hello world' }]);
    });

    // #27616: the network tool step only evaluates `needsApprovalFn` (set by CoreToolBuilder/MCP), never a
    // createTool `requireApproval` function, so the function is not called and the run always suspends.
    it.fails('passes requestContext to a requireApproval function and skips approval when it returns false (#27616)', async () => {
      const executed: unknown[] = [];
      const seenContexts: unknown[] = [];
      const tool = createTool({
        id: 'contextTool',
        description: 'Processes queries.',
        inputSchema: z.object({ query: z.string() }),
        requireApproval: (_input: unknown, ctx?: { requestContext?: Record<string, unknown> }) => {
          seenContexts.push(ctx?.requestContext);
          return (ctx?.requestContext as { channel?: { platform?: string } })?.channel?.platform !== 'trusted';
        },
        execute: async input => {
          executed.push(input);
          return { result: `Processed: ${input.query}` };
        },
      });
      const agent = directToolNetwork('ctx-approval', tool, { query: 'ctx' });

      const stream = await forEngine(agent, engine).network('Process "ctx"', {
        memory: { thread: 'ca-t', resource: 'ca-r' },
        requestContext: new RequestContext([['channel', { platform: 'trusted' }]]),
      });
      const chunks = await drain(stream);

      expect(seenContexts).toEqual([expect.objectContaining({ channel: { platform: 'trusted' } })]);
      expect(chunks.map(c => c.type)).not.toContain('tool-execution-approval');
      expect(executed).toEqual([{ query: 'ctx' }]);
    });

    it('evaluates an MCP-style needsApprovalFn with requestContext and skips approval when it returns false', async () => {
      const executed: unknown[] = [];
      const seenContexts: unknown[] = [];
      const tool = createTool({
        id: 'mcpStyleTool',
        description: 'Processes queries.',
        inputSchema: z.object({ query: z.string() }),
        requireApproval: true,
        execute: async input => {
          executed.push(input);
          return { result: `Processed: ${input.query}` };
        },
      });
      // The MCP client attaches a dynamic approval decision this way (mcp/src/client/client.ts).
      tool.needsApprovalFn = (_args, ctx) => {
        seenContexts.push(ctx?.requestContext);
        return (ctx?.requestContext as { channel?: { platform?: string } })?.channel?.platform !== 'trusted';
      };
      const agent = directToolNetwork('mcp-approval', tool, { query: 'mcp' });

      const chunks = await drain(
        await forEngine(agent, engine).network('Process "mcp"', {
          memory: { thread: 'mcp-t', resource: 'mcp-r' },
          requestContext: new RequestContext([['channel', { platform: 'trusted' }]]),
        }),
      );

      expect(seenContexts).toEqual([expect.objectContaining({ channel: { platform: 'trusted' } })]);
      expect(chunks.map(c => c.type)).not.toContain('tool-execution-approval');
      expect(executed).toEqual([{ query: 'mcp' }]);
    });

    it('reports the decline, with the default or a custom reason, and never runs the tool', async () => {
      for (const [index, reason] of [undefined, 'That query touches restricted data'].entries()) {
        const executed: unknown[] = [];
        const agent = directToolNetwork(`decline-${index}`, approvalTool(executed), { query: 'hello world' });
        const memory = { thread: `dd-t-${index}`, resource: 'dd-r' };

        const stream = await forEngine(agent, engine).network('Process "hello world"', { memory });
        await drain(stream);
        const resumed = await drain(
          await forEngine(agent, engine).declineNetworkToolCall({
            runId: stream.runId,
            memory,
            ...(reason ? { reason } : {}),
          }),
        );

        expect(resumed[0]?.type).toBe('tool-execution-start');
        expect(resumed.at(-1)?.type).toBe('network-execution-event-finish');
        const end = resumed.find(c => c.type === 'tool-execution-end');
        expect((end?.payload as { result: unknown }).result).toBe(reason ?? 'Tool call was not approved by the user');
        expect(executed).toEqual([]);
      }
    });

    it('resolves through beforeApproval without suspending when it returns proceed:false (#26772)', async () => {
      const executed: unknown[] = [];
      const hookInputs: unknown[] = [];
      const tool = createTool({
        id: 'guardedTool',
        description: 'A tool that requires approval.',
        inputSchema: z.object({ query: z.string(), limit: z.number().default(10) }),
        requireApproval: true,
        beforeApproval: async input => {
          hookInputs.push(input);
          return { proceed: false as const, output: { error: 'Order not found' } };
        },
        execute: async input => {
          executed.push(input);
          return { result: 'should not run' };
        },
      });
      const agent = directToolNetwork('before-approval', tool, { query: 'guarded' });

      const chunks = await drain(
        await forEngine(agent, engine).network('Process "guarded"', { memory: { thread: 'ba-t', resource: 'ba-r' } }),
      );

      expect(hookInputs).toEqual([{ query: 'guarded', limit: 10 }]);
      expect(chunks.map(c => c.type)).not.toContain('tool-execution-approval');
      const end = chunks.find(c => c.type === 'tool-execution-end');
      expect((end?.payload as { result: unknown }).result).toBe(JSON.stringify({ error: 'Order not found' }));
      expect(executed).toEqual([]);
    });

    it('stringifies circular or undefined beforeApproval output (#26772)', async () => {
      const circular: Record<string, unknown> = { name: 'loop' };
      circular.self = circular;
      for (const [index, output] of [circular, undefined].entries()) {
        const executed: unknown[] = [];
        const tool = createTool({
          id: 'guardedTool',
          description: 'A tool that requires approval.',
          inputSchema: z.object({ query: z.string() }),
          requireApproval: true,
          beforeApproval: async () => ({ proceed: false as const, output }),
          execute: async input => {
            executed.push(input);
            return { result: 'should not run' };
          },
        });
        const agent = directToolNetwork(`edge-${index}`, tool, { query: 'guarded' });

        const chunks = await drain(
          await forEngine(agent, engine).network('Process "guarded"', {
            memory: { thread: `be-t-${index}`, resource: 'be-r' },
          }),
        );

        const end = chunks.find(c => c.type === 'tool-execution-end');
        expect(typeof (end?.payload as { result: unknown }).result).toBe('string');
        expect(chunks.map(c => c.type)).not.toContain('tool-execution-approval');
        expect(executed).toEqual([]);
      }
    });

    it('returns invalid tool input as a validation error instead of requesting approval (#26771)', async () => {
      const executed: unknown[] = [];
      const tool = createTool({
        id: 'guardedTool',
        description: 'A tool that requires approval.',
        inputSchema: z.object({ query: z.string(), limit: z.number() }),
        requireApproval: true,
        execute: async input => {
          executed.push(input);
          return { result: 'should not run' };
        },
      });
      const agent = directToolNetwork('invalid-input', tool, { query: 42 });

      const chunks = await drain(
        await forEngine(agent, engine).network('Process "guarded"', { memory: { thread: 'ii-t', resource: 'ii-r' } }),
      );

      expect(chunks.map(c => c.type)).not.toContain('tool-execution-approval');
      const end = chunks.find(c => c.type === 'tool-execution-end');
      expect(JSON.stringify((end?.payload as { result: unknown }).result)).toMatch(/validation failed/i);
      expect(executed).toEqual([]);
    });

    it('suspends for a sub-agent tool approval, then runs the tool once approved', async () => {
      const executed: unknown[] = [];
      const { llm, agent } = nestedToolNetwork('approve-nested', executed);
      const memory = { thread: 'an-t', resource: 'an-r' };

      const stream = await forEngine(agent, engine).network('Process "nested test"', { memory });
      const chunks = await drain(stream);
      expect(chunks.at(-1)?.type).toBe('agent-execution-approval');
      expect(executed).toEqual([]);

      const resumed = await drain(
        await forEngine(agent, engine).approveNetworkToolCall({ runId: stream.runId, memory }),
      );

      expect(resumed[0]?.type).toBe('agent-execution-start');
      expect(resumed.at(-1)?.type).toBe('network-execution-event-finish');
      const toolResult = resumed.find(
        c => c.type === 'agent-execution-event-tool-result' && (c.payload as { type: string }).type === 'tool-result',
      );
      expect((toolResult?.payload as { payload: { result: unknown } }).payload.result).toEqual({
        result: 'Processed: nested test',
      });
      expect(executed).toEqual([{ query: 'nested test' }]);
      const subAgentFollowUp = llm
        .getRequests()
        .find(r => isAgentRequest('SUBAGENT_MARK')(r.body) && lastIsToolResult(r.body));
      expect(JSON.stringify(subAgentFollowUp?.body?.messages.at(-1))).toContain('Processed: nested test');
    });

    it('reports a declined sub-agent tool call to the sub-agent and never runs the tool', async () => {
      const executed: unknown[] = [];
      const { llm, agent } = nestedToolNetwork('decline-nested', executed);
      const memory = { thread: 'dn-t', resource: 'dn-r' };

      const stream = await forEngine(agent, engine).network('Process "nested test"', { memory });
      expect((await drain(stream)).at(-1)?.type).toBe('agent-execution-approval');

      const resumed = await drain(
        await forEngine(agent, engine).declineNetworkToolCall({ runId: stream.runId, memory }),
      );
      expect(resumed[0]?.type).toBe('agent-execution-start');
      expect(resumed.at(-1)?.type).toBe('network-execution-event-finish');
      const denied = resumed.find(c => c.type === 'agent-execution-event-tool-output-denied');
      expect((denied?.payload as { payload: { toolName: string; approval: unknown } }).payload).toMatchObject({
        toolName: 'approvalTool',
        approval: { approved: false, reason: 'Tool call was not approved by the user' },
      });
      expect(executed).toEqual([]);
      const subAgentFollowUp = llm
        .getRequests()
        .find(r => isAgentRequest('SUBAGENT_MARK')(r.body) && lastIsToolResult(r.body));
      expect(subAgentFollowUp?.body?.messages.at(-1)).toMatchObject({
        role: 'tool',
        content: 'Tool call was not approved by the user',
      });
    });
  },
  NETWORK_ENGINE_SKIP,
);
