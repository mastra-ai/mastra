/**
 * Debug example to trace exactly what OM is doing
 *
 * Run with: npx tsx example-debug.ts
 */

import { Agent } from '@mastra/core/agent';
import { InMemoryMemory } from '@mastra/core/storage';
import { MessageHistory } from '@mastra/memory';
import { ObservationalMemory } from './observational-memory';

// Create shared storage for both Memory and OM
const storage = new InMemoryMemory({
  collection: {
    threads: new Map(),
    resources: new Map(),
    messages: new Map(),
    observationalMemory: new Map(),
  },
  operations: {} as any,
});

const customMessageHistory = new MessageHistory({
  storage,
  lastMessages: 20,
});

// Create OM that uses the same storage
const om = new ObservationalMemory({
  storage,
  observer: {
    historyThreshold: 100, // VERY low - trigger after ~2 exchanges
    model: 'google/gemini-2.5-flash',
  },
  reflector: {
    observationThreshold: 500, // Very low - trigger reflection quickly
    model: 'google/gemini-2.5-flash',
  },
});

// Agent needs BOTH Memory (for persistence) and OM processors (for observations)
const agent = new Agent({
  id: 'debug-agent',
  name: 'Debug Agent',
  instructions: `You are a helpful assistant.

IMPORTANT: You may receive an <observational_memory> section containing observations about 
the user. Use this information when answering questions about the user.`,
  model: 'google/gemini-2.5-flash',
  inputProcessors: [
    customMessageHistory, // Load previous messages
    om, // Inject observations
  ],
  outputProcessors: [
    customMessageHistory, // Save new messages
    om, // Track messages & trigger observer
  ],
});

const threadId = 'debug-thread';
const resourceId = 'debug-user';

// Helper to generate with memory options and show state
async function chat(message: string, label: string) {
  console.log(`\n📤 [${label}] User: "${message}"`);

  const response = await agent.generate(message, {
    memory: { thread: threadId, resource: resourceId },
  });

  console.log(`📥 [${label}] Agent: "${response.text.slice(0, 100)}..."`);

  // Show OM state after each exchange
  const record = await om.getRecord(threadId, resourceId);
  console.log(`📊 [${label}] OM State:`);
  console.log(`   - Has observations: ${record?.activeObservations ? 'YES ✅' : 'NO'}`);
  console.log(`   - Observed msg IDs: ${record?.observedMessageIds.length || 0}`);
  console.log(`   - Observation tokens: ${record?.observationTokenCount || 0}`);
  console.log(`   - Generation: ${record?.generationNumber || 0}`);

  return response;
}

async function main() {
  console.log('═'.repeat(70));
  console.log('🧪 OBSERVATIONAL MEMORY - COMPREHENSIVE TEST');
  console.log(`   historyThreshold: 100 tokens (trigger observation)`);
  console.log(`   observationThreshold: 500 tokens (trigger reflection)`);
  console.log('═'.repeat(70));

  // ═══════════════════════════════════════════════════════════════════
  // PHASE 1: Personal info
  // ═══════════════════════════════════════════════════════════════════
  console.log('\n' + '─'.repeat(70));
  console.log('📌 PHASE 1: Personal Information');
  console.log('─'.repeat(70));

  await chat('My name is Alice Chen and I work at TechCorp as a senior software engineer.', '1.1');
  await chat('I have a golden retriever named Max and a cat named Whiskers.', '1.2');
  await chat('I live in San Francisco, in the Mission District.', '1.3');

  // ═══════════════════════════════════════════════════════════════════
  // PHASE 2: Work details (should trigger more observations)
  // ═══════════════════════════════════════════════════════════════════
  console.log('\n' + '─'.repeat(70));
  console.log('📌 PHASE 2: Work Details');
  console.log('─'.repeat(70));

  await chat('At TechCorp I lead a team of 5 engineers building a payments platform.', '2.1');
  await chat('My favorite programming languages are TypeScript and Rust.', '2.2');
  await chat('I use VS Code with the Dracula theme and vim keybindings.', '2.3');

  // ═══════════════════════════════════════════════════════════════════
  // PHASE 3: Hobbies (push toward reflection threshold)
  // ═══════════════════════════════════════════════════════════════════
  console.log('\n' + '─'.repeat(70));
  console.log('📌 PHASE 3: Hobbies & Preferences');
  console.log('─'.repeat(70));

  await chat('On weekends I love hiking in Marin County, especially Mount Tam.', '3.1');
  await chat('I read a lot of sci-fi - my favorite author is Ursula K. Le Guin.', '3.2');
  await chat("I'm training for the SF Marathon in July. Currently running 30 miles per week.", '3.3');
  await chat('For coffee, I always order a cortado with oat milk.', '3.4');

  // ═══════════════════════════════════════════════════════════════════
  // Show current state
  // ═══════════════════════════════════════════════════════════════════
  console.log('\n' + '═'.repeat(70));
  console.log('📊 CURRENT OM STATE');
  console.log('═'.repeat(70));

  const record = await om.getRecord(threadId, resourceId);
  console.log(`   Observed message IDs: ${record?.observedMessageIds.length || 0}`);
  console.log(`   Observation tokens: ${record?.observationTokenCount || 0}`);
  console.log(
    `   Generation: ${record?.generationNumber || 0} ${record?.generationNumber ? '(reflection occurred!)' : ''}`,
  );

  const observations = await om.getObservations(threadId, resourceId);
  if (observations) {
    console.log('\n📝 OBSERVATIONS:');
    console.log('─'.repeat(70));
    console.log(observations);
    console.log('─'.repeat(70));
  }

  // ═══════════════════════════════════════════════════════════════════
  // RECALL TESTS
  // ═══════════════════════════════════════════════════════════════════
  console.log('\n' + '═'.repeat(70));
  console.log('🧪 RECALL TESTS');
  console.log('═'.repeat(70));

  // Test 1: Basic recall
  console.log('\n--- Test 1: Basic Identity ---');
  const r1 = await chat('What is my full name and where do I work?', 'R1');

  // Test 2: Specific details
  console.log('\n--- Test 2: Specific Details ---');
  const r2 = await chat('What are my pets names?', 'R2');

  // Test 3: Work details
  console.log('\n--- Test 3: Work Details ---');
  const r3 = await chat('What programming languages do I prefer and what editor do I use?', 'R3');

  // Test 4: Hobbies
  console.log('\n--- Test 4: Hobbies ---');
  const r4 = await chat('What are my hobbies and what marathon am I training for?', 'R4');

  // Test 5: Comprehensive
  console.log('\n--- Test 5: Comprehensive Summary ---');
  const r5 = await chat('Give me a complete summary of everything you know about me.', 'R5');

  // ═══════════════════════════════════════════════════════════════════
  // RESULTS
  // ═══════════════════════════════════════════════════════════════════
  console.log('\n' + '═'.repeat(70));
  console.log('📋 FINAL RESULTS');
  console.log('═'.repeat(70));

  const allResponses = [r1, r2, r3, r4, r5].map(r => r.text.toLowerCase()).join(' ');

  const facts = [
    { key: 'Alice Chen', found: allResponses.includes('alice') },
    { key: 'TechCorp', found: allResponses.includes('techcorp') },
    { key: 'Max (dog)', found: allResponses.includes('max') },
    { key: 'Whiskers (cat)', found: allResponses.includes('whiskers') },
    { key: 'San Francisco', found: allResponses.includes('san francisco') || allResponses.includes('sf') },
    { key: 'TypeScript', found: allResponses.includes('typescript') },
    { key: 'Rust', found: allResponses.includes('rust') },
    { key: 'VS Code', found: allResponses.includes('vs code') || allResponses.includes('vscode') },
    { key: 'Mount Tam', found: allResponses.includes('tam') || allResponses.includes('marin') },
    { key: 'Ursula K. Le Guin', found: allResponses.includes('le guin') || allResponses.includes('ursula') },
    { key: 'SF Marathon', found: allResponses.includes('marathon') },
    { key: 'Cortado', found: allResponses.includes('cortado') },
  ];

  let passed = 0;
  for (const { key, found } of facts) {
    console.log(`   ${found ? '✅' : '❌'} ${key}`);
    if (found) passed++;
  }

  const pct = Math.round((passed / facts.length) * 100);
  console.log(`\n   Score: ${passed}/${facts.length} (${pct}%)`);

  if (pct === 100) {
    console.log('\n🎉 PERFECT RECALL!');
  } else if (pct >= 80) {
    console.log('\n✨ EXCELLENT RECALL!');
  } else if (pct >= 60) {
    console.log('\n👍 GOOD RECALL');
  } else {
    console.log('\n⚠️ NEEDS IMPROVEMENT');
  }

  // Final state
  const finalRecord = await om.getRecord(threadId, resourceId);
  console.log('\n📊 FINAL OM STATS:');
  console.log(`   - Total observed messages: ${finalRecord?.observedMessageIds.length || 0}`);
  console.log(`   - Final observation tokens: ${finalRecord?.observationTokenCount || 0}`);
  console.log(`   - Reflection generations: ${finalRecord?.generationNumber || 0}`);
}

main().catch(console.error);
