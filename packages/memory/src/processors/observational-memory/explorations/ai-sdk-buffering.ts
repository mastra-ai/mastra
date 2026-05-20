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
 * Each turn follows a consistent per-turn pattern (see `runTurn()`):
 *   1. activate() — promote any buffered observations from the previous turn
 *   2. save user message + getContext (now includes activated observations)
 *   3. streamText with tool use + persist via onFinish
 *   4. buffer() — stage new observations for the next turn
 *
 * After all turns, a final observe() catches up any remaining unprocessed
 * messages and advances the observation cursor.
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
 * Run a single conversational turn with the buffer→activate lifecycle baked in.
 *
 * Per-turn pattern:
 * 1. activate() — promote any buffered observations from the previous turn
 * 2. save user message + getContext (now includes activated observations)
 * 3. streamText with tool use + persist via onFinish
 * 4. buffer() — stage new observations for the next turn
 *
 * Returns the final text and what OM actions were taken.
 */
async function runTurn(opts: {
  om: ObservationalMemory;
  memory: Memory;
  threadId: string;
  userPrompt: string;
  userMessageId: string;
}): Promise<{ text: string; actions: string[] }> {
  const { om, memory, threadId, userPrompt, userMessageId } = opts;
  const actions: string[] = [];

  // 1. Activate buffered observations from previous turn (if any)
  const preStatus = await om.getStatus({ threadId });
  if (preStatus.canActivate) {
    await om.activate({ threadId });
    actions.push('activate');
  }

  // 2. Save user message to storage
  await memory.saveMessages({
    messages: [createMessage(userPrompt, 'user', threadId, userMessageId)],
  });

  // 3. Load context (includes activated observations if step 1 ran)
  const ctx = await memory.getContext({ threadId });

  // 4. Stream model response with tool use
  const result = streamText({
    model,
    stopWhen: stepCountIs(4),
    system: ctx.systemMessage,
    tools: { get_weather: weatherTool },
    messages: ctx.messages.map(toAiSdkMessage),
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

  // 5. Wait for stream + onFinish persistence to complete
  await result.consumeStream();

  // 6. Buffer new observations from this turn for the next turn
  await om.buffer({ threadId });
  actions.push('buffer');

  return { text: await result.text, actions };
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY is required to run this demo.');
  }

  const threadId = 'buffer-demo-thread';
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
  const beforeObservationText = beforeRecord?.activeObservations ?? '';
  const beforeObservationTokens = beforeRecord?.observationTokenCount ?? 0;
  printSnapshot('BEFORE (seeded observations)', beforeStatus, beforeRecord);

  // ── Turn 1: Helsinki weather ───────────────────────────────────────────

  const turn1 = await runTurn({
    om,
    memory,
    threadId,
    userPrompt: "What's the weather like in Helsinki right now?",
    userMessageId: 'turn1-u1',
  });
  printTurnResult('Turn 1: Helsinki weather', turn1.text, turn1.actions.join(' → '));
  printSnapshot('After Turn 1', await om.getStatus({ threadId }), await om.getRecord(threadId));

  // ── Turn 2: Tokyo weather ──────────────────────────────────────────────

  const turn2 = await runTurn({
    om,
    memory,
    threadId,
    userPrompt: "And what's the current weather in Tokyo?",
    userMessageId: 'turn2-u1',
  });
  printTurnResult('Turn 2: Tokyo weather', turn2.text, turn2.actions.join(' → '));
  printSnapshot('After Turn 2', await om.getStatus({ threadId }), await om.getRecord(threadId));

  // ── Turn 3: Comparison ─────────────────────────────────────────────────

  const turn3 = await runTurn({
    om,
    memory,
    threadId,
    userPrompt: 'Compare Helsinki and Tokyo weather — which city is better for outdoor sightseeing today?',
    userMessageId: 'turn3-u1',
  });
  printTurnResult('Turn 3: Comparison', turn3.text, turn3.actions.join(' → '));

  // ── Final: flush remaining buffered chunks and advance cursor ──────────

  const finalResult = await om.finalize({ threadId });
  if (finalResult.activated) console.log('\n  [Final] Activated remaining buffered chunks');
  if (finalResult.observed) console.log('  [Final] Ran observe() to catch up remaining messages');

  const afterRecord = await om.getRecord(threadId);
  const afterStatus = await om.getStatus({ threadId });
  printSnapshot('AFTER (all turns complete)', afterStatus, afterRecord);
  printFinalDelta(afterRecord, afterStatus, beforeObservationTokens, beforeObservationText);
}

void main();
