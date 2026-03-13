import { openai } from '@ai-sdk/openai-v5';
import { generateText, stepCountIs, tool } from '@internal/ai-sdk-v5';
import type { MastraDBMessage, MastraMessageContentV2 } from '@mastra/core/agent';
import { InMemoryStore } from '@mastra/core/storage';
import { z } from 'zod';

import { Memory } from '../../../index';
import { ObservationalMemory } from '../observational-memory';
import { seedThreadAndEnsureObservations } from './seed-phase';

/**
 * Demo 2: deterministic multi-step buffering flow with Memory.getContext().
 */

const model = openai('gpt-4o-mini');
const OBSERVATION_MESSAGE_TOKENS = 80;

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

  const threadId = 'buffer-demo-thread';
  const memory = createMemory();
  const om = (await (memory as any).getOMEngine()) as ObservationalMemory;
  if (!om) throw new Error('Failed to initialize OM engine from Memory.');

  await seedThreadAndEnsureObservations({
    memory,
    om,
    threadId,
    seedMessages: [
      createMessage('I compare weather in Helsinki and Tokyo often for travel planning.', 'user', threadId, 'seed-u1'),
      createMessage('I want concise weather comparisons with direct recommendations.', 'user', threadId, 'seed-u2'),
      createMessage(
        'I can provide concise city-to-city comparisons and practical guidance.',
        'assistant',
        threadId,
        'seed-a1',
      ),
      createMessage(
        'I usually choose travel plans based on temperature, wind, and comfort expectations.',
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

  const hookLog: string[] = [];
  const ctx = await memory.getContext({ threadId });
  const result = await generateText({
    model,
    stopWhen: stepCountIs(3),
    system: ctx.systemMessage,
    tools: { get_weather: weatherTool },
    messages: [
      {
        role: 'user',
        content:
          'Compare current weather in Helsinki and Tokyo for travel today. Use tools if needed, then always end with a concise final recommendation.',
      },
    ],

    async onStepFinish() {
      hookLog.push('onStepFinish');

      // Deterministic teaching behavior: synthetic per-step persistence so buffering
      // transitions are reliably visible in each run.
      await memory.saveMessages({
        messages: [
          createMessage(
            `Synthetic step persistence for deterministic buffering demo #${hookLog.length}. ${'step-context '.repeat(12)}`,
            'assistant',
            threadId,
            `step-${hookLog.length}`,
          ),
        ],
      });

      const status = await om.getStatus({ threadId });
      if (status.shouldObserve) {
        if (status.canActivate) {
          await om.activate({ threadId });
          hookLog.push('activate');
        }
        await om.observe({ threadId });
        hookLog.push('observe');
      } else if (status.shouldBuffer) {
        await om.buffer({ threadId });
        hookLog.push('buffer');
      } else {
        hookLog.push('noop');
      }
    },

    async prepareStep({ stepNumber }) {
      if (stepNumber === 0) return undefined;
      const stepCtx = await memory.getContext({ threadId });
      hookLog.push(`prepareStep(${stepNumber})`);
      return { system: stepCtx.systemMessage };
    },
  });

  await memory.saveMessages({
    messages: [
      createMessage('Compare current weather in Helsinki and Tokyo for travel today.', 'user', threadId, 'turn-u1'),
      createMessage(result.text || '(no final text returned)', 'assistant', threadId, 'turn-a1'),
    ],
  });

  const finalizeStatus = await om.getStatus({ threadId });
  if (finalizeStatus.canActivate) {
    await om.activate({ threadId });
  }
  const finalizeStatus2 = await om.getStatus({ threadId });
  if (finalizeStatus2.shouldObserve) {
    await om.observe({ threadId });
  }

  const afterRecord = await om.getRecord(threadId);
  const afterStatus = await om.getStatus({ threadId });

  console.log('\nAI SDK buffering demo complete');
  console.log('Result text:', result.text);
  console.log('Hook log:', hookLog.join(' -> '));

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
