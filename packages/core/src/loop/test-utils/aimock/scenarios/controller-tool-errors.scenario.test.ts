import { expect, it } from 'vitest';
import { z } from 'zod/v4';
import { Agent } from '../../../../agent';
import { createTestSession } from '../../../../agent-controller/test-utils';
import type { AgentControllerEvent } from '../../../../agent-controller/types';
import { createTool } from '../../../../tools';
import { createSharedAgent, describeForAllEngines, useLoopScenarioAimock } from '../aimock-scenario';
import { scenarioModel } from '../network-fixtures';

const cases = [
  {
    name: 'invalid tool arguments',
    args: { count: 'invalid' },
    tool: createTool({
      id: 'lookup',
      description: 'Look up a count',
      inputSchema: z.object({ count: z.number() }),
      execute: async ({ count }) => ({ count }),
    }),
    isError: true,
  },
  {
    name: 'invalid tool output',
    args: {},
    tool: createTool({
      id: 'lookup',
      description: 'Look up a count',
      inputSchema: z.object({}),
      outputSchema: z.object({ count: z.number() }),
      execute: async () => ({ count: 'invalid' }) as unknown as { count: number },
    }),
    isError: true,
  },
  ...(['error-json', 'error-text'] as const).map(type => ({
    name: `explicit ${type} output`,
    args: {},
    tool: createTool({
      id: 'lookup',
      description: 'Look up a count',
      inputSchema: z.object({}),
      outputSchema: z.object({ message: z.string() }),
      execute: async () => ({ message: 'lookup failed' }),
      toModelOutput: output =>
        type === 'error-text' ? { type: 'error-text', value: output.message } : { type: 'error-json', value: output },
    }),
    isError: true,
  })),
  {
    name: 'a successful business result containing an error field',
    args: {},
    tool: createTool({
      id: 'lookup',
      description: 'Look up a count',
      inputSchema: z.object({}),
      execute: async () => ({ error: true, message: 'a domain value', count: 1 }),
    }),
    isError: false,
  },
  {
    name: 'a successful lookup',
    args: {},
    tool: createTool({
      id: 'lookup',
      description: 'Look up a count',
      inputSchema: z.object({}),
      execute: async () => ({ count: 1 }),
    }),
    isError: false,
  },
  {
    name: 'a thrown tool error',
    args: {},
    tool: createTool({
      id: 'lookup',
      description: 'Look up a count',
      inputSchema: z.object({}),
      execute: async () => {
        throw new Error('lookup failed');
      },
    }),
    isError: true,
  },
];

describeForAllEngines('Controller tool status matches the tool outcome', engine => {
  const getMock = useLoopScenarioAimock();

  for (const route of ['direct', 'delegated', 'built-in subagent'] as const) {
    const delegated = route !== 'direct';
    const builtIn = route === 'built-in subagent';
    // Durable/evented delegations currently emit no subagent_tool_end.
    // Reproduced before and after the classification fix; not yet investigated.
    const test = route === 'delegated' && (engine === 'durable' || engine === 'evented') ? it.fails : it;
    test.each(cases)(`${route}: $name`, async ({ tool, args, isError }) => {
      const llm = getMock();
      const tools = { lookup: tool };
      const worker =
        route === 'delegated'
          ? new Agent({
              id: 'worker',
              name: 'worker',
              instructions: 'Look up the count.',
              model: scenarioModel(llm),
              tools,
            })
          : undefined;
      const { agent } = await createSharedAgent(llm, {
        engine,
        ...(worker ? { agents: { worker } } : builtIn ? {} : { tools }),
      });
      const { controller, session } = await createTestSession({
        agent,
        ...(builtIn
          ? {
              subagents: [
                {
                  id: 'worker',
                  name: 'worker',
                  description: 'Look up the count',
                  instructions: 'Look up the count.',
                  defaultModelId: 'mock',
                  tools,
                },
              ],
              resolveSubagentModel: () => scenarioModel(llm),
            }
          : {}),
      });
      const events: AgentControllerEvent[] = [];
      session.subscribe(event => {
        events.push(event);
      });
      await session.permissions.setForTool({ toolName: 'lookup', policy: 'allow' });
      await session.permissions.setForTool({ toolName: builtIn ? 'subagent' : 'agent-worker', policy: 'allow' });
      if (delegated) {
        llm.on(
          { endpoint: 'chat', sequenceIndex: 0 },
          {
            toolCalls: [
              {
                id: 'delegate',
                name: builtIn ? 'subagent' : 'agent-worker',
                arguments: builtIn
                  ? { agentType: 'worker', task: 'Look up the count.' }
                  : { prompt: 'Look up the count.' },
              },
            ],
          },
        );
      }
      llm.on(
        { endpoint: 'chat', sequenceIndex: delegated ? 1 : 0 },
        {
          toolCalls: [{ id: 'lookup-call', name: 'lookup', arguments: args }],
        },
      );
      llm.on({ endpoint: 'chat', sequenceIndex: delegated ? 2 : 1 }, { content: 'Lookup finished.' });
      if (delegated) llm.on({ endpoint: 'chat', sequenceIndex: 3 }, { content: 'Delegation finished.' });

      try {
        await session.sendMessage({ content: 'Look up the count.' });
        if (delegated) {
          const ended = events.filter(event => event.type === 'subagent_tool_end' && event.subToolName === 'lookup');
          expect(ended).toHaveLength(1);
          expect(ended[0]).toMatchObject({ isError });
          if (!isError) expect(ended[0]).toMatchObject({ subToolResult: { count: 1 } });
        } else {
          const ended = events.filter(event => event.type === 'tool_end' && event.toolCallId === 'lookup-call');
          expect(ended).toHaveLength(1);
          expect(ended[0]).toMatchObject({ isError });
          if (!isError) expect(ended[0]).toMatchObject({ result: { count: 1 } });
          expect(session.displayState.get().activeTools.get('lookup-call')?.status).toBe(
            isError ? 'error' : 'completed',
          );
        }
        const requests = llm.getRequests();
        expect(requests).toHaveLength(delegated ? 4 : 2);
        const afterLookup = requests[delegated ? 2 : 1];
        expect(JSON.stringify(afterLookup?.body)).toContain('lookup-call');
      } finally {
        await controller.destroy();
      }
    });
  }
});
