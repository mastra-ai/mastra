/**
 * Message Ordering Integration Tests - Issue #9909
 *
 * These tests verify that message part ordering is preserved through the full
 * streaming -> persistence -> retrieval cycle with REAL storage backends.
 *
 * Issue: https://github.com/mastra-ai/mastra/issues/9909
 *
 * Each test compares THREE sources:
 * 1. STREAM - The ground truth of what was streamed from the LLM
 * 2. RAW STORAGE - Direct query to the database (listMessages)
 * 3. RECALL - The processed recall output from Memory
 *
 * Tests run with both OpenAI and Anthropic models to ensure provider-agnostic behavior.
 */

import { randomUUID } from 'node:crypto';
import { Agent } from '@mastra/core/agent';
import type { MastraDBMessage, MastraMessageContentV2 } from '@mastra/core/agent';
import type { MastraModelConfig } from '@mastra/core/llm';
import { createTool } from '@mastra/core/tools';
import { LibSQLStore } from '@mastra/libsql';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { Memory } from '@mastra/memory';

type MessagePart = MastraMessageContentV2['parts'][number];
type OrderEntry = { type: string; content?: string };

// Model configurations for testing
interface ModelConfig {
  name: string;
  model: MastraModelConfig;
  envVar: string;
}

const MODEL_CONFIGS: ModelConfig[] = [
  {
    name: 'OpenAI GPT-4o',
    model: 'openai/gpt-4o',
    envVar: 'OPENAI_API_KEY',
  },
  {
    name: 'Anthropic Claude Sonnet',
    model: 'anthropic/claude-sonnet-4-5',
    envVar: 'ANTHROPIC_API_KEY',
  },
  {
    name: 'Google Gemini 3.0',
    model: 'google/gemini-pro-latest',
    envVar: 'GOOGLE_GENERATIVE_AI_API_KEY',
  },
];

// Helper to add delay
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Helper to extract order from parts
function extractOrder(parts: MessagePart[]): OrderEntry[] {
  const order: OrderEntry[] = [];
  for (const part of parts) {
    if (part.type === 'text') {
      order.push({ type: 'TEXT', content: part.text?.substring(0, 50) });
    } else if (part.type === 'tool-invocation') {
      order.push({ type: 'TOOL', content: part.toolInvocation?.toolName });
    } else if (part.type === 'step-start') {
      order.push({ type: 'STEP' });
    }
  }
  return order;
}

// Helper to compare orders and report differences
function compareOrders(
  streamOrder: OrderEntry[],
  rawStorageOrder: OrderEntry[],
  recallOrder: OrderEntry[],
): { streamVsRaw: boolean; streamVsRecall: boolean; rawVsRecall: boolean } {
  const streamSeq = streamOrder.map(o => o.type).join(' -> ');
  const rawSeq = rawStorageOrder.map(o => o.type).join(' -> ');
  const recallSeq = recallOrder.map(o => o.type).join(' -> ');

  console.log('\n=== ORDER COMPARISON ===');
  console.log('STREAM order:      ', streamSeq);
  console.log('RAW STORAGE order: ', rawSeq);
  console.log('RECALL order:      ', recallSeq);

  const streamVsRaw = streamSeq === rawSeq;
  const streamVsRecall = streamSeq === recallSeq;
  const rawVsRecall = rawSeq === recallSeq;

  console.log('\n=== MATCH RESULTS ===');
  console.log(`Stream vs Raw Storage: ${streamVsRaw ? '✅ MATCH' : '❌ MISMATCH'}`);
  console.log(`Stream vs Recall:      ${streamVsRecall ? '✅ MATCH' : '❌ MISMATCH'}`);
  console.log(`Raw Storage vs Recall: ${rawVsRecall ? '✅ MATCH' : '❌ MISMATCH'}`);

  return { streamVsRaw, streamVsRecall, rawVsRecall };
}

// Helper to verify no duplicate text-start or text-end IDs
function verifyNoTextIdDuplicates(textBlockIds: { id: string; type: string; idx: number }[]): {
  textStartDuplicates: string[];
  textEndDuplicates: string[];
} {
  const textStartIds = textBlockIds.filter(t => t.type === 'text-start').map(t => t.id);
  const textEndIds = textBlockIds.filter(t => t.type === 'text-end').map(t => t.id);

  const findDuplicates = (arr: string[]) => {
    const seen = new Set<string>();
    const duplicates: string[] = [];
    for (const id of arr) {
      if (seen.has(id)) {
        if (!duplicates.includes(id)) duplicates.push(id);
      }
      seen.add(id);
    }
    return duplicates;
  };

  const textStartDuplicates = findDuplicates(textStartIds);
  const textEndDuplicates = findDuplicates(textEndIds);

  if (textStartDuplicates.length > 0) {
    console.log(`❌ DUPLICATE text-start IDs found: ${textStartDuplicates.join(', ')}`);
  }
  if (textEndDuplicates.length > 0) {
    console.log(`❌ DUPLICATE text-end IDs found: ${textEndDuplicates.join(', ')}`);
  }

  return { textStartDuplicates, textEndDuplicates };
}

// Helper to check text-before-tool ordering
function verifyTextBeforeTool(order: OrderEntry[], source: string): boolean {
  const firstText = order.findIndex(o => o.type === 'TEXT');
  const firstTool = order.findIndex(o => o.type === 'TOOL');

  console.log(`\n${source}: TEXT at ${firstText}, TOOL at ${firstTool}`);

  if (firstText !== -1 && firstTool !== -1) {
    if (firstText < firstTool) {
      console.log(`✅ ${source}: Text appears BEFORE tool`);
      return true;
    } else {
      console.log(`❌ ${source}: Text appears AFTER tool - BUG!`);
      return false;
    }
  } else if (firstTool !== -1 && firstText === -1) {
    console.log(`📝 ${source}: No text before tool (model went straight to tool)`);
    return true; // Not a bug, just model behavior
  }
  return true;
}

// Create tools for weather tests
function createWeatherTools() {
  const getWeatherTool = createTool({
    id: 'get_weather',
    description: 'Get the current weather for a city',
    inputSchema: z.object({ city: z.string().describe('The city to get weather for') }),
    execute: async (input: { city: string }) => ({
      city: input.city,
      weather: 'sunny',
      temperature: 72,
    }),
  });

  const getForecastTool = createTool({
    id: 'get_forecast',
    description: 'Get the weather forecast for the next few days',
    inputSchema: z.object({ city: z.string().describe('The city to get forecast for') }),
    execute: async (input: { city: string }) => ({
      city: input.city,
      forecast: [
        { day: 'Tomorrow', weather: 'partly cloudy', high: 75, low: 58 },
        { day: 'Day after', weather: 'sunny', high: 78, low: 60 },
      ],
    }),
  });

  return { get_weather: getWeatherTool, get_forecast: getForecastTool };
}

// Create tools for research tests
function createResearchTools() {
  const searchTool = createTool({
    id: 'search',
    description: 'Search for information',
    inputSchema: z.object({ query: z.string() }),
    execute: async (input: { query: string }) => ({ results: [`Result for: ${input.query}`] }),
  });

  const createDocTool = createTool({
    id: 'create_document',
    description: 'Create a document',
    inputSchema: z.object({ title: z.string(), content: z.string() }),
    execute: async () => ({ id: `doc-${Date.now()}`, status: 'created' }),
  });

  return { search: searchTool, create_document: createDocTool };
}

// Run tests for each model configuration
for (const modelConfig of MODEL_CONFIGS) {
  describe(`Message Ordering with ${modelConfig.name} (Issue #9909)`, () => {
    const dbFile = 'file:ordering-test.db';

    const createMemory = () =>
      new Memory({
        options: { lastMessages: 20 },
        storage: new LibSQLStore({
          id: `ordering-test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
          url: dbFile,
        }),
      });

    const skipIfNoApiKey = () => {
      if (!process.env[modelConfig.envVar]) {
        console.log(`Skipping: ${modelConfig.envVar} not set`);
        return true;
      }
      return false;
    };

    it('should preserve text ordering: stream -> raw storage -> recall', async () => {
      if (skipIfNoApiKey()) return;

      const memory = createMemory();
      const tools = createWeatherTools();

      const agent = new Agent({
        id: `ordering-test-agent-${modelConfig.name}`,
        name: 'Ordering Test Agent',
        instructions: `You are a weather assistant. When asked about weather, first explain what you will do, then get the current weather, explain what you found, then get the forecast, and finally summarize everything. Always be verbose between tool calls.`,
        model: modelConfig.model,
        memory,
        tools,
      });

      const threadId = randomUUID();
      const resourceId = 'ordering-test-user';

      console.log('\n========================================');
      console.log(`TEST: Stream -> Raw Storage -> Recall (${modelConfig.name})`);
      console.log('========================================');
      console.log('Thread ID:', threadId);

      // === 1. STREAM AND TRACK ORDER ===
      const streamOrder: OrderEntry[] = [];
      let textAccumulator = '';

      const stream = await agent.stream("What's the weather in San Francisco?", {
        memory: { thread: threadId, resource: resourceId },
        maxSteps: 5,
      });

      let chunkIndex = 0;
      const textBlockIds: { id: string; type: string; idx: number }[] = [];

      for await (const chunk of stream.fullStream) {
        const idx = chunkIndex++;

        // Track text-start and text-end IDs
        if ('payload' in chunk && chunk.payload) {
          const payload = chunk.payload as Record<string, unknown>;
          if ((chunk.type === 'text-start' || chunk.type === 'text-end') && payload.id) {
            textBlockIds.push({ id: payload.id as string, type: chunk.type, idx });
          }
        }

        if (chunk.type === 'text-delta') {
          textAccumulator += chunk.payload?.text || '';
        } else if (chunk.type === 'text-end' && textAccumulator.trim()) {
          streamOrder.push({ type: 'TEXT', content: textAccumulator.substring(0, 50) });
          textAccumulator = '';
        } else if (chunk.type === 'tool-call') {
          streamOrder.push({ type: 'TOOL', content: chunk.payload?.toolName });
        } else if (chunk.type === 'step-start') {
          streamOrder.push({ type: 'STEP' });
        }
      }

      // Analyze text block IDs for duplicates
      console.log('\n--- TEXT BLOCK ID ANALYSIS ---');
      console.log('Text IDs:', textBlockIds);

      const { textStartDuplicates, textEndDuplicates } = verifyNoTextIdDuplicates(textBlockIds);
      expect(textStartDuplicates, 'Duplicate text-start IDs detected').toHaveLength(0);
      expect(textEndDuplicates, 'Duplicate text-end IDs detected').toHaveLength(0);

      await delay(500);

      // === 2. GET RAW STORAGE ORDER ===
      const memoryStore = await memory.storage.getStore('memory');
      expect(memoryStore).toBeDefined();
      const rawStorageResult = await memoryStore?.listMessages({ threadId, resourceId });
      const rawAssistantMsgs = rawStorageResult.messages.filter((m: MastraDBMessage) => m.role === 'assistant');

      console.log('\n=== RAW STORAGE ===');
      console.log('Total messages:', rawStorageResult.messages.length);
      console.log('Assistant messages:', rawAssistantMsgs.length);

      const rawStorageOrder: OrderEntry[] = [];
      for (const msg of rawAssistantMsgs) {
        console.log(`\nMessage ${msg.id}:`);
        const parts = msg.content.parts || [];
        parts.forEach((p: MessagePart, i: number) => {
          if (p.type === 'text') {
            console.log(`  [${i}] TEXT: "${p.text?.substring(0, 50)}..."`);
          } else if (p.type === 'tool-invocation') {
            console.log(`  [${i}] TOOL: ${p.toolInvocation?.toolName}`);
          } else if (p.type === 'step-start') {
            console.log(`  [${i}] STEP`);
          }
        });
        rawStorageOrder.push(...extractOrder(parts));
      }

      // === 3. GET RECALL ORDER ===
      const recallResult = await memory.recall({ threadId, resourceId });
      const recallAssistantMsgs = recallResult.messages.filter((m: MastraDBMessage) => m.role === 'assistant');

      console.log('\n=== RECALL OUTPUT ===');
      console.log('Total messages:', recallResult.messages.length);
      console.log('Assistant messages:', recallAssistantMsgs.length);

      const recallOrder: OrderEntry[] = [];
      for (const msg of recallAssistantMsgs) {
        console.log(`\nMessage ${msg.id}:`);
        const parts = msg.content.parts || [];
        parts.forEach((p: MessagePart, i: number) => {
          if (p.type === 'text') {
            console.log(`  [${i}] TEXT: "${p.text?.substring(0, 50)}..."`);
          } else if (p.type === 'tool-invocation') {
            console.log(`  [${i}] TOOL: ${p.toolInvocation?.toolName}`);
          } else if (p.type === 'step-start') {
            console.log(`  [${i}] STEP`);
          }
        });
        recallOrder.push(...extractOrder(parts));
      }

      // === 4. COMPARE ALL THREE ===
      compareOrders(streamOrder, rawStorageOrder, recallOrder);

      // === 5. VERIFY TEXT-BEFORE-TOOL ===
      const rawCorrect = verifyTextBeforeTool(rawStorageOrder, 'RAW STORAGE');
      const recallCorrect = verifyTextBeforeTool(recallOrder, 'RECALL');

      // === 6. ASSERTIONS ===
      const streamFirstText = streamOrder.findIndex(o => o.type === 'TEXT');
      const streamFirstTool = streamOrder.findIndex(o => o.type === 'TOOL');

      if (streamFirstText !== -1 && streamFirstTool !== -1 && streamFirstText < streamFirstTool) {
        expect(rawCorrect).toBe(true);
        expect(recallCorrect).toBe(true);
      }

      // Verify no text was lost
      const streamTextCount = streamOrder.filter(o => o.type === 'TEXT').length;
      const rawTextCount = rawStorageOrder.filter(o => o.type === 'TEXT').length;
      const recallTextCount = recallOrder.filter(o => o.type === 'TEXT').length;

      console.log(`\n=== TEXT COUNT ===`);
      console.log(`Stream: ${streamTextCount}, Raw: ${rawTextCount}, Recall: ${recallTextCount}`);

      expect(rawTextCount).toBeGreaterThanOrEqual(streamTextCount);
      expect(recallTextCount).toBeGreaterThanOrEqual(streamTextCount);
    }, 90000);

    it('should preserve ordering with multiple tool calls', async () => {
      if (skipIfNoApiKey()) return;

      const memory = createMemory();
      const tools = createResearchTools();

      const agent = new Agent({
        id: `multi-tool-agent-${modelConfig.name}`,
        name: 'Multi-Tool Agent',
        instructions: `You are a research assistant. When asked to research something, first explain your research plan, then search for information multiple times, explain what you found after each search, then create a document with your findings, and finally confirm completion. Always be verbose between tool calls.`,
        model: modelConfig.model,
        memory,
        tools,
      });

      const threadId = randomUUID();
      const resourceId = 'multi-tool-test';

      console.log('\n========================================');
      console.log(`TEST: Multiple Tool Calls Ordering (${modelConfig.name})`);
      console.log('========================================');

      // === 1. STREAM ===
      const streamOrder: OrderEntry[] = [];
      let textAccumulator = '';

      const stream = await agent.stream('Research weather patterns in CA and create a summary.', {
        memory: { thread: threadId, resource: resourceId },
        maxSteps: 10,
      });

      let chunkIndex = 0;
      const textBlockIds: { id: string; type: string; idx: number }[] = [];

      for await (const chunk of stream.fullStream) {
        const idx = chunkIndex++;

        // Track text-start and text-end IDs
        if ('payload' in chunk && chunk.payload) {
          const payload = chunk.payload as Record<string, unknown>;
          if ((chunk.type === 'text-start' || chunk.type === 'text-end') && payload.id) {
            textBlockIds.push({ id: payload.id as string, type: chunk.type, idx });
          }
        }

        if (chunk.type === 'text-delta') {
          textAccumulator += chunk.payload?.text || '';
        } else if (chunk.type === 'text-end' && textAccumulator.trim()) {
          streamOrder.push({ type: 'TEXT', content: textAccumulator.substring(0, 50) });
          textAccumulator = '';
        } else if (chunk.type === 'tool-call') {
          streamOrder.push({ type: 'TOOL', content: chunk.payload?.toolName });
        } else if (chunk.type === 'step-start') {
          streamOrder.push({ type: 'STEP' });
        }
      }

      // Analyze text block IDs for duplicates
      console.log('\n--- TEXT BLOCK ID ANALYSIS ---');
      console.log('Text IDs:', textBlockIds);

      const { textStartDuplicates, textEndDuplicates } = verifyNoTextIdDuplicates(textBlockIds);
      expect(textStartDuplicates, 'Duplicate text-start IDs detected').toHaveLength(0);
      expect(textEndDuplicates, 'Duplicate text-end IDs detected').toHaveLength(0);

      await delay(500);

      // === 2. RAW STORAGE ===
      const memoryStore = await memory.storage.getStore('memory');
      expect(memoryStore).toBeDefined();
      const rawResult = await memoryStore?.listMessages({ threadId, resourceId });
      const rawAssistant = rawResult.messages.filter((m: MastraDBMessage) => m.role === 'assistant');
      const rawStorageOrder: OrderEntry[] = [];
      for (const msg of rawAssistant) {
        rawStorageOrder.push(...extractOrder(msg.content.parts || []));
      }

      // === 3. RECALL ===
      const recallResult = await memory.recall({ threadId, resourceId });
      const recallAssistant = recallResult.messages.filter((m: MastraDBMessage) => m.role === 'assistant');
      const recallOrder: OrderEntry[] = [];
      for (const msg of recallAssistant) {
        recallOrder.push(...extractOrder(msg.content.parts || []));
      }

      // === 4. COMPARE ===
      compareOrders(streamOrder, rawStorageOrder, recallOrder);

      verifyTextBeforeTool(streamOrder, 'STREAM');
      verifyTextBeforeTool(rawStorageOrder, 'RAW STORAGE');
      verifyTextBeforeTool(recallOrder, 'RECALL');

      // Verify search tools were called
      const searchCalls = rawStorageOrder.filter(o => o.content === 'search');
      expect(searchCalls.length).toBeGreaterThanOrEqual(1);
    }, 120000);

    it('should match stream order exactly in storage', async () => {
      if (skipIfNoApiKey()) return;

      const memory = createMemory();
      const tools = createWeatherTools();

      const agent = new Agent({
        id: `exact-match-agent-${modelConfig.name}`,
        name: 'Exact Match Agent',
        instructions: `You are a weather assistant. When asked about weather, first explain what you will do, then get the current weather, explain what you found, then get the forecast, and finally summarize everything. Always be verbose between tool calls.`,
        model: modelConfig.model,
        memory,
        tools,
      });

      const threadId = randomUUID();
      const resourceId = 'exact-match-test';

      console.log('\n========================================');
      console.log(`TEST: Exact Stream-Storage Match (${modelConfig.name})`);
      console.log('========================================');

      // === STREAM ===
      const streamOrder: OrderEntry[] = [];
      let textAccumulator = '';

      const stream = await agent.stream("What's the weather in NYC?", {
        memory: { thread: threadId, resource: resourceId },
        maxSteps: 5,
      });

      let chunkIndex = 0;
      const textBlockIds: { id: string; type: string; idx: number }[] = [];

      for await (const chunk of stream.fullStream) {
        const idx = chunkIndex++;

        // Track text-start and text-end IDs
        if ('payload' in chunk && chunk.payload) {
          const payload = chunk.payload as Record<string, unknown>;
          if ((chunk.type === 'text-start' || chunk.type === 'text-end') && payload.id) {
            textBlockIds.push({ id: payload.id as string, type: chunk.type, idx });
          }
        }

        if (chunk.type === 'text-delta') {
          textAccumulator += chunk.payload?.text || '';
        } else if (chunk.type === 'text-end' && textAccumulator.trim()) {
          streamOrder.push({ type: 'TEXT', content: textAccumulator.substring(0, 50) });
          textAccumulator = '';
        } else if (chunk.type === 'tool-call') {
          streamOrder.push({ type: 'TOOL', content: chunk.payload?.toolName });
        } else if (chunk.type === 'step-start') {
          streamOrder.push({ type: 'STEP' });
        }
      }

      // Analyze text block IDs for duplicates
      console.log('\n--- TEXT BLOCK ID ANALYSIS ---');
      console.log('Text IDs:', textBlockIds);

      const { textStartDuplicates, textEndDuplicates } = verifyNoTextIdDuplicates(textBlockIds);
      expect(textStartDuplicates, 'Duplicate text-start IDs detected').toHaveLength(0);
      expect(textEndDuplicates, 'Duplicate text-end IDs detected').toHaveLength(0);

      await delay(500);

      // === RAW STORAGE ===
      const memoryStore = await memory.storage.getStore('memory');
      expect(memoryStore).toBeDefined();
      const rawResult = await memoryStore?.listMessages({ threadId, resourceId });
      const rawAssistant = rawResult.messages.filter((m: MastraDBMessage) => m.role === 'assistant');
      const rawStorageOrder: OrderEntry[] = [];
      for (const msg of rawAssistant) {
        rawStorageOrder.push(...extractOrder(msg.content.parts || []));
      }

      // === RECALL ===
      const recallResult = await memory.recall({ threadId, resourceId });
      const recallAssistant = recallResult.messages.filter((m: MastraDBMessage) => m.role === 'assistant');
      const recallOrder: OrderEntry[] = [];
      for (const msg of recallAssistant) {
        recallOrder.push(...extractOrder(msg.content.parts || []));
      }

      // === COMPARE ===
      const { rawVsRecall } = compareOrders(streamOrder, rawStorageOrder, recallOrder);

      // If stream had TEXT before TOOL, verify it's preserved
      const streamFirstText = streamOrder.findIndex(o => o.type === 'TEXT');
      const streamFirstTool = streamOrder.findIndex(o => o.type === 'TOOL');

      if (streamFirstText !== -1 && streamFirstTool !== -1 && streamFirstText < streamFirstTool) {
        console.log('\n🔍 Stream had TEXT before TOOL - this MUST be preserved');

        const rawFirstText = rawStorageOrder.findIndex(o => o.type === 'TEXT');
        const rawFirstTool = rawStorageOrder.findIndex(o => o.type === 'TOOL');

        if (rawFirstText === -1) {
          console.log('❌ BUG (Issue #9909): Text MISSING in raw storage!');
          expect.fail('Text that was streamed is missing from raw storage');
        } else if (rawFirstText >= rawFirstTool) {
          console.log('❌ BUG (Issue #9909): Text appears AFTER tool in raw storage!');
          expect(rawFirstText).toBeLessThan(rawFirstTool);
        }

        const recallFirstText = recallOrder.findIndex(o => o.type === 'TEXT');
        const recallFirstTool = recallOrder.findIndex(o => o.type === 'TOOL');

        if (recallFirstText === -1) {
          console.log('❌ BUG (Issue #9909): Text MISSING in recall!');
          expect.fail('Text that was streamed is missing from recall');
        } else if (recallFirstText >= recallFirstTool) {
          console.log('❌ BUG (Issue #9909): Text appears AFTER tool in recall!');
          expect(recallFirstText).toBeLessThan(recallFirstTool);
        }
      }

      // Raw and recall should always match
      expect(rawVsRecall).toBe(true);
    }, 90000);
  });
}
