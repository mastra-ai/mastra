import { stepCountIs } from '@internal/ai-sdk-v5';
import { it, expect } from 'vitest';
import { z } from 'zod/v4';
import { MockMemory } from '../../../../memory/mock';
import type { Processor } from '../../../../processors';
import type { ChunkType } from '../../../../stream/types';
import { createTool } from '../../../../tools';
import { describeForAllEngines, runLoopScenario, useLoopScenarioAimock } from '../aimock-scenario';

/**
 * Story: a travel agent checks a slow airline API and a fast weather API in the same step.
 * The weather answer is ready almost immediately, so the UI should show it right away instead
 * of waiting for the airline call (#21902). The step result, the history sent back to the
 * model and the saved thread must still list both results in the order the model called them.
 */
describeForAllEngines('Tool results stream as each parallel call finishes', engine => {
  const getMock = useLoopScenarioAimock();
  const THREAD = { threadId: 'trip-thread', resourceId: 'traveller' };

  const fixtures = (llm: ReturnType<typeof getMock>) => {
    llm.on(
      { endpoint: 'chat', hasToolResult: false },
      {
        toolCalls: [
          { id: 'call_flights', name: 'searchFlights', arguments: { to: 'Lisbon' } },
          { id: 'call_weather', name: 'getWeather', arguments: { city: 'Lisbon' } },
        ],
      },
    );
    llm.on({ endpoint: 'chat', hasToolResult: true }, { content: 'Flights from $420, and it is sunny.' });
  };

  /**
   * The slow tool finishes when the fast tool's result reaches the stream consumer, or after
   * a timeout. Without early streaming the fast result is held until the slow tool finishes,
   * so the slow tool always hits the timeout.
   */
  function createTools() {
    let markWeatherStreamed!: () => void;
    const weatherStreamed = new Promise<void>(resolve => {
      markWeatherStreamed = resolve;
    });
    const state = { weatherStreamedBeforeFlightsFinished: false };

    const searchFlights = createTool({
      id: 'searchFlights',
      description: 'Search flights (slow).',
      inputSchema: z.object({ to: z.string() }),
      execute: async () => {
        state.weatherStreamedBeforeFlightsFinished = await Promise.race([
          weatherStreamed.then(() => true),
          new Promise<boolean>(resolve => setTimeout(() => resolve(false), 3000)),
        ]);
        return { cheapest: 420 };
      },
    });
    const getWeather = createTool({
      id: 'getWeather',
      description: 'Get the weather (fast).',
      inputSchema: z.object({ city: z.string() }),
      execute: async () => ({ forecast: 'sunny' }),
    });

    return { tools: { searchFlights, getWeather }, state, markWeatherStreamed };
  }

  async function drain(fullStream: AsyncIterable<ChunkType>, onChunk: (chunk: ChunkType) => void) {
    const chunks: ChunkType[] = [];
    for await (const chunk of fullStream) {
      chunks.push(chunk);
      onChunk(chunk);
    }
    return chunks;
  }

  const resultIds = (chunks: ChunkType[]) =>
    chunks.filter(c => c.type === 'tool-result').map(c => (c.payload as { toolCallId: string }).toolCallId);

  it('streams the fast tool result before the slow call in the same step finishes', async () => {
    const memory = new MockMemory();
    const { tools, state, markWeatherStreamed } = createTools();

    const { output, llm } = await runLoopScenario({
      engine,
      llm: getMock(),
      prompt: 'Find me flights to Lisbon and check the weather there.',
      tools,
      stopWhen: stepCountIs(5),
      memory,
      ...THREAD,
      manualStreamConsumption: true,
      fixtures,
    });

    const chunks = await drain(output.fullStream as AsyncIterable<ChunkType>, chunk => {
      if (chunk.type === 'tool-result' && (chunk.payload as { toolCallId: string }).toolCallId === 'call_weather') {
        markWeatherStreamed();
      }
    });

    expect(state.weatherStreamedBeforeFlightsFinished).toBe(true);
    expect(resultIds(chunks)).toEqual(['call_weather', 'call_flights']);

    // Everything derived from the step keeps the model's call order.
    const callOrder = ['call_flights', 'call_weather'];
    expect((await output.toolResults).map(r => r.payload.toolCallId)).toEqual(callOrder);
    const steps = await output.steps;
    expect(steps[0]!.toolResults.map(r => r.payload.toolCallId)).toEqual(callOrder);
    expect(await output.text).toBe('Flights from $420, and it is sunny.');

    const requests = llm.getRequests();
    expect(requests).toHaveLength(2);
    const sentBack = (requests[1]!.body.messages as Array<{ role: string; tool_call_id?: string }>)
      .filter(m => m.role === 'tool')
      .map(m => m.tool_call_id);
    expect(sentBack).toEqual(callOrder);

    const saved = JSON.stringify((await memory.recall(THREAD)).messages);
    expect(saved.indexOf('call_flights')).toBeGreaterThan(-1);
    expect(saved.indexOf('call_flights')).toBeLessThan(saved.indexOf('call_weather'));
    expect(saved).toContain('sunny');
    expect(saved).toContain('420');
  });

  it('keeps step results, model history and the saved thread in call order when calls finish in reverse', async () => {
    const memory = new MockMemory();
    // Each call waits for the one after it, so they finish hotels, cars, flights: the reverse of
    // the order the model called them.
    let hotelDone!: () => void;
    let carDone!: () => void;
    const hotelFinished = new Promise<void>(resolve => (hotelDone = resolve));
    const carFinished = new Promise<void>(resolve => (carDone = resolve));
    const searchFlights = createTool({
      id: 'searchFlights',
      description: 'Search flights.',
      inputSchema: z.object({ to: z.string() }),
      execute: async () => {
        await carFinished;
        return { cheapest: 420 };
      },
    });
    const rentCar = createTool({
      id: 'rentCar',
      description: 'Find a rental car.',
      inputSchema: z.object({ city: z.string() }),
      execute: async () => {
        await hotelFinished;
        setTimeout(carDone, 0);
        return { daily: 35 };
      },
    });
    const findHotel = createTool({
      id: 'findHotel',
      description: 'Find a hotel.',
      inputSchema: z.object({ city: z.string() }),
      execute: async () => {
        setTimeout(hotelDone, 0);
        return { nightly: 110 };
      },
    });

    const { output, llm, chunks } = await runLoopScenario({
      engine,
      llm: getMock(),
      prompt: 'Plan my Lisbon trip: flights, a car and a hotel.',
      tools: { searchFlights, rentCar, findHotel },
      stopWhen: stepCountIs(5),
      memory,
      ...THREAD,
      collectChunks: true,
      fixtures: llm => {
        llm.on(
          { endpoint: 'chat', hasToolResult: false },
          {
            toolCalls: [
              { id: 'call_flights', name: 'searchFlights', arguments: { to: 'Lisbon' } },
              { id: 'call_car', name: 'rentCar', arguments: { city: 'Lisbon' } },
              { id: 'call_hotel', name: 'findHotel', arguments: { city: 'Lisbon' } },
            ],
          },
        );
        llm.on({ endpoint: 'chat', hasToolResult: true }, { content: 'Flights $420, car $35/day, hotel $110/night.' });
      },
    });

    const callOrder = ['call_flights', 'call_car', 'call_hotel'];
    expect([...resultIds(chunks!)].sort()).toEqual([...callOrder].sort());
    expect((await output.toolResults).map(r => r.payload.toolCallId)).toEqual(callOrder);
    expect((await output.steps)[0]!.toolResults.map(r => r.payload.toolCallId)).toEqual(callOrder);

    const sentBack = (llm.getRequests().at(-1)!.body.messages as Array<{ role: string; tool_call_id?: string }>)
      .filter(m => m.role === 'tool')
      .map(m => m.tool_call_id);
    expect(sentBack).toEqual(callOrder);

    const savedResults = (await memory.recall(THREAD)).messages.flatMap(m =>
      (m.content.parts ?? []).flatMap(p =>
        p.type === 'tool-invocation' && p.toolInvocation.state === 'result'
          ? [[p.toolInvocation.toolCallId, p.toolInvocation.result]]
          : [],
      ),
    );
    expect(savedResults).toEqual([
      ['call_flights', { cheapest: 420 }],
      ['call_car', { daily: 35 }],
      ['call_hotel', { nightly: 110 }],
    ]);
  });

  it('a processToolResult abort on the early result stops the run without streaming the slow result', async () => {
    const { tools, markWeatherStreamed } = createTools();
    const blockWeather: Processor = {
      id: 'block-weather',
      processToolResult: ({ toolName, messageList, abort }) => {
        if (toolName === 'getWeather') {
          // The slow tool must not wait for a result that is never streamed.
          markWeatherStreamed();
          abort('Weather lookups are disabled');
        }
        return messageList;
      },
    };

    const { output, llm } = await runLoopScenario({
      engine,
      llm: getMock(),
      prompt: 'Find me flights to Lisbon and check the weather there.',
      tools,
      stopWhen: stepCountIs(5),
      outputProcessors: [blockWeather],
      manualStreamConsumption: true,
      fixtures,
    });

    const chunks = await drain(output.fullStream as AsyncIterable<ChunkType>, () => {});

    const tripwire = chunks.find(c => c.type === 'tripwire');
    expect(tripwire?.payload).toMatchObject({ reason: 'Weather lookups are disabled', processorId: 'block-weather' });
    // The run ends at the tripwire: the model is not called again with the remaining result.
    expect(llm.getRequests()).toHaveLength(1);
    // The weather result tripped first; the flights result finished later and is dropped.
    expect(resultIds(chunks)).toEqual([]);
  });
});
