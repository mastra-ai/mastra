import { openai } from '@ai-sdk/openai-v5';
import { streamText, stepCountIs, tool } from '@internal/ai-sdk-v5';
import type { MastraDBMessage, MastraMessageContentV2 } from '@mastra/core/agent';
import { convertMessages } from '@mastra/core/agent';
import { InMemoryStore } from '@mastra/core/storage';
import { z } from 'zod';

import { Memory } from '../../../index';
import { seedThreadAndEnsureObservations } from './seed-phase';

/**
 * Demo 4: Multi-step agent loop with plain MastraDBMessage[] + OM.
 *
 * Like Demo 3, but without MessageList — just a plain array of messages kept
 * in memory. Messages are NOT persisted to storage between steps; they live
 * purely in memory until the end.
 *
 * This works because the OM primitives accept optional `messages`:
 *   - `getStatus({ threadId, messages })` — checks thresholds against in-memory messages
 *   - `buffer({ threadId, messages })` — extracts observations from passed messages
 *   - `observe({ threadId, messages })` — same
 *   - `finalize({ threadId, messages })` — same
 *
 * No MessageList, no sealing, no sealed IDs. Just messages + OM primitives.
 */

const model = openai('gpt-4o-mini');
const OBSERVATION_MESSAGE_TOKENS = 150;

// ─── Shared helpers ──────────────────────────────────────────────────────────

const weatherTool = tool({
  description: 'Get current weather for a city using Open-Meteo APIs.',
  inputSchema: z.object({ city: z.string().describe('City name, e.g. Helsinki') }),
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

// ─── Print helpers ───────────────────────────────────────────────────────────

function printSnapshot(
  label: string,
  status: { pendingTokens: number; threshold: number; canActivate?: boolean; bufferedChunkCount?: number },
  record: any,
) {
  console.log(`\n=== ${label} ===`);
  console.log(`- pending tokens: ${status.pendingTokens}/${status.threshold}`);
  console.log(`- active observation tokens: ${record?.observationTokenCount ?? 0}`);
  console.log(`- buffered chunks: ${status.bufferedChunkCount ?? 0}`);
  console.log(`- can activate: ${status.canActivate ?? false}`);
  console.log(`--- Active Observations ---`);
  console.log(preview(record?.activeObservations ?? '<none>'));
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY is required to run this demo.');
  }

  const threadId = 'plain-messages-demo-thread';
  const memory = createMemory();
  const om = (await memory.omEngine)!;
  if (!om) throw new Error('Failed to initialize OM engine from Memory.');

  // ── Seed: establish baseline observations ──────────────────────────────

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
        'When comparing cities, I care most about practical effects: whether strong wind makes walking unpleasant, whether temperature requires extra layers, and whether weather could disrupt travel.',
        'user',
        threadId,
        'seed-u3',
      ),
      createMessage(
        'I usually travel between Helsinki and Tokyo twice a year, in spring and autumn. Those are the seasons where weather differences matter most for packing and planning outdoor activities.',
        'user',
        threadId,
        'seed-u4',
      ),
      createMessage(
        'That helps me tailor comparisons to seasonal patterns. I can highlight what to expect in each city during those transition months.',
        'assistant',
        threadId,
        'seed-a2',
      ),
      createMessage(
        'I prefer Celsius and metric units. Also, humidity matters a lot to me — Tokyo can be very humid even when temperatures seem moderate.',
        'user',
        threadId,
        'seed-u5',
      ),
      createMessage(
        'Good to know about the humidity preference. I will always include humidity and wind chill when relevant to give you a complete picture.',
        'assistant',
        threadId,
        'seed-a3',
      ),
    ],
  });

  const beforeRecord = await om.getRecord(threadId);
  const beforeStatus = await om.getStatus({ threadId });
  printSnapshot('BEFORE (seeded observations)', beforeStatus, beforeRecord);

  // ── Load history into a plain array ────────────────────────────────────

  const ctx = await memory.getContext({ threadId });
  const messages: MastraDBMessage[] = [...ctx.messages];

  const userPrompt =
    'Check the weather in both Helsinki and Tokyo, then tell me which city is better for outdoor sightseeing today.';

  // Add user message to our in-memory array (and persist it for the seed cursor)
  const userMsg = createMessage(userPrompt, 'user', threadId, 'turn-u1');
  messages.push(userMsg);
  await memory.saveMessages({ messages: [userMsg] });

  // ── Run multi-step streamText with OM hooks ────────────────────────────

  const stepLog: string[] = [];

  const result = streamText({
    model,
    stopWhen: stepCountIs(6),
    system: ctx.systemMessage,
    tools: { get_weather: weatherTool },
    messages: [
      ...ctx.messages.map(toAiSdkMessage),
      {
        role: 'user',
        content: `${userPrompt} Use tools to check both cities, then give a concise final comparison.`,
      },
    ],

    onStepFinish: async event => {
      const stepNum = stepLog.length;

      // Add step messages to our plain array — NO storage persistence
      const stepMsgs = convertMessages(event.response.messages)
        .to('Mastra.V2')
        .map(msg => ({ ...msg, threadId }));
      messages.push(...stepMsgs);

      // Check status with in-memory messages
      const status = await om.getStatus({ threadId, messages });

      if (status.shouldBuffer) {
        await om.buffer({ threadId, messages });
        stepLog.push(`step ${stepNum}: buffer (pending ${status.pendingTokens}/${status.threshold})`);
      } else if (status.shouldObserve) {
        if (status.canActivate) {
          await om.activate({ threadId });
        }
        await om.observe({ threadId, messages });
        stepLog.push(`step ${stepNum}: observe (pending ${status.pendingTokens}/${status.threshold})`);
      } else {
        stepLog.push(`step ${stepNum}: noop (pending ${status.pendingTokens}/${status.threshold})`);
      }
    },

    prepareStep: async ({ stepNumber }: any) => {
      if (stepNumber === 0) return undefined;

      // Activate buffered observations from previous steps
      const status = await om.getStatus({ threadId, messages });
      if (status.canActivate) {
        await om.activate({ threadId });
        stepLog.push(`prepareStep ${stepNumber}: activate`);
      }

      // Rebuild system message with latest observations
      const record = await om.getRecord(threadId);
      const freshSystem = record?.activeObservations
        ? await om.buildContextSystemMessage({ threadId, record })
        : undefined;

      return freshSystem ? { system: freshSystem } : undefined;
    },
  });

  await result.consumeStream();
  const finalText = await result.text;

  // ── Print step log ─────────────────────────────────────────────────────

  console.log('\n--- Step Log ---');
  for (const entry of stepLog) {
    console.log(`  ${entry}`);
  }
  console.log(`\n--- Final Response ---`);
  console.log(`  ${finalText.slice(0, 300)}${finalText.length > 300 ? '...' : ''}`);

  // ── Persist all messages at the end, then finalize ─────────────────────
  // Messages lived in memory during the loop. Now persist once and finalize.

  await memory.saveMessages({ messages });
  const finalResult = await om.finalize({ threadId, messages });
  if (finalResult.activated) console.log('\n  [Final] Activated remaining buffered chunks');
  if (finalResult.observed) console.log('  [Final] Ran observe() to catch up remaining messages');

  const afterRecord = await om.getRecord(threadId);
  const afterStatus = await om.getStatus({ threadId });
  printSnapshot('AFTER (all steps complete)', afterStatus, afterRecord);

  console.log('\n=== DELTA ===');
  console.log(
    `- observation token delta: ${(afterRecord?.observationTokenCount ?? 0) - (beforeRecord?.observationTokenCount ?? 0)}`,
  );
  console.log(`- final pending: ${afterStatus.pendingTokens}/${afterStatus.threshold}`);
}

void main();
