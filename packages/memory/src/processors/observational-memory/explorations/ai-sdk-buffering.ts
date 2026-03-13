import { openai } from '@ai-sdk/openai-v5';
import { streamText, stepCountIs, tool } from '@internal/ai-sdk-v5';
import type { MastraDBMessage, MastraMessageContentV2 } from '@mastra/core/agent';
import { convertMessages } from '@mastra/core/agent';
import { InMemoryStore } from '@mastra/core/storage';
import { z } from 'zod';

import { Memory } from '../../../index';
import { ObservationalMemory } from '../observational-memory';
import { seedThreadAndEnsureObservations } from './seed-phase';

/**
 * Demo 2: Multi-turn buffer → activate lifecycle with AI SDK.
 *
 * Unlike Demo 1 which uses `observe()` directly, this demo shows the staged
 * observation path: `buffer()` extracts observations into a staging area during
 * a turn, and `activate()` promotes them to active at the start of the next turn.
 * This is the pattern the OM processor uses for async observation.
 *
 * Flow across 3 turns:
 *
 * Turn 1 — Helsinki weather
 *   seed → getContext → streamText (multi-step via tool) → persist via onFinish
 *   → buffer() stages new observations from the conversation
 *
 * Turn 2 — Tokyo weather
 *   activate() promotes Turn 1's buffered observations into active context
 *   → getContext (now enriched) → streamText → persist → buffer() stages more
 *
 * Turn 3 — Helsinki vs Tokyo comparison
 *   activate() promotes Turn 2's buffered observations
 *   → getContext (fully enriched) → streamText → persist
 *   → observe() if threshold reached (final sync catch-up)
 */

const model = openai('gpt-4o-mini');
const OBSERVATION_MESSAGE_TOKENS = 80;

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

function printSnapshot(label: string, status: { pendingTokens: number; threshold: number; canActivate?: boolean }, record: any) {
  console.log(`\n=== ${label} ===`);
  console.log(`- pending tokens: ${status.pendingTokens}/${status.threshold}`);
  console.log(`- active observation tokens: ${record?.observationTokenCount ?? 0}`);
  console.log(`- buffered chunks: ${Array.isArray(record?.bufferedObservations) ? record.bufferedObservations.length : 0}`);
  console.log(`- can activate: ${status.canActivate ?? false}`);
  console.log(`--- Active Observations ---`);
  console.log(preview(record?.activeObservations ?? '<none>'));
}

function printTurnResult(label: string, text: string, action: string) {
  console.log(`\n--- ${label} ---`);
  console.log(`  response: ${text.slice(0, 200)}${text.length > 200 ? '...' : ''}`);
  console.log(`  OM action: ${action}`);
}

function printFinalDelta(
  afterRecord: any,
  afterStatus: { pendingTokens: number; threshold: number },
  beforeObservationTokens: number,
  beforeObservationText: string,
) {
  console.log('\n=== FINAL DELTA ===');
  console.log(`- observation token delta: ${(afterRecord?.observationTokenCount ?? 0) - beforeObservationTokens}`);
  console.log(`- observations changed: ${beforeObservationText !== (afterRecord?.activeObservations ?? '')}`);
  console.log(`- final pending: ${afterStatus.pendingTokens}/${afterStatus.threshold}`);
}

// ─── Turn runner ─────────────────────────────────────────────────────────────

/**
 * Run a single conversational turn: save the user message, load context,
 * stream a model response with tool use, and persist the result.
 *
 * Returns the final text so the caller can log it. OM lifecycle decisions
 * (buffer/activate/observe) are intentionally left to the caller in main().
 */
async function runTurn(opts: {
  memory: Memory;
  threadId: string;
  userPrompt: string;
  userMessageId: string;
}): Promise<string> {
  const { memory, threadId, userPrompt, userMessageId } = opts;

  // 1. Save user message to storage
  await memory.saveMessages({
    messages: [createMessage(userPrompt, 'user', threadId, userMessageId)],
  });

  // 2. Load context (includes observations if any are active)
  const ctx = await memory.getContext({ threadId });

  // 3. Stream model response with tool use
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
      // Persist all response messages (tool calls, tool results, assistant text)
      const responseMessages = convertMessages(event.response.messages)
        .to('Mastra.V2')
        .map(msg => ({ ...msg, threadId }));

      if (responseMessages.length > 0) {
        await memory.saveMessages({ messages: responseMessages });
      }
    },
  });

  // 4. Wait for stream + onFinish persistence to complete
  await result.consumeStream();
  return await result.text;
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY is required to run this demo.');
  }

  const threadId = 'buffer-demo-thread';
  const memory = createMemory();
  const om = (await (memory as any).getOMEngine()) as ObservationalMemory;
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
    ],
  });

  const beforeRecord = await om.getRecord(threadId);
  const beforeStatus = await om.getStatus({ threadId });
  const beforeObservationText = beforeRecord?.activeObservations ?? '';
  const beforeObservationTokens = beforeRecord?.observationTokenCount ?? 0;
  printSnapshot('BEFORE (seeded observations)', beforeStatus, beforeRecord);

  // ── Turn 1: Helsinki weather ───────────────────────────────────────────
  // After the turn, buffer() stages new observations from the conversation.

  const turn1Text = await runTurn({
    memory,
    threadId,
    userPrompt: "What's the weather like in Helsinki right now?",
    userMessageId: 'turn1-u1',
  });

  await om.buffer({ threadId });
  printTurnResult('Turn 1: Helsinki weather', turn1Text, 'buffer');
  printSnapshot('After Turn 1', await om.getStatus({ threadId }), await om.getRecord(threadId));

  // ── Turn 2: Tokyo weather ──────────────────────────────────────────────
  // First activate() to promote Turn 1's buffered observations into active
  // context, so the model sees them. Then run the turn and buffer again.

  await om.activate({ threadId });
  console.log('\n  [Turn 2] Activated buffered observations from Turn 1');

  const turn2Text = await runTurn({
    memory,
    threadId,
    userPrompt: "And what's the current weather in Tokyo?",
    userMessageId: 'turn2-u1',
  });

  await om.buffer({ threadId });
  printTurnResult('Turn 2: Tokyo weather', turn2Text, 'activate + buffer');
  printSnapshot('After Turn 2', await om.getStatus({ threadId }), await om.getRecord(threadId));

  // ── Turn 3: Comparison ─────────────────────────────────────────────────
  // Activate Turn 2's buffered observations, then ask for a comparison.
  // After the turn, observe() if we've crossed the threshold for a full
  // sync observation pass.

  await om.activate({ threadId });
  console.log('\n  [Turn 3] Activated buffered observations from Turn 2');

  const turn3Text = await runTurn({
    memory,
    threadId,
    userPrompt: 'Compare Helsinki and Tokyo weather — which city is better for outdoor sightseeing today?',
    userMessageId: 'turn3-u1',
  });

  printTurnResult('Turn 3: Comparison', turn3Text, 'activate');

  // ── Final: observe if any unprocessed messages remain ──────────────────

  const finalStatus = await om.getStatus({ threadId });
  if (finalStatus.shouldObserve) {
    await om.observe({ threadId });
    console.log('\n  [Final] Ran observe() to catch up remaining messages');
  }

  const afterRecord = await om.getRecord(threadId);
  const afterStatus = await om.getStatus({ threadId });
  printSnapshot('AFTER (all turns complete)', afterStatus, afterRecord);
  printFinalDelta(afterRecord, afterStatus, beforeObservationTokens, beforeObservationText);
}

void main();
