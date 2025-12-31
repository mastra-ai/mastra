/**
 * Example: Async Buffering - MAXIMUM STRESS TEST
 *
 * This pushes async buffering to its limits:
 * - 40+ messages across multiple phases
 * - Timing comparison: buffered vs sync paths
 * - Multiple observation cycles
 * - Reflection triggering
 * - Detailed state tracking at each step
 *
 * Run with: npx tsx example-async-buffering-max.ts
 */

import { Agent } from '@mastra/core/agent';
import { InMemoryMemory } from '@mastra/core/storage';
import { MessageHistory } from '@mastra/memory';
import { ObservationalMemory } from './observational-memory';
import { TokenCounter } from './token-counter';

// ═══════════════════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════

const BUFFERING_CONFIG = {
  observer: {
    observationThreshold: 80, // Must observe at 80 tokens (LOW for testing!)
    bufferEvery: 40, // Start buffering at 40 tokens (50%)
  },
  reflector: {
    reflectionThreshold: 800, // Reflect at 800 tokens
    bufferEvery: 400, // Start reflection buffering at 400
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// SETUP
// ═══════════════════════════════════════════════════════════════════════════

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
  lastMessages: 40,
});

const om = new ObservationalMemory({
  storage,
  observer: {
    observationThreshold: BUFFERING_CONFIG.observer.observationThreshold,
    bufferEvery: BUFFERING_CONFIG.observer.bufferEvery,
    model: 'google/gemini-2.5-flash',
  },
  reflector: {
    reflectionThreshold: BUFFERING_CONFIG.reflector.reflectionThreshold,
    bufferEvery: BUFFERING_CONFIG.reflector.bufferEvery,
    model: 'google/gemini-2.5-flash',
  },
});

const agent = new Agent({
  id: 'buffering-stress-agent',
  name: 'Buffering Stress Test Agent',
  instructions: `You are a helpful assistant with excellent memory.

IMPORTANT: You have access to <observations> containing key facts about the user.
Use this information to provide personalized, context-aware responses.

Be concise but accurate. When asked about facts, cite specific details.`,
  model: 'google/gemini-2.5-flash',
  inputProcessors: [messageHistory, om],
  outputProcessors: [messageHistory, om],
});

const threadId = 'thread-buffering-stress';
const resourceId = 'user-stress-test';

// Tracking
interface MessageTiming {
  label: string;
  message: string;
  duration: number;
  path: 'fast' | 'wait' | 'sync' | 'normal';
  tokensAtStart: number;
  tokensAfter: number;
  observationTriggered: boolean;
  bufferedAvailable: boolean;
}

const timings: MessageTiming[] = [];
const tokenCounter = new TokenCounter();

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════

async function getState() {
  const record = await om.getRecord(threadId, resourceId);
  const messages = await storage.listMessages({ threadId, perPage: 100 });
  const msgTokens = tokenCounter.countMessages(messages.messages);

  // Debug: show message count and first few message contents
  console.log(`      [DEBUG] Messages in storage: ${messages.messages.length}`);

  return {
    msgTokens,
    msgCount: messages.messages.length,
    obsTokens: record?.observationTokenCount || 0,
    hasBufferedObs: !!record?.bufferedObservations,
    hasBufferedRef: !!record?.bufferedReflection,
    isObserving: record?.isObserving || false,
    isReflecting: record?.isReflecting || false,
    observedMsgCount: record?.observedMessageIds?.length || 0,
    bufferingMsgCount: record?.bufferingMessageIds?.length || 0,
    reflectionCount: record?.metadata?.reflectionCount || 0,
  };
}

async function chat(message: string, label: string): Promise<void> {
  const stateBefore = await getState();
  const start = Date.now();

  console.log(`\n📤 [${label}] "${message.slice(0, 70)}${message.length > 70 ? '...' : ''}"`);
  console.log(
    `   📊 Before: ${stateBefore.msgTokens} msg tokens, threshold=${BUFFERING_CONFIG.observer.observationThreshold}`,
  );

  await agent.generate(message, {
    memory: { thread: threadId, resource: resourceId },
  });

  const duration = Date.now() - start;
  const stateAfter = await getState();

  console.log(`   📊 After: ${stateAfter.msgTokens} msg tokens, ${stateAfter.obsTokens} obs tokens`);

  // Determine which path was taken
  let path: 'fast' | 'wait' | 'sync' | 'normal' = 'normal';
  const observationTriggered =
    stateAfter.obsTokens > stateBefore.obsTokens || stateAfter.observedMsgCount > stateBefore.observedMsgCount;

  if (observationTriggered) {
    if (stateBefore.hasBufferedObs) {
      path = 'fast'; // Had buffered content ready
    } else if (stateBefore.bufferingMsgCount > 0) {
      path = 'wait'; // Had to wait for buffering
    } else {
      path = 'sync'; // Fell back to sync
    }
  }

  const icon = path === 'fast' ? '⚡' : path === 'wait' ? '⏳' : path === 'sync' ? '🔄' : '✓';
  const pathLabel = path === 'fast' ? 'FAST SWAP' : path === 'wait' ? 'WAITED' : path === 'sync' ? 'SYNC' : '';

  console.log(`   ${icon} ${duration}ms ${pathLabel ? `(${pathLabel})` : ''}`);
  console.log(`   📊 Tokens: ${stateBefore.msgTokens} → ${stateAfter.msgTokens} msg, ${stateAfter.obsTokens} obs`);

  if (stateAfter.hasBufferedObs) {
    console.log(`   📦 Buffered observations ready!`);
  }
  if (stateAfter.hasBufferedRef) {
    console.log(`   📦 Buffered reflection ready!`);
  }

  timings.push({
    label,
    message,
    duration,
    path,
    tokensAtStart: stateBefore.msgTokens,
    tokensAfter: stateAfter.msgTokens,
    observationTriggered,
    bufferedAvailable: stateBefore.hasBufferedObs,
  });
}

async function showDetailedState(label: string) {
  const state = await getState();
  console.log(`\n${'─'.repeat(60)}`);
  console.log(`📊 STATE: ${label}`);
  console.log(`${'─'.repeat(60)}`);
  console.log(`   Message tokens:     ${state.msgTokens} / ${BUFFERING_CONFIG.observer.observationThreshold} threshold`);
  console.log(
    `   Observation tokens: ${state.obsTokens} / ${BUFFERING_CONFIG.reflector.reflectionThreshold} reflect threshold`,
  );
  console.log(`   Buffered obs:       ${state.hasBufferedObs ? '✅ READY' : '❌ none'}`);
  console.log(`   Buffered reflect:   ${state.hasBufferedRef ? '✅ READY' : '❌ none'}`);
  console.log(`   Is observing:       ${state.isObserving ? '🔄 YES' : 'no'}`);
  console.log(`   Observed messages:  ${state.observedMsgCount}`);
  console.log(`   Buffering messages: ${state.bufferingMsgCount}`);
  console.log(`   Reflections:        ${state.reflectionCount}`);

  // Progress bars
  const obsProgress = Math.min(100, Math.round((state.msgTokens / BUFFERING_CONFIG.observer.observationThreshold) * 100));
  const bufferProgress = Math.min(100, Math.round((state.msgTokens / BUFFERING_CONFIG.observer.bufferEvery) * 100));
  const reflectProgress = Math.min(
    100,
    Math.round((state.obsTokens / BUFFERING_CONFIG.reflector.reflectionThreshold) * 100),
  );

  console.log(
    `\n   Buffer trigger:  [${'█'.repeat(Math.floor(bufferProgress / 5))}${'░'.repeat(20 - Math.floor(bufferProgress / 5))}] ${bufferProgress}% (${BUFFERING_CONFIG.observer.bufferEvery} tokens)`,
  );
  console.log(
    `   Observe trigger: [${'█'.repeat(Math.floor(obsProgress / 5))}${'░'.repeat(20 - Math.floor(obsProgress / 5))}] ${obsProgress}% (${BUFFERING_CONFIG.observer.observationThreshold} tokens)`,
  );
  console.log(
    `   Reflect trigger: [${'█'.repeat(Math.floor(reflectProgress / 5))}${'░'.repeat(20 - Math.floor(reflectProgress / 5))}] ${reflectProgress}% (${BUFFERING_CONFIG.reflector.reflectionThreshold} tokens)`,
  );
}

async function waitForBuffering(seconds: number) {
  console.log(`\n⏳ Waiting ${seconds}s for background buffering...`);
  await new Promise(r => setTimeout(r, seconds * 1000));
  const state = await getState();
  if (state.hasBufferedObs) {
    console.log(`   ✅ Buffered observations now ready!`);
  }
  if (state.hasBufferedRef) {
    console.log(`   ✅ Buffered reflection now ready!`);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════════════

async function main() {
  console.log('═'.repeat(80));
  console.log('⚡ ASYNC BUFFERING - MAXIMUM STRESS TEST');
  console.log('═'.repeat(80));
  console.log(`\n📋 Configuration:`);
  console.log(
    `   Observer: bufferEvery=${BUFFERING_CONFIG.observer.bufferEvery}, threshold=${BUFFERING_CONFIG.observer.observationThreshold}`,
  );
  console.log(
    `   Reflector: bufferEvery=${BUFFERING_CONFIG.reflector.bufferEvery}, threshold=${BUFFERING_CONFIG.reflector.reflectionThreshold}`,
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // PHASE 1: Build up to buffer threshold (~40 tokens)
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('\n' + '▓'.repeat(80));
  console.log('📚 PHASE 1: Building to buffer threshold (40 tokens)');
  console.log(`   Buffer at: ${BUFFERING_CONFIG.observer.bufferEvery} tokens`);
  console.log(`   Observe at: ${BUFFERING_CONFIG.observer.observationThreshold} tokens`);
  console.log('▓'.repeat(80));

  await chat("Hi! I'm Morgan Chen, a 32-year-old product manager at Stripe.", '1.1');

  await chat('I lead the Payments Infrastructure team with 8 engineers reporting to me.', '1.2');

  // By now we should have ~40+ tokens, buffering should start
  await waitForBuffering(3);
  await showDetailedState('After Phase 1');

  // ═══════════════════════════════════════════════════════════════════════════
  // PHASE 2: Cross main threshold (should use buffered content!)
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('\n' + '▓'.repeat(80));
  console.log('📚 PHASE 2: Crossing main threshold (80 tokens)');
  console.log('   Expect: ⚡ FAST SWAP if buffered content is ready!');
  console.log('▓'.repeat(80));

  await chat("I live in San Francisco's Mission District with my partner Jamie.", '2.1');
  await showDetailedState('After 2.1');

  await chat('We have two cats: Pixel (gray tabby) and Debug (orange).', '2.2');
  await showDetailedState('After 2.2');

  await chat('Before Stripe, I was at Square for 3 years and Goldman Sachs for 2.', '2.3');
  await showDetailedState('After 2.3');

  // ═══════════════════════════════════════════════════════════════════════════
  // PHASE 3: Build up more content (second buffering cycle)
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('\n' + '▓'.repeat(80));
  console.log('📚 PHASE 3: Building more content (second buffering cycle)');
  console.log('▓'.repeat(80));

  await chat("I'm training for the NYC Marathon in November - my first marathon!", '3.1');
  await chat('I run 5 times a week: 3 easy runs, 1 tempo, 1 long run on Sundays.', '3.2');
  await chat('My current weekly mileage is 45 miles, building to 55 by race week.', '3.3');
  await chat('I also do yoga twice a week at CorePower in the Castro.', '3.4');

  await showDetailedState('After Phase 3');
  await waitForBuffering(3);

  // ═══════════════════════════════════════════════════════════════════════════
  // PHASE 4: More content (should trigger more observations)
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('\n' + '▓'.repeat(80));
  console.log('📚 PHASE 4: More personal details');
  console.log('▓'.repeat(80));

  await chat('My favorite restaurant is Tartine Manufactory for weekend brunch.', '4.1');
  await chat('I collect vintage synthesizers - have a Moog Model D and Roland Juno-60.', '4.2');
  await chat("I'm learning to produce electronic music using Ableton Live.", '4.3');
  await chat('My dream is to release an EP of ambient techno by end of year.', '4.4');

  await showDetailedState('After Phase 4');

  // ═══════════════════════════════════════════════════════════════════════════
  // PHASE 5: Work details (triggering more observations)
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('\n' + '▓'.repeat(80));
  console.log('📚 PHASE 5: Work details');
  console.log('▓'.repeat(80));

  await chat('Our team just launched Stripe Treasury - 6 months of intense work.', '5.1');
  await chat('My annual OKR is to reduce payment processing latency by 40%.', '5.2');
  await chat('I report to Claire, VP of Product. We have a 1:1 every Monday at 10am.', '5.3');
  await chat("I'm up for promotion to Senior Director in Q2 next year.", '5.4');

  await waitForBuffering(3);
  await showDetailedState('After Phase 5');

  // ═══════════════════════════════════════════════════════════════════════════
  // PHASE 6: Financial & Future (should be heavy on observations now)
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('\n' + '▓'.repeat(80));
  console.log('📚 PHASE 6: Financial & Future plans');
  console.log('▓'.repeat(80));

  await chat('My base salary is $280K with $150K in RSUs vesting over 4 years.', '6.1');
  await chat('Jamie and I are saving for a house - goal is $300K down payment by 2026.', '6.2');
  await chat("We're considering moving to Portland for better cost of living.", '6.3');
  await chat("My parents live in Fremont - dad's an engineer at Intel, mom teaches.", '6.4');
  await chat('My younger sister Amy just started medical school at UCSF.', '6.5');

  await waitForBuffering(3);
  await showDetailedState('After Phase 6');

  // ═══════════════════════════════════════════════════════════════════════════
  // SHOW OBSERVATIONS
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('\n' + '═'.repeat(80));
  console.log('📝 CURRENT OBSERVATIONS');
  console.log('═'.repeat(80));

  const observations = await om.getObservations(threadId, resourceId);
  if (observations) {
    console.log(`\nLength: ${observations.length} chars`);
    console.log('\n' + '-'.repeat(60));
    console.log(observations.slice(0, 3000));
    if (observations.length > 3000) {
      console.log(`\n... (${observations.length - 3000} more chars)`);
    }
    console.log('-'.repeat(60));
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // RECALL TESTS
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('\n' + '═'.repeat(80));
  console.log('🧪 RECALL TESTS');
  console.log('═'.repeat(80));

  await chat('What is my job title and who do I report to?', 'R1');
  await chat("What are my cats' names and where do I do yoga?", 'R2');
  await chat('What marathon am I training for and what is my weekly mileage?', 'R3');
  await chat('What synthesizers do I own and what music software do I use?', 'R4');
  await chat('Give me a full summary of everything you know about me.', 'R5');

  // ═══════════════════════════════════════════════════════════════════════════
  // TIMING ANALYSIS
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('\n' + '═'.repeat(80));
  console.log('⏱️ TIMING ANALYSIS');
  console.log('═'.repeat(80));

  const fastPaths = timings.filter(t => t.path === 'fast');
  const waitPaths = timings.filter(t => t.path === 'wait');
  const syncPaths = timings.filter(t => t.path === 'sync');
  const normalPaths = timings.filter(t => t.path === 'normal');
  const observationTriggers = timings.filter(t => t.observationTriggered);

  console.log('\n📊 Path Distribution:');
  console.log(`   ⚡ Fast swap (buffered ready):  ${fastPaths.length}`);
  console.log(`   ⏳ Wait (buffering in progress): ${waitPaths.length}`);
  console.log(`   🔄 Sync (no buffering):          ${syncPaths.length}`);
  console.log(`   ✓ Normal (no observation):      ${normalPaths.length}`);
  console.log(`   📝 Observations triggered:       ${observationTriggers.length}`);

  console.log('\n⏱️ Timing by Path:');
  if (fastPaths.length > 0) {
    const avgFast = Math.round(fastPaths.reduce((s, t) => s + t.duration, 0) / fastPaths.length);
    console.log(`   ⚡ Fast swap avg:    ${avgFast}ms`);
  }
  if (waitPaths.length > 0) {
    const avgWait = Math.round(waitPaths.reduce((s, t) => s + t.duration, 0) / waitPaths.length);
    console.log(`   ⏳ Wait avg:         ${avgWait}ms`);
  }
  if (syncPaths.length > 0) {
    const avgSync = Math.round(syncPaths.reduce((s, t) => s + t.duration, 0) / syncPaths.length);
    console.log(`   🔄 Sync avg:         ${avgSync}ms`);
  }
  if (normalPaths.length > 0) {
    const avgNormal = Math.round(normalPaths.reduce((s, t) => s + t.duration, 0) / normalPaths.length);
    console.log(`   ✓ Normal avg:       ${avgNormal}ms`);
  }

  console.log('\n📋 All Message Timings:');
  for (const t of timings) {
    const icon = t.path === 'fast' ? '⚡' : t.path === 'wait' ? '⏳' : t.path === 'sync' ? '🔄' : '✓';
    const obs = t.observationTriggered ? ' [OBS]' : '';
    const buf = t.bufferedAvailable ? ' [BUF]' : '';
    console.log(`   ${icon} [${t.label}] ${t.duration}ms${obs}${buf} (${t.tokensAtStart}→${t.tokensAfter} tokens)`);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // FACT CHECK
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('\n' + '═'.repeat(80));
  console.log('📋 FACT CHECK');
  console.log('═'.repeat(80));

  // Get all recall responses
  const recallResponses = timings.filter(t => t.label.startsWith('R'));
  // We need to re-run to get actual text... for now, skip detailed fact check
  // In production, you'd store the response text

  const state = await getState();
  console.log(`\n   Observations captured: ${state.obsTokens} tokens`);
  console.log(`   Reflections: ${state.reflectionCount}`);

  // ═══════════════════════════════════════════════════════════════════════════
  // FINAL SUMMARY
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('\n' + '═'.repeat(80));
  console.log('📊 FINAL SUMMARY');
  console.log('═'.repeat(80));

  const totalDuration = timings.reduce((s, t) => s + t.duration, 0);
  const avgDuration = Math.round(totalDuration / timings.length);

  console.log(`\n   Total messages: ${timings.length}`);
  console.log(`   Total time: ${totalDuration}ms`);
  console.log(`   Average per message: ${avgDuration}ms`);
  console.log(`   Observation tokens: ${state.obsTokens}`);
  console.log(`   Reflections: ${state.reflectionCount}`);

  console.log('\n   🎯 ASYNC BUFFERING RESULTS:');

  if (fastPaths.length > 0) {
    const avgFast = Math.round(fastPaths.reduce((s, t) => s + t.duration, 0) / fastPaths.length);
    const avgSync =
      syncPaths.length > 0 ? Math.round(syncPaths.reduce((s, t) => s + t.duration, 0) / syncPaths.length) : avgDuration;
    const speedup = Math.round((avgSync / avgFast) * 10) / 10;

    console.log(`      ⚡ Fast path used ${fastPaths.length} times`);
    console.log(`      ⚡ Fast path avg: ${avgFast}ms vs sync: ${avgSync}ms`);
    console.log(`      ⚡ Speedup: ${speedup}x faster!`);
    console.log('\n   ✅ Async buffering is working! Proactive observation pays off.');
  } else if (syncPaths.length > 0) {
    console.log('      ⚠️ All observations used sync path');
    console.log('      💡 Try increasing bufferEvery wait time');
  } else {
    console.log('      ℹ️ No observations triggered yet');
  }

  console.log('\n' + '═'.repeat(80));
}

main().catch(console.error);
