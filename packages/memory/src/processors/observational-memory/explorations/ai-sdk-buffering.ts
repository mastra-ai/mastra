import { openai } from '@ai-sdk/openai-v5';
import { generateText, stepCountIs, tool } from '@internal/ai-sdk-v5';
import type { MastraDBMessage, MastraMessageContentV2 } from '@mastra/core/agent';
import { convertMessages } from '@mastra/core/agent';
import { InMemoryStore } from '@mastra/core/storage';
import { z } from 'zod';

import { Memory } from '../../../index';
import { ObservationalMemory } from '../observational-memory';
import { seedThreadAndEnsureObservations } from './seed-phase';

/**
 * Demo 2: AI SDK multi-step hooks + OM buffering lifecycle.
 *
 * This example demonstrates three things together:
 * 1) AI SDK step callbacks (`onStepFinish`, `prepareStep`)
 * 2) Persisting real step outputs (no fabricated seed/step payloads)
 * 3) OM state transitions (`buffer`, `activate`, `observe`) between steps
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

function getBufferedChunkCount(record: any): number {
  return Array.isArray(record?.bufferedObservations) ? record.bufferedObservations.length : 0;
}

function summarizeHookLog(hookLog: string[]) {
  const counts = {
    onStepFinish: 0,
    prepareStep: 0,
    buffer: 0,
    activate: 0,
    observe: 0,
    noop: 0,
  };

  for (const entry of hookLog) {
    if (entry.startsWith('prepareStep(')) {
      counts.prepareStep += 1;
      continue;
    }
    if (entry in counts) {
      counts[entry as keyof typeof counts] += 1;
    }
  }

  return counts;
}

function printBeforeSnapshot(params: {
  beforeStatus: { pendingTokens: number; threshold: number };
  beforeRecord: any;
}) {
  const { beforeStatus, beforeRecord } = params;
  console.log('=== BEFORE (seeded observations) ===');
  console.log(`- pending tokens: ${beforeStatus.pendingTokens}/${beforeStatus.threshold}`);
  console.log(`- active observation tokens: ${beforeRecord?.observationTokenCount ?? 0}`);
  console.log(`- buffered chunks: ${getBufferedChunkCount(beforeRecord)}`);
  console.log('\n--- Active Observations (before) ---');
  console.log(preview(beforeRecord?.activeObservations ?? '<none>'));
}

function printAfterSnapshotAndDelta(params: {
  resultText: string;
  hookLog: string[];
  afterStatus: { pendingTokens: number; threshold: number };
  afterRecord: any;
  beforeObservationTokens: number;
  beforeObservationText: string;
}) {
  const { resultText, hookLog, afterStatus, afterRecord, beforeObservationTokens, beforeObservationText } = params;
  const hookCounts = summarizeHookLog(hookLog);

  console.log('\nAI SDK buffering demo complete');
  console.log('Result text:', resultText);
  console.log('Hook lifecycle:', hookLog.join(' -> '));
  console.log(
    `Hook counts: steps=${hookCounts.onStepFinish}, prepare=${hookCounts.prepareStep}, buffer=${hookCounts.buffer}, activate=${hookCounts.activate}, observe=${hookCounts.observe}, noop=${hookCounts.noop}`,
  );

  console.log('\n=== AFTER (post-live turn) ===');
  console.log(`- pending tokens: ${afterStatus.pendingTokens}/${afterStatus.threshold}`);
  console.log(`- active observation tokens: ${afterRecord?.observationTokenCount ?? 0}`);
  console.log(`- buffered chunks: ${getBufferedChunkCount(afterRecord)}`);
  console.log('\n--- Active Observations (after) ---');
  console.log(preview(afterRecord?.activeObservations ?? '<none>'));

  console.log('\n=== DELTA ===');
  console.log(`- observation token delta: ${(afterRecord?.observationTokenCount ?? 0) - beforeObservationTokens}`);
  console.log(`- observations changed: ${beforeObservationText !== (afterRecord?.activeObservations ?? '')}`);
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
  printBeforeSnapshot({ beforeStatus, beforeRecord });

  const hookLog: string[] = [];
  const ctx = await memory.getContext({ threadId });
  const userPrompt = 'Compare current weather in Helsinki and Tokyo for travel today.';

  await memory.saveMessages({
    messages: [createMessage(userPrompt, 'user', threadId, 'turn-u1')],
  });

  const result = await generateText({
    model,
    stopWhen: stepCountIs(3),
    system: ctx.systemMessage,
    tools: { get_weather: weatherTool },
    messages: [
      {
        role: 'user',
        content: `${userPrompt} Use tools if needed, then always end with a concise final recommendation.`,
      },
    ],

    async onStepFinish(step) {
      hookLog.push('onStepFinish');

      // Persist the real step output first so OM decisions below always run against
      // the latest conversation state from this AI SDK step.
      const responseMessages = convertMessages(step.response.messages)
        .to('Mastra.V2')
        .map(msg => ({ ...msg, threadId }));

      if (responseMessages.length > 0) {
        await memory.saveMessages({ messages: responseMessages });
      }

      // Core OM lifecycle decision point per step:
      // - if enough fresh content exists, observe immediately
      // - if we crossed buffer threshold only, buffer now
      // - if buffered chunks are activatable, activate before observe
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

      // Rebuild system context for the *next* model step so newly activated or
      // observed memory can influence subsequent reasoning/tool decisions.
      const stepCtx = await memory.getContext({ threadId });
      hookLog.push(`prepareStep(${stepNumber})`);
      return { system: stepCtx.systemMessage };
    },
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
  printAfterSnapshotAndDelta({
    resultText: result.text,
    hookLog,
    afterStatus,
    afterRecord,
    beforeObservationTokens,
    beforeObservationText,
  });
}

void main();
