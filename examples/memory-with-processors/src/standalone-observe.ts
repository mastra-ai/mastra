/**
 * Example: Standalone observe() API
 *
 * This demonstrates using ObservationalMemory directly (without the Memory wrapper)
 * to manually observe messages, retrieve observations, and inject them into a system prompt.
 *
 * The standalone API is useful when:
 * - You're building a plugin (like @mastra/opencode) that intercepts messages
 * - You have a custom chat loop and want control over when observation happens
 * - You're working outside the Mastra agent pipeline
 *
 * Run with: pnpm observe
 */

import 'dotenv/config';
import { openai } from '@ai-sdk/openai';
import { Agent } from '@mastra/core/agent';
import type { MastraDBMessage } from '@mastra/core/agent';
import { LibSQLStore } from '@mastra/libsql';
import {
  ObservationalMemory,
  optimizeObservationsForContext,
  OBSERVATION_CONTEXT_PROMPT,
  OBSERVATION_CONTEXT_INSTRUCTIONS,
  OBSERVATION_CONTINUATION_HINT,
} from '@mastra/memory/processors';
import chalk from 'chalk';

// ─── Storage ────────────────────────────────────────────────────────

const store = new LibSQLStore({
  id: 'standalone-observe-example',
  url: 'file:standalone-observe-example.db',
});

// ─── Agent (no memory attached — we manage observation ourselves) ──

const agent = new Agent({
  id: 'standalone-observe-example',
  name: 'Standalone Observe Example',
  instructions: 'You are a helpful assistant.',
  model: openai('gpt-4o-mini'),
});

// ─── Helpers ────────────────────────────────────────────────────────

function makeMessage(role: 'user' | 'assistant', text: string, createdAt: Date = new Date()): MastraDBMessage {
  return {
    id: crypto.randomUUID(),
    role,
    content: {
      format: 2,
      parts: [{ type: 'text' as const, text }],
    },
    type: 'text',
    createdAt,
  };
}

// ─── Main ───────────────────────────────────────────────────────────

async function main() {
  console.log(
    chalk.cyan(`
╔══════════════════════════════════════════════════════════╗
║                                                          ║
║  STANDALONE OBSERVE() API DEMO                           ║
║                                                          ║
║  Demonstrates using ObservationalMemory directly         ║
║  to observe messages and inject context into prompts.    ║
║                                                          ║
╚══════════════════════════════════════════════════════════╝
`),
  );

  // Initialize storage (creates tables)
  await store.init();
  const storage = await store.getStore('memory');

  // Create ObservationalMemory instance
  const om = new ObservationalMemory({
    storage: storage!,
    scope: 'thread', // observe per-thread (vs "resource" which groups threads)
    observation: {
      model: openai('gpt-4o-mini'),
      messageTokens: 50, // low threshold so observation triggers easily in this demo
      bufferTokens: false, // standalone observe() is always synchronous, no buffering
    },
    reflection: {
      observationTokens: 5000,
    },
  });

  const threadId = 'observe-demo-thread';

  // Simulate a conversation
  const messages: MastraDBMessage[] = [
    makeMessage('user', "Hey, I'm working on a TypeScript project using Mastra."),
    makeMessage('assistant', 'That sounds great! Mastra is a modular AI framework. What are you building with it?'),
    makeMessage(
      'user',
      "I'm building a coding assistant that uses observational memory to remember context across long sessions. I'm using the standalone observe() API so I can control exactly when observations happen.",
    ),
    makeMessage(
      'assistant',
      'The standalone observe() API gives you fine-grained control. You call om.observe() with the threadId and messages, and it extracts observations when the token threshold is met. Then you can retrieve those observations and inject them into the system prompt yourself.',
    ),
    makeMessage(
      'user',
      'Exactly. I also want reflection to condense observations when they grow too large. My stack is TypeScript, LibSQL for storage, and GPT-4o-mini for the observer/reflector models.',
    ),
    makeMessage(
      'assistant',
      'Good setup. The reflection step will automatically trigger when your accumulated observation tokens exceed the observationTokens threshold. It merges and prioritizes observations so the most relevant ones stay in context.',
    ),
  ];

  // ─── Step 1: Run observation ────────────────────────────────────

  console.log(chalk.yellow(`\n📝 Calling om.observe() with ${messages.length} messages...\n`));

  await om.observe({
    threadId,
    messages,
    hooks: {
      onObservationStart: () => console.log(chalk.green('  → Observation started...')),
      onObservationEnd: () => console.log(chalk.green('  → Observation complete.')),
      onReflectionStart: () => console.log(chalk.green('  → Reflection started...')),
      onReflectionEnd: () => console.log(chalk.green('  → Reflection complete.')),
    },
  });

  // ─── Step 2: Retrieve observations ──────────────────────────────

  const record = await om.getRecord(threadId);
  const observations = record?.activeObservations;

  console.log(chalk.yellow('\n📊 Record Status:\n'));
  console.log(`  ${chalk.yellow('├')} Thread ID: ${threadId}`);
  console.log(`  ${chalk.yellow('├')} Has record: ${!!record}`);
  console.log(`  ${chalk.yellow('├')} Last observed at: ${record?.lastObservedAt ?? 'never'}`);
  console.log(`  ${chalk.yellow('├')} Pending message tokens: ${record?.pendingMessageTokens ?? 0}`);
  console.log(`  ${chalk.yellow('├')} Observation tokens: ${record?.observationTokenCount ?? 0}`);
  console.log(`  ${chalk.yellow('├')} Total tokens observed: ${record?.totalTokensObserved ?? 0}`);
  console.log(`  ${chalk.yellow('├')} Generation count: ${record?.generationCount ?? 0}`);
  console.log(`  ${chalk.yellow('└')} Has observations: ${!!observations}`);

  if (observations) {
    console.log(chalk.yellow('\n🔍 Active Observations:\n'));
    console.log(chalk.dim(observations));
  } else {
    console.log(chalk.dim('\n  (No observations yet — threshold may not have been met)'));
  }

  // ─── Step 3: Build enriched system prompt ───────────────────────

  let systemPrompt = 'You are a helpful assistant.';

  if (observations) {
    const optimized = optimizeObservationsForContext(observations);

    if (optimized) {
      systemPrompt = [
        systemPrompt,
        '',
        OBSERVATION_CONTEXT_PROMPT,
        '',
        '<observations>',
        optimized,
        '</observations>',
        '',
        OBSERVATION_CONTEXT_INSTRUCTIONS,
        '',
        OBSERVATION_CONTINUATION_HINT,
      ].join('\n');
    }
  }

  console.log(chalk.yellow('\n📋 Enriched System Prompt:\n'));
  console.log(chalk.dim(systemPrompt));

  // ─── Step 4: Generate a response using the enriched prompt ──────

  console.log(chalk.yellow('\n🤖 Generating response with enriched context...\n'));

  const response = await agent.generate([{ role: 'user', content: 'What tech stack am I using?' }], {
    instructions: systemPrompt,
  });

  console.log(`  ${chalk.blue('Agent:')} ${response.text}`);

  console.log(
    chalk.cyan(`
═══════════════════════════════════════════════════════════
  DEMO COMPLETE

  The standalone observe() API allows you to:
  1. Call om.observe() with a threadId and messages
  2. Retrieve observations via om.getRecord()
  3. Optimize observations with optimizeObservationsForContext()
  4. Inject them into the system prompt
  5. Use the enriched prompt when generating responses

  This is the same pattern used by @mastra/opencode.
═══════════════════════════════════════════════════════════
`),
  );
}

main().catch(console.error);
