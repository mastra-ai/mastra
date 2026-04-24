import { openai } from '@ai-sdk/openai-v5';
import { streamText, stepCountIs, tool } from '@internal/ai-sdk-v5';
import type { MastraDBMessage, MastraMessageContentV2 } from '@mastra/core/agent';
import { convertMessages } from '@mastra/core/agent';
import { InMemoryStore } from '@mastra/core/storage';
import { z } from 'zod';

import { Memory } from '../../../index';
import { seedThreadAndEnsureObservations } from './seed-phase';

/**
 * Demo 1: single-turn weather-agent orchestration with Memory.getContext().
 *
 * Flow:
 * 1) seed thread and force an initial OM observation
 * 2) print BEFORE snapshot
 * 3) run a real model turn using memory.getContext()
 * 4) persist the turn and observe again
 * 5) print AFTER snapshot and delta
 */

const model = openai('gpt-4o-mini');
const OBSERVATION_MESSAGE_TOKENS = 60;

const weatherTool = tool({
  description: 'Get current weather for a city using Open-Meteo APIs.',
  inputSchema: z.object({
    city: z.string().describe('City name, e.g. Helsinki'),
  }),
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
    const current = weather?.current;

    return `${place.name}: ${current?.temperature_2m}C, wind ${current?.wind_speed_10m} km/h.`;
  },
} as any);

function createMemory() {
  return new Memory({
    storage: new InMemoryStore(),
    options: {
      observationalMemory: {
        enabled: true,
        observation: { model, messageTokens: OBSERVATION_MESSAGE_TOKENS, bufferTokens: false },
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

function toAiSdkMessage(msg: MastraDBMessage) {
  const text =
    msg.content && typeof msg.content === 'object' && 'parts' in msg.content
      ? (msg.content as MastraMessageContentV2).parts
          .filter((p: any) => p.type === 'text')
          .map((p: any) => p.text)
          .join('')
      : '';
  return { role: msg.role as 'user' | 'assistant', content: text };
}

function preview(text: string, maxChars = 900): string {
  if (text.length <= maxChars) return text;
  return `${text.slice(0, maxChars)}\n... (truncated)`;
}

function printBeforeSnapshot(params: {
  beforeStatus: { pendingTokens: number; threshold: number };
  beforeRecord:
    | {
        observationTokenCount?: number;
        lastObservedAt?: Date | number;
        activeObservations?: string;
      }
    | null
    | undefined;
}) {
  const { beforeStatus, beforeRecord } = params;
  console.log('=== BEFORE (seeded observations) ===');
  console.log(`- pending tokens: ${beforeStatus.pendingTokens}/${beforeStatus.threshold}`);
  console.log(`- active observation tokens: ${beforeRecord?.observationTokenCount ?? 0}`);
  console.log(
    `- last observed at: ${beforeRecord?.lastObservedAt ? new Date(beforeRecord.lastObservedAt).toISOString() : 'never'}`,
  );
  console.log('\n--- Active Observations (before) ---');
  console.log(preview(beforeRecord?.activeObservations ?? '<none>'));
}

function printAfterSnapshotAndDelta(params: {
  finalText: string;
  afterStatus: { pendingTokens: number; threshold: number };
  afterRecord:
    | {
        observationTokenCount?: number;
        lastObservedAt?: Date | number;
        activeObservations?: string;
      }
    | null
    | undefined;
  beforeObservationTokens: number;
  beforeObservationText: string;
}) {
  const { finalText, afterStatus, afterRecord, beforeObservationTokens, beforeObservationText } = params;
  console.log('\nAI SDK usage demo complete');
  console.log('Generated text:', finalText);

  console.log('\n=== AFTER (post-live turn) ===');
  console.log(`- pending tokens: ${afterStatus.pendingTokens}/${afterStatus.threshold}`);
  console.log(`- active observation tokens: ${afterRecord?.observationTokenCount ?? 0}`);
  console.log(
    `- last observed at: ${afterRecord?.lastObservedAt ? new Date(afterRecord.lastObservedAt).toISOString() : 'never'}`,
  );
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

  const threadId = 'demo-thread';
  const memory = createMemory();
  const om = (await memory.omEngine)!;
  if (!om) throw new Error('Failed to initialize OM engine from Memory.');

  await seedThreadAndEnsureObservations({
    memory,
    om,
    threadId,
    seedMessages: [
      createMessage('I live in Helsinki and bike to work.', 'user', threadId, 'seed-u1'),
      createMessage('I can help with weather-aware commute advice.', 'assistant', threadId, 'seed-a1'),
      createMessage('I prefer concise, practical answers.', 'user', threadId, 'seed-u2'),
      createMessage('I usually decide commute mode based on wind and temperature.', 'user', threadId, 'seed-u3'),
    ],
  });

  const beforeRecord = await om.getRecord(threadId);
  const beforeStatus = await om.getStatus({ threadId });
  const beforeObservationText = beforeRecord?.activeObservations ?? '';
  const beforeObservationTokens = beforeRecord?.observationTokenCount ?? 0;
  printBeforeSnapshot({ beforeStatus, beforeRecord });

  const ctx = await memory.getContext({ threadId });
  const userPrompt = 'What is the weather in Helsinki right now, and should I bike today?';

  await memory.saveMessages({
    messages: [createMessage(userPrompt, 'user', threadId, 'turn-u1')],
  });

  const result = streamText({
    model,
    stopWhen: stepCountIs(4),
    system: ctx.systemMessage,
    tools: { get_weather: weatherTool },
    messages: [
      ...ctx.messages.map(toAiSdkMessage),
      {
        role: 'user',
        content: `${userPrompt} Use tools if needed, then always end with a concise final answer.`,
      },
    ],
    onFinish: async event => {
      const responseMessages = convertMessages(event.response.messages)
        .to('Mastra.V2')
        .map(msg => ({ ...msg, threadId }));

      await memory.saveMessages({
        messages: responseMessages,
      });

      const postTurnStatus = await om.getStatus({ threadId });
      if (postTurnStatus.shouldObserve) {
        await om.observe({ threadId });
      }
    },
  });

  await result.consumeStream();
  const finalText = await result.text;

  const afterRecord = await om.getRecord(threadId);
  const afterStatus = await om.getStatus({ threadId });
  printAfterSnapshotAndDelta({
    finalText,
    afterStatus,
    afterRecord,
    beforeObservationTokens,
    beforeObservationText,
  });
}

void main();
