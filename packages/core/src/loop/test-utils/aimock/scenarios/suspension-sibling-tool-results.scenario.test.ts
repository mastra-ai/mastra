/**
 * AIMock Scenario: a suspending tool call keeps its sibling results (#26846)
 *
 * The model asks for the weather and to book a table in one step. Booking
 * suspends to ask for confirmation. The weather lookup — whether it was
 * called before or after the booking — must still run exactly once, be saved
 * as a finished result (or error), and be shown to the model when the user's
 * next message auto-resumes the booking. Before the fix the sibling was saved
 * as a bare call (or never ran), so the agent forgot the weather it fetched.
 */

import { stepCountIs } from '@internal/ai-sdk-v5';
import { expect, it } from 'vitest';
import { z } from 'zod/v4';
import { MockMemory } from '../../../../memory/mock';
import { createTool } from '../../../../tools';
import { createSharedAgent, runLoopScenario, useLoopScenarioAimock, describeForAllEngines } from '../aimock-scenario';

type Order = 'weather-first' | 'booking-first';

const WEATHER_CALL = { id: 'call_weather', name: 'getWeather', arguments: { city: 'Lisbon' } };
const BOOK_CALL = { id: 'call_book', name: 'bookTable', arguments: { guests: 2 } };

function requestMessages(request: any): any[] {
  return request?.body?.messages ?? [];
}

function weatherInvocations(messages: any[]) {
  return messages
    .flatMap(message => message.content?.parts ?? [])
    .filter((part: any) => part.type === 'tool-invocation' && part.toolInvocation.toolCallId === 'call_weather')
    .map((part: any) => part.toolInvocation);
}

describeForAllEngines('AIMock scenario: suspending tool call keeps sibling tool results', engine => {
  const getMock = useLoopScenarioAimock();
  // Known gap: the evented engine returns before the workflow settles, so the
  // suspended-sibling commit in DurableAgent never runs and the finished
  // sibling stays a bare call that the model never sees on resume.
  const itSiblings = engine === 'evented' ? it.fails : it;

  async function run(order: Order, weatherFails: boolean) {
    const runs: string[] = [];
    const getWeather = createTool({
      id: 'getWeather',
      description: 'Looks up the weather',
      inputSchema: z.object({ city: z.string() }),
      execute: async () => {
        runs.push('getWeather');
        if (weatherFails) throw new Error('weather service down');
        return { tempF: 72 };
      },
    });
    const bookTable = createTool({
      id: 'bookTable',
      description: 'Books a table; asks the user to confirm first',
      inputSchema: z.object({ guests: z.number() }),
      suspendSchema: z.object({ question: z.string() }),
      resumeSchema: z.object({ confirmed: z.boolean() }),
      execute: async (_input, context) => {
        runs.push('bookTable');
        if (!context?.agent?.resumeData) {
          return await context?.agent?.suspend({ question: 'Confirm the 7pm booking?' });
        }
        return { booked: true };
      },
    });

    const memory = new MockMemory();
    const shared = await createSharedAgent(getMock(), {
      tools: { getWeather, bookTable },
      memory,
      defaultOptions: { autoResumeSuspendedTools: true },
      engine,
    });
    const threadId = globalThis.crypto.randomUUID();
    const resourceId = globalThis.crypto.randomUUID();

    const first = await runLoopScenario({
      engine,
      llm: getMock(),
      sharedAgent: shared,
      prompt: 'Check the weather in Lisbon and book a table for two.',
      memory,
      threadId,
      resourceId,
      stopWhen: stepCountIs(5),
      collectChunks: true,
      fixtures: llm => {
        llm.on(
          { endpoint: 'chat', predicate: req => !JSON.stringify(req).includes('confirm it') },
          { toolCalls: order === 'weather-first' ? [WEATHER_CALL, BOOK_CALL] : [BOOK_CALL, WEATHER_CALL] },
        );
      },
    });
    const firstRequestCount = first.requests.length;

    const second = await runLoopScenario({
      engine,
      llm: getMock(),
      sharedAgent: shared,
      prompt: 'Yes, confirm it.',
      memory,
      threadId,
      resourceId,
      stopWhen: stepCountIs(5),
      fixtures: llm => {
        llm.on(
          { endpoint: 'chat', predicate: req => !JSON.stringify(req).includes('call_book_resume') },
          {
            toolCalls: [
              {
                id: 'call_book_resume',
                name: 'bookTable',
                arguments: { guests: 2, suspendedToolCallId: 'call_book', resumeData: { confirmed: true } },
              },
            ],
          },
        );
        llm.on(
          { endpoint: 'chat', predicate: req => JSON.stringify(req).includes('call_book_resume') },
          { content: 'Booked for two; it will be 72°F in Lisbon.' },
        );
      },
    });

    const text = await second.output.text;
    const secondCallRequests = second.requests.slice(firstRequestCount);
    const { messages } = await memory.recall({ threadId, resourceId });
    return { runs, firstChunks: first.chunks ?? [], text, secondCallRequests, messages };
  }

  itSiblings.each(['weather-first', 'booking-first'] as const)(
    '%s: the weather lookup runs once, is saved, and the model sees it on auto-resume',
    async order => {
      const { runs, firstChunks, text, secondCallRequests, messages } = await run(order, false);

      // Booking suspended in the first call, and the sibling still ran exactly once.
      expect(firstChunks.some((c: any) => c.type === 'tool-call-suspended')).toBe(true);
      expect(runs.filter(name => name === 'getWeather')).toHaveLength(1);
      expect(runs.filter(name => name === 'bookTable')).toHaveLength(2);

      // The resumed call's first model request carries the weather result.
      expect(secondCallRequests.length).toBeGreaterThanOrEqual(2);
      const resumeRequest = requestMessages(secondCallRequests[0]);
      const weatherResult = resumeRequest.find((m: any) => m.role === 'tool' && m.tool_call_id === 'call_weather');
      expect(weatherResult).toBeDefined();
      expect(JSON.parse(weatherResult.content)).toEqual({ tempF: 72 });

      // Memory keeps exactly one finished weather invocation.
      const invocations = weatherInvocations(messages);
      expect(invocations).toHaveLength(1);
      expect(invocations[0]).toMatchObject({ toolName: 'getWeather', state: 'result', result: { tempF: 72 } });

      expect(text).toContain('Booked for two');
    },
  );

  itSiblings('a sibling that throws is saved as an error and the model sees the error on auto-resume', async () => {
    const { runs, secondCallRequests, messages } = await run('weather-first', true);

    expect(runs.filter(name => name === 'getWeather')).toHaveLength(1);

    const resumeRequest = requestMessages(secondCallRequests[0]);
    const weatherResult = resumeRequest.find((m: any) => m.role === 'tool' && m.tool_call_id === 'call_weather');
    expect(weatherResult).toBeDefined();
    expect(String(weatherResult.content)).toContain('weather service down');

    const invocations = weatherInvocations(messages);
    expect(invocations).toHaveLength(1);
    expect(invocations[0]).toMatchObject({ toolName: 'getWeather', state: 'output-error' });
  });
});
