/**
 * Example: Async Buffering in Observational Memory
 *
 * This demonstrates the non-blocking buffering feature:
 * - bufferEvery triggers proactive observation in the background
 * - When threshold is hit, buffered content is instantly swapped (fast path)
 * - No blocking during normal conversation flow
 *
 * Run with: npx tsx example-async-buffering.ts
 */

import { Agent } from '@mastra/core/agent';
import { InMemoryMemory } from '@mastra/core/storage';
import { MessageHistory } from '@mastra/memory';
import { ObservationalMemory } from './observational-memory';
import { TokenCounter } from './token-counter';

// Create storage
const storage = new InMemoryMemory({
  collection: {
    threads: new Map(),
    resources: new Map(),
    messages: new Map(),
    observationalMemory: new Map(),
  },
  operations: {} as any,
});

const messageHistory = new MessageHistory({
  storage,
  lastMessages: 30,
});

// Create OM with async buffering enabled
const om = new ObservationalMemory({
  storage,
  observer: {
    observationThreshold: 300, // Main threshold - must observe at this point
    bufferEvery: 150, // Start buffering at 150 tokens (proactive!)
    model: 'google/gemini-2.5-flash',
  },
  reflector: {
    reflectionThreshold: 2000,
    bufferEvery: 1000, // Start reflection buffering at 1000 tokens
    model: 'google/gemini-2.5-flash',
  },
});

const agent = new Agent({
  id: 'buffering-test-agent',
  name: 'Buffering Test Agent',
  instructions: `You are a helpful assistant with excellent memory.

IMPORTANT: You have access to <observational_memory> containing key facts about the user.
Use this to provide personalized responses.`,
  model: 'google/gemini-2.5-flash',
  inputProcessors: [messageHistory, om],
  outputProcessors: [messageHistory, om],
});

const threadId = 'thread-buffering-test';
const resourceId = 'user-buffering';

// Track timing
const timings: { label: string; duration: number; buffered: boolean }[] = [];

async function chat(message: string, label: string) {
  const start = Date.now();

  console.log(`\n📤 [${label}] "${message.slice(0, 60)}${message.length > 60 ? '...' : ''}"`);

  const response = await agent.generate(message, {
    memory: { thread: threadId, resource: resourceId },
  });

  const duration = Date.now() - start;

  // Check if buffered content was used
  const record = await om.getRecord(threadId, resourceId);
  const wasBuffered = !record?.bufferedObservations; // If no buffered left, it was activated

  timings.push({ label, duration, buffered: wasBuffered });

  console.log(`📥 [${label}] (${duration}ms) "${response.text.slice(0, 80)}..."`);

  return response;
}

async function showState(label: string) {
  const record = await om.getRecord(threadId, resourceId);
  const tokenCounter = new TokenCounter();

  // Get current messages
  const messages = await storage.listMessages({ threadId, perPage: 100 });
  const msgTokens = tokenCounter.countMessages(messages.messages);

  console.log(`\n📊 [${label}] State:`);
  console.log(`   Message tokens: ${msgTokens}`);
  console.log(`   Observation tokens: ${record?.observationTokenCount || 0}`);
  console.log(
    `   Buffered observations: ${record?.bufferedObservations ? 'YES (' + record.bufferedObservations.length + ' chars)' : 'NO'}`,
  );
  console.log(`   Buffered reflection: ${record?.bufferedReflection ? 'YES' : 'NO'}`);
  console.log(`   Is observing: ${record?.isObserving || false}`);
  console.log(`   Observed message IDs: ${record?.observedMessageIds?.length || 0}`);
  console.log(`   Buffering message IDs: ${record?.bufferingMessageIds?.length || 0}`);
}

async function main() {
  console.log('═'.repeat(80));
  console.log('⚡ ASYNC BUFFERING DEMO');
  console.log('   bufferEvery: 150 tokens | observationThreshold: 300 tokens');
  console.log('═'.repeat(80));

  // ═══════════════════════════════════════════════════════════════════════════
  // PHASE 1: Build up context (should trigger buffering at ~150 tokens)
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('\n' + '▓'.repeat(80));
  console.log('📚 PHASE 1: Building context (expecting buffering to start at ~150 tokens)');
  console.log('▓'.repeat(80));

  await chat("Hi! I'm Alex and I work at Vercel as a DevRel engineer.", '1.1');
  await showState('After 1.1');

  await chat('I specialize in Next.js and Edge computing. Been at Vercel for 2 years.', '1.2');
  await showState('After 1.2');

  await chat("I live in Brooklyn with my cat named Pixel. She's a gray tabby.", '1.3');
  await showState('After 1.3');

  // By now we should have ~150 tokens and buffering should have started
  console.log('\n⏳ Waiting 2s for background buffering to complete...');
  await new Promise(r => setTimeout(r, 2000));

  await showState('After wait');

  // ═══════════════════════════════════════════════════════════════════════════
  // PHASE 2: Trigger main threshold (should use buffered content = FAST!)
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('\n' + '▓'.repeat(80));
  console.log('📚 PHASE 2: Crossing main threshold (should be FAST if buffering worked!)');
  console.log('▓'.repeat(80));

  await chat('I also play guitar and do photography on weekends.', '2.1');
  await showState('After 2.1');

  await chat('My favorite coffee shop is Devocion in Williamsburg.', '2.2');
  await showState('After 2.2');

  // ═══════════════════════════════════════════════════════════════════════════
  // PHASE 3: More content (should trigger buffering again)
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('\n' + '▓'.repeat(80));
  console.log('📚 PHASE 3: Adding more content');
  console.log('▓'.repeat(80));

  await chat("I'm planning to speak at Next.js Conf this year about ISR optimizations.", '3.1');
  await showState('After 3.1');

  await chat('My team just shipped a major feature - Edge Middleware v2.', '3.2');
  await showState('After 3.2');

  // ═══════════════════════════════════════════════════════════════════════════
  // RECALL TEST
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('\n' + '═'.repeat(80));
  console.log('🧪 RECALL TEST');
  console.log('═'.repeat(80));

  await chat('What do you remember about my job and hobbies?', 'R1');
  await chat("What's my cat's name and where do I get coffee?", 'R2');

  // ═══════════════════════════════════════════════════════════════════════════
  // TIMING ANALYSIS
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('\n' + '═'.repeat(80));
  console.log('⏱️ TIMING ANALYSIS');
  console.log('═'.repeat(80));

  console.log('\nResponse times:');
  for (const { label, duration, buffered } of timings) {
    const icon = duration < 2000 ? '⚡' : duration < 5000 ? '✓' : '🐢';
    console.log(`   ${icon} [${label}] ${duration}ms ${buffered ? '(used buffered content)' : ''}`);
  }

  const avgDuration = timings.reduce((sum, t) => sum + t.duration, 0) / timings.length;
  console.log(`\n   Average: ${Math.round(avgDuration)}ms`);

  // ═══════════════════════════════════════════════════════════════════════════
  // OBSERVATIONS
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('\n' + '═'.repeat(80));
  console.log('📝 FINAL OBSERVATIONS');
  console.log('═'.repeat(80));

  const observations = await om.getObservations(threadId, resourceId);
  if (observations) {
    console.log(observations.slice(0, 2000));
    if (observations.length > 2000) {
      console.log(`\n... (${observations.length - 2000} more chars)`);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SUMMARY
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('\n' + '═'.repeat(80));
  console.log('📊 SUMMARY');
  console.log('═'.repeat(80));

  const record = await om.getRecord(threadId, resourceId);
  console.log(`\n   Observation tokens: ${record?.observationTokenCount || 0}`);
  console.log(`   Reflections: ${record?.metadata.reflectionCount || 0}`);
  console.log(`   Total messages: ${timings.length}`);

  console.log('\n   🎯 ASYNC BUFFERING BENEFITS:');
  console.log('      • Proactive observation at bufferEvery threshold');
  console.log('      • Instant swap when main threshold hit (fast path)');
  console.log('      • No conversation blocking during observation');
  console.log('      • Background processing while user types');

  console.log('\n' + '═'.repeat(80));
}

main().catch(console.error);
