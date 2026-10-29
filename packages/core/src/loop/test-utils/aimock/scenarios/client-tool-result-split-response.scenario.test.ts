import { describe, expect, it } from 'vitest';
import { z } from 'zod/v4';
import { MockMemory } from '../../../../memory/mock';
import type { InputProcessor } from '../../../../processors';
import { createTool } from '../../../../tools';
import { createSharedAgent, runLoopScenario, useLoopScenarioAimock } from '../aimock-scenario';

/**
 * A state signal sent between steps stores the rest of the response as a new assistant row, so a
 * client tool called after the signal is stored in that later row. The client still holds the
 * whole response as one message under the first row's id and sends the tool result back on it,
 * either together with the next user message or on its own. The result must reach the row that
 * holds the call, or the call stays pending and is dropped from every later prompt.
 * https://github.com/mastra-ai/mastra/issues/28258
 */
describe('AIMock scenario: client tool result when a state signal split the response', () => {
  const getMock = useLoopScenarioAimock();

  const lookup = createTool({
    id: 'lookup',
    description: 'Looks up the palette',
    inputSchema: z.object({}),
    execute: async () => ({ palette: 'warm' }),
  });
  const pickColor = createTool({
    id: 'pickColor',
    description: 'Asks the user to pick a color in the UI',
    inputSchema: z.object({ hint: z.string() }),
  });

  const splitAfterFirstStep: InputProcessor = {
    id: 'state-split',
    processInputStep: async ({ stepNumber, sendSignal }) => {
      if (stepNumber === 1) await sendSignal?.({ type: 'state', contents: 'STATE_BETWEEN_STEPS' });
    },
  };

  const lookupDone = (req: any) =>
    req.messages.some((message: any) => message.tool_call_id === 'call_lookup') &&
    !JSON.stringify(req).includes('call_pick');
  const hasHistory = (req: any) => req.messages.some((message: any) => message.role === 'assistant');

  function fixtures(llm: ReturnType<typeof getMock>) {
    llm.on(
      { endpoint: 'chat', predicate: lookupDone },
      { toolCalls: [{ id: 'call_pick', name: 'pickColor', arguments: { hint: 'warm' } }] },
    );
    llm.on(
      { endpoint: 'chat', predicate: req => !hasHistory(req) },
      { toolCalls: [{ id: 'call_lookup', name: 'lookup', arguments: {} }] },
    );
    llm.on({ endpoint: 'chat' }, { content: 'REPLY' });
  }

  async function setup() {
    const llm = getMock();
    const memory = new MockMemory();
    const threadId = `split-${Math.random().toString(36).slice(2)}`;
    const resourceId = 'split-resource';
    await memory.createThread({ threadId, resourceId });
    const shared = await createSharedAgent(llm, {
      memory,
      tools: { lookup, pickColor },
      inputProcessors: [splitAfterFirstStep],
    });
    fixtures(llm);

    const run = async (prompt: any) => {
      const { output } = await runLoopScenario({
        llm,
        sharedAgent: shared,
        fixtures: () => {},
        prompt,
        memory,
        threadId,
        resourceId,
        memoryOptions: { lastMessages: 20 },
        maxSteps: 5,
      });
      await output.consumeStream();
      return llm.getRequests().at(-1)!.body as any;
    };
    const stored = async () => (await memory.recall({ threadId, resourceId, perPage: 100 })).messages;

    await run([{ id: 'u1', role: 'user', parts: [{ type: 'text', text: 'pick one' }] }]);
    const assistants = (await stored()).filter(message => message.role === 'assistant');
    return { run, stored, assistants };
  }

  const pickColorCall = (messages: any[]) =>
    messages
      .flatMap(message => message.content.parts)
      .filter((part: any) => part.type === 'tool-invocation' && part.toolInvocation.toolCallId === 'call_pick')
      .map((part: any) => part.toolInvocation);

  const pickColorResults = (body: any) =>
    body.messages
      .filter((message: any) => message.role === 'tool' && message.tool_call_id === 'call_pick')
      .map((message: any) => message.content);

  // What the client sends back: the whole response as one message under the first row's id.
  const echoedResponse = (id: string) => ({
    id,
    role: 'assistant' as const,
    parts: [
      {
        type: 'tool-invocation' as const,
        toolInvocation: {
          toolCallId: 'call_lookup',
          toolName: 'lookup',
          args: {},
          state: 'result' as const,
          result: { palette: 'warm' },
        },
      },
      {
        type: 'tool-invocation' as const,
        toolInvocation: {
          toolCallId: 'call_pick',
          toolName: 'pickColor',
          args: { hint: 'warm' },
          state: 'result' as const,
          result: { color: 'red' },
        },
      },
    ],
  });

  it('stores the client call in a later row than the first one', async () => {
    const { assistants } = await setup();
    expect(assistants).toHaveLength(2);
    expect(pickColorCall([assistants[0]])).toEqual([]);
    expect(pickColorCall([assistants[1]])).toMatchObject([{ state: 'call' }]);
  });

  it('keeps the result sent together with the next user message', async () => {
    const { run, stored, assistants } = await setup();

    const turn2 = await run([
      echoedResponse(assistants[0]!.id),
      { id: 'u2', role: 'user', parts: [{ type: 'text', text: 'thanks' }] },
    ]);
    expect(pickColorResults(turn2)).toHaveLength(1);
    expect(pickColorResults(turn2)[0]).toContain('red');
    expect(pickColorCall(await stored())).toMatchObject([{ state: 'result', result: { color: 'red' } }]);

    const turn3 = await run([{ id: 'u3', role: 'user', parts: [{ type: 'text', text: 'again' }] }]);
    expect(pickColorResults(turn3)).toHaveLength(1);
  });

  it('keeps the result sent on its own', async () => {
    const { run, stored, assistants } = await setup();

    const turn2 = await run([echoedResponse(assistants[0]!.id)]);
    expect(pickColorResults(turn2)).toHaveLength(1);
    expect(pickColorResults(turn2)[0]).toContain('red');
    expect(pickColorCall(await stored())).toMatchObject([{ state: 'result', result: { color: 'red' } }]);

    const turn3 = await run([{ id: 'u3', role: 'user', parts: [{ type: 'text', text: 'again' }] }]);
    expect(pickColorResults(turn3)).toHaveLength(1);
  });
});
