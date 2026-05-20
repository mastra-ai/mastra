import { openai } from '@ai-sdk/openai-v5';
import { streamText, stepCountIs, tool } from '@internal/ai-sdk-v5';
import type { MastraDBMessage, MastraMessageContentV2 } from '@mastra/core/agent';
import { convertMessages, MessageList } from '@mastra/core/agent';
import { InMemoryStore } from '@mastra/core/storage';
import { z } from 'zod';

import { Memory } from '../../../index';
import type { ObservationStep } from '../observation-turn/index';
import { seedThreadAndEnsureObservations } from './seed-phase';

/**
 * Demo: AI SDK integration using the Turn/Step high-level API.
 *
 * Compare with ai-sdk-production.ts which uses low-level primitives.
 * This version replaces ~150 lines of manual orchestration (onStepFinish,
 * prepareStep) with Turn/Step handles that encapsulate the ordering.
 */

const model = openai('gpt-4o-mini');
const OBSERVATION_MESSAGE_TOKENS = 150;

// ─── Helpers ────────────────────────────────────────────────────────────────

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

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY is required to run this demo.');
  }

  const threadId = 'turn-step-demo-thread';
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
    ],
  });

  const beforeRecord = await om.getRecord(threadId);
  console.log('\n=== BEFORE (seeded) ===');
  console.log(`- observation tokens: ${beforeRecord?.observationTokenCount ?? 0}`);
  console.log(`- observations: ${preview(beforeRecord?.activeObservations ?? '<none>')}`);

  // ── Create Turn + MessageList ──────────────────────────────────────────

  const messageList = new MessageList({ threadId });
  const turn = om.beginTurn({ threadId, messageList });
  const ctx = await turn.start({
    getContext: opts => memory.getContext(opts),
    persistMessages: async msgs => {
      await memory.saveMessages({ messages: msgs });
    },
  });

  // Add the user's new message
  const userPrompt =
    'Check the weather in both Helsinki and Tokyo, then tell me which city is better for outdoor sightseeing today.';
  const userMsg = createMessage(userPrompt, 'user', threadId, 'turn-u1');
  messageList.add(userMsg, 'input');
  await memory.saveMessages({ messages: [userMsg] });

  // ── Step 0: prepare (activates buffered chunks if any) ─────────────────

  const step0 = turn.step(0);
  const step0Ctx = await step0.prepare();
  console.log(`\n[step 0] activated=${step0Ctx.activated}, buffered=${step0Ctx.buffered}`);

  // ── Run multi-step streamText ──────────────────────────────────────────

  const stepLog: string[] = [];
  let currentStep: ObservationStep | undefined;

  const result = streamText({
    model,
    stopWhen: stepCountIs(6),
    system: step0Ctx.systemMessage ?? ctx.systemMessage,
    tools: { get_weather: weatherTool },
    messages: [
      ...ctx.messages.map(toAiSdkMessage),
      {
        role: 'user',
        content: `${userPrompt} Use tools to check both cities, then give a concise final comparison.`,
      },
    ],

    onStepFinish: async event => {
      // Add response messages to the MessageList
      const stepMsgs = convertMessages(event.response.messages)
        .to('Mastra.V2')
        .map(msg => ({ ...msg, threadId }));
      for (const msg of stepMsgs) {
        messageList.add(msg, 'response');
      }
    },

    prepareStep: async ({ stepNumber }: any) => {
      if (stepNumber === 0) return undefined;

      // One call — handles everything: save prev messages, check threshold,
      // buffer/observe if needed, build system message, filter observed
      currentStep = turn.step(stepNumber);
      const stepCtx = await currentStep.prepare();

      stepLog.push(
        `step ${stepNumber}: activated=${stepCtx.activated} observed=${stepCtx.observed} ` +
          `buffered=${stepCtx.buffered} (${stepCtx.status.pendingTokens}/${stepCtx.status.threshold})`,
      );

      return stepCtx.systemMessage ? { system: stepCtx.systemMessage } : undefined;
    },
  });

  await result.consumeStream();
  const finalText = await result.text;

  // ── End turn (saves unsaved messages, awaits buffering) ────────────────

  const turnResult = await turn.end();

  // ── Print results ──────────────────────────────────────────────────────

  console.log('\n--- Step Log ---');
  for (const entry of stepLog) {
    console.log(`  ${entry}`);
  }
  console.log(`\n--- Final Response ---`);
  console.log(`  ${finalText.slice(0, 300)}${finalText.length > 300 ? '...' : ''}`);

  const afterRecord = turnResult.record;
  const afterStatus = await om.getStatus({ threadId });
  console.log('\n=== AFTER ===');
  console.log(`- observation tokens: ${afterRecord.observationTokenCount ?? 0}`);
  console.log(`- pending: ${afterStatus.pendingTokens}/${afterStatus.threshold}`);
  console.log(`- observations: ${preview(afterRecord.activeObservations ?? '<none>')}`);
}

void main();
