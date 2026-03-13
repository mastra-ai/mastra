import { openai } from '@ai-sdk/openai-v5';
import { generateText, stepCountIs, tool } from '@internal/ai-sdk-v5';
import type { MastraDBMessage, MastraMessageContentV2 } from '@mastra/core/agent';
import { InMemoryStore } from '@mastra/core/storage';
import { z } from 'zod';

import { Memory } from '../../../index';
import { ObservationalMemory } from '../observational-memory';
import { seedThreadAndEnsureObservations } from './seed-phase';

/**
 * Demo 3: deterministic cross-turn buffering + activation with Memory.getContext().
 */

const model = openai('gpt-4o-mini');
const OBSERVATION_MESSAGE_TOKENS = 90;

const weatherTool = tool({
  description: 'Get current weather for a city using Open-Meteo APIs.',
  inputSchema: z.object({ city: z.string() }),
  execute: async ({ city }) => {
    const geoRes = await fetch(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=en&format=json`,
    );
    if (!geoRes.ok) throw new Error(`Geocoding failed (${geoRes.status})`);
    const geo = (await geoRes.json()) as any;
    const place = geo?.results?.[0];
    if (!place) return `No location found for ${city}.`;

    const weatherRes = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${place.latitude}&longitude=${place.longitude}&current=temperature_2m,wind_speed_10m`,
    );
    if (!weatherRes.ok) throw new Error(`Weather lookup failed (${weatherRes.status})`);
    const weather = (await weatherRes.json()) as any;
    return `${place.name}: ${weather?.current?.temperature_2m}C, wind ${weather?.current?.wind_speed_10m} km/h.`;
  },
} as any);

function createMemory() {
  return new Memory({
    storage: new InMemoryStore(),
    options: {
      observationalMemory: {
        enabled: true,
        observation: { model, messageTokens: OBSERVATION_MESSAGE_TOKENS, bufferTokens: 0.2 },
        reflection: { model, observationTokens: 50_000 },
      },
    },
  });
}

function createMessage(content: string, role: 'user' | 'assistant', threadId: string, id: string): MastraDBMessage {
  return {
    id,
    role,
    content: { format: 2, parts: [{ type: 'text', text: content }] } as MastraMessageContentV2,
    type: 'text',
    createdAt: new Date(),
    threadId,
  };
}

function preview(text: string, maxChars = 900): string {
  if (text.length <= maxChars) return text;
  return `${text.slice(0, maxChars)}\n... (truncated)`;
}

async function main() {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY is required to run this demo.');
  }

  const threadId = 'cross-turn-demo-thread';
  const memory = createMemory();
  const om = (await (memory as any).getOMEngine()) as ObservationalMemory;
  if (!om) throw new Error('Failed to initialize OM engine from Memory.');

  await seedThreadAndEnsureObservations({
    memory,
    om,
    threadId,
    seedMessages: [
      createMessage(
        'I bike to work in Helsinki and care about wind, rain, and road surface safety.',
        'user',
        threadId,
        'seed-u1',
      ),
      createMessage(
        'My route is mostly open waterfront roads where crosswinds are usually the main issue.',
        'user',
        threadId,
        'seed-u2',
      ),
      createMessage(
        'I can provide concise go/no-go advice with safety rationale and gear suggestions.',
        'assistant',
        threadId,
        'seed-a1',
      ),
      createMessage(
        'I prefer direct go or no-go recommendations with practical safety rationale.',
        'assistant',
        threadId,
        'seed-a2',
      ),
    ],
  });

  const beforeRecord = await om.getRecord(threadId);
  const beforeStatus = await om.getStatus({ threadId });
  const beforeObservationText = beforeRecord?.activeObservations ?? '';
  const beforeObservationTokens = beforeRecord?.observationTokenCount ?? 0;

  console.log('=== BEFORE (seeded observations) ===');
  console.log(`- pending tokens: ${beforeStatus.pendingTokens}/${beforeStatus.threshold}`);
  console.log(`- active observation tokens: ${beforeRecord?.observationTokenCount ?? 0}`);
  console.log(
    `- buffered chunks: ${Array.isArray((beforeRecord as any)?.bufferedObservations) ? (beforeRecord as any).bufferedObservations.length : 0}`,
  );
  console.log('\n--- Active Observations (before) ---');
  console.log(preview(beforeRecord?.activeObservations ?? '<none>'));

  // Turn 1 (deterministic buffering setup): add enough new context to trigger buffering.
  await memory.saveMessages({
    messages: [
      createMessage(
        `Turn-1 accumulation message A. ${'wind temperature traction route conditions '.repeat(35)}`,
        'user',
        threadId,
        'turn1-u1',
      ),
      createMessage(
        `Turn-1 accumulation message B. ${'commute planning safety confidence alternatives '.repeat(35)}`,
        'assistant',
        threadId,
        'turn1-a1',
      ),
    ],
  });

  const turn1Buffered = await om.buffer({ threadId });

  // Turn 2: activate buffered observations, then run a real model call.
  const preActivateStatus = await om.getStatus({ threadId });
  const activated = preActivateStatus.canActivate ? await om.activate({ threadId }) : { activated: false as const };

  const turn2Ctx = await memory.getContext({ threadId });
  const result = await generateText({
    model,
    stopWhen: stepCountIs(4),
    system: turn2Ctx.systemMessage,
    tools: { get_weather: weatherTool },
    messages: [
      {
        role: 'user',
        content:
          'Continue from prior context and give weather in Helsinki plus bike advice. Use tools if needed, then always end with a concise final recommendation.',
      },
    ],
  });

  await memory.saveMessages({
    messages: [
      createMessage(
        'Continue from prior context and give weather in Helsinki plus bike advice.',
        'user',
        threadId,
        'turn2-u1',
      ),
      createMessage(result.text || '(no final text returned)', 'assistant', threadId, 'turn2-a1'),
    ],
  });

  const postTurn2Status = await om.getStatus({ threadId });
  if (postTurn2Status.shouldObserve) {
    await om.observe({ threadId });
  }

  const afterRecord = await om.getRecord(threadId);
  const afterStatus = await om.getStatus({ threadId });

  console.log('\nAI SDK cross-turn buffering demo complete');
  console.log('Turn 1 buffered:', turn1Buffered.buffered);
  console.log('Turn 2 activated:', activated.activated);
  console.log('Turn 2 generated text:', result.text);

  console.log('\n=== AFTER (post-live turn) ===');
  console.log(`- pending tokens: ${afterStatus.pendingTokens}/${afterStatus.threshold}`);
  console.log(`- active observation tokens: ${afterRecord?.observationTokenCount ?? 0}`);
  console.log(
    `- buffered chunks: ${Array.isArray((afterRecord as any)?.bufferedObservations) ? (afterRecord as any).bufferedObservations.length : 0}`,
  );
  console.log('\n--- Active Observations (after) ---');
  console.log(preview(afterRecord?.activeObservations ?? '<none>'));

  console.log('\n=== DELTA ===');
  console.log(`- observation token delta: ${(afterRecord?.observationTokenCount ?? 0) - beforeObservationTokens}`);
  console.log(`- observations changed: ${beforeObservationText !== (afterRecord?.activeObservations ?? '')}`);
}

void main();
