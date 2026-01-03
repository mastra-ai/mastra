/**
 * Example: Resource-Scoped Observational Memory
 *
 * This demonstrates how OM can share observations across multiple threads
 * for the same user/resource. Facts learned in Thread A are available in Thread B.
 *
 * Run with: npx tsx example-resource-scope.ts
 */

import { Agent } from '@mastra/core/agent';
import { InMemoryMemory } from '@mastra/core/storage';
import { MessageHistory } from '@mastra/memory';
import { ObservationalMemory } from './observational-memory';

// Create shared storage
const storage = new InMemoryMemory({
  collection: {
    threads: new Map(),
    resources: new Map(),
    messages: new Map(),
    observationalMemory: new Map(),
  },
  operations: {} as any,
});

// Create MessageHistory for message persistence
const messageHistory = new MessageHistory({
  storage,
  lastMessages: 20,
});

// Create OM with RESOURCE SCOPE - observations shared across threads!
const om = new ObservationalMemory({
  storage,
  scope: 'resource', // 🔑 This enables cross-thread memory!
  observer: {
    observationThreshold: 100,
    model: 'google/gemini-2.5-flash',
  },
  reflector: {
    reflectionThreshold: 2000,
    model: 'google/gemini-2.5-flash',
  },
});

const agent = new Agent({
  id: 'resource-scope-agent',
  name: 'Resource Scope Agent',
  instructions: `You are a helpful assistant with excellent memory across conversations.

IMPORTANT: You may receive an <observations> section containing observations 
about the user from ALL their conversations (not just this one). Use this information 
to provide personalized, context-aware responses.

When you see observations labeled with "Thread: xxx", those are from different 
conversations with the same user.`,
  model: 'google/gemini-2.5-flash',
  inputProcessors: [messageHistory, om],
  outputProcessors: [messageHistory, om],
});

// Same user, different thread IDs
const resourceId = 'user-alice';
const thread1 = 'thread-work';
const thread2 = 'thread-personal';
const thread3 = 'thread-followup';

async function chatInThread(threadId: string, message: string, label: string) {
  console.log(`\n📤 [${label}] User: "${message}"`);
  const response = await agent.generate(message, {
    memory: { thread: threadId, resource: resourceId },
  });
  console.log(`📥 [${label}] Agent: "${response.text.slice(0, 150)}..."`);
  return response;
}

async function main() {
  console.log('═'.repeat(70));
  console.log('🔗 RESOURCE-SCOPED OBSERVATIONAL MEMORY');
  console.log('   Observations shared across multiple threads for same user');
  console.log('═'.repeat(70));

  // ═══════════════════════════════════════════════════════════════════
  // THREAD 1: Work-related conversation
  // ═══════════════════════════════════════════════════════════════════
  console.log('\n' + '─'.repeat(70));
  console.log(`📌 THREAD 1: Work Conversation (${thread1})`);
  console.log('─'.repeat(70));

  await chatInThread(thread1, "Hi! I'm Alice and I work at TechCorp as a software engineer.", 'T1.1');
  await chatInThread(thread1, 'I lead a team of 5 engineers building a payments platform.', 'T1.2');
  await chatInThread(thread1, 'Our tech stack is TypeScript, Node.js, and PostgreSQL.', 'T1.3');

  // ═══════════════════════════════════════════════════════════════════
  // THREAD 2: Personal conversation (different topic, same user)
  // ═══════════════════════════════════════════════════════════════════
  console.log('\n' + '─'.repeat(70));
  console.log(`📌 THREAD 2: Personal Conversation (${thread2})`);
  console.log('─'.repeat(70));

  await chatInThread(thread2, 'I have a golden retriever named Max.', 'T2.1');
  await chatInThread(thread2, 'I love hiking - my favorite trail is Mount Tam.', 'T2.2');
  await chatInThread(thread2, "I'm training for the SF Marathon in July.", 'T2.3');

  // ═══════════════════════════════════════════════════════════════════
  // Show observations (should include facts from BOTH threads)
  // ═══════════════════════════════════════════════════════════════════
  console.log('\n' + '═'.repeat(70));
  console.log('📊 OBSERVATIONS (shared across threads)');
  console.log('═'.repeat(70));

  const observations = await om.getObservations(thread1, resourceId);
  const record = await om.getRecord(thread1, resourceId);

  console.log(`\nObserved threads: ${[] /* TODO: track observed threads */?.join(', ') || 'none'}`);
  console.log(`Observation tokens: ${record?.observationTokenCount || 0}`);

  if (observations) {
    console.log('\n📝 Observations content:');
    console.log('─'.repeat(70));
    console.log(observations);
    console.log('─'.repeat(70));
  }

  // ═══════════════════════════════════════════════════════════════════
  // THREAD 3: New conversation - can it recall from other threads?
  // ═══════════════════════════════════════════════════════════════════
  console.log('\n' + '═'.repeat(70));
  console.log(`🧪 CROSS-THREAD RECALL TEST (${thread3})`);
  console.log('   New thread - testing if agent remembers facts from Thread 1 & 2');
  console.log('═'.repeat(70));

  // Test recall of work facts (from Thread 1)
  console.log('\n--- Recalling work facts (from Thread 1) ---');
  const r1 = await chatInThread(thread3, 'Where do I work and what do I do there?', 'R1');

  // Test recall of personal facts (from Thread 2)
  console.log('\n--- Recalling personal facts (from Thread 2) ---');
  const r2 = await chatInThread(thread3, "What's my dog's name and what are my hobbies?", 'R2');

  // Test combined recall
  console.log('\n--- Combined recall ---');
  const r3 = await chatInThread(thread3, 'Give me a summary of everything you know about me.', 'R3');

  // ═══════════════════════════════════════════════════════════════════
  // SCORING
  // ═══════════════════════════════════════════════════════════════════
  console.log('\n' + '═'.repeat(70));
  console.log('📋 CROSS-THREAD RECALL RESULTS');
  console.log('═'.repeat(70));

  const allText = [r1, r2, r3].map(r => r.text.toLowerCase()).join(' ');

  const workFacts = [
    { key: 'TechCorp', found: allText.includes('techcorp') },
    { key: 'Software engineer', found: allText.includes('software') || allText.includes('engineer') },
    { key: 'Team of 5', found: allText.includes('5') || allText.includes('five') },
    { key: 'TypeScript', found: allText.includes('typescript') },
  ];

  const personalFacts = [
    { key: 'Max (dog)', found: allText.includes('max') },
    { key: 'Mount Tam', found: allText.includes('tam') || allText.includes('hiking') },
    { key: 'SF Marathon', found: allText.includes('marathon') },
  ];

  console.log('\n📋 Work facts (from Thread 1):');
  let workPassed = 0;
  for (const { key, found } of workFacts) {
    console.log(`   ${found ? '✅' : '❌'} ${key}`);
    if (found) workPassed++;
  }

  console.log('\n📋 Personal facts (from Thread 2):');
  let personalPassed = 0;
  for (const { key, found } of personalFacts) {
    console.log(`   ${found ? '✅' : '❌'} ${key}`);
    if (found) personalPassed++;
  }

  const totalPassed = workPassed + personalPassed;
  const totalFacts = workFacts.length + personalFacts.length;
  const pct = Math.round((totalPassed / totalFacts) * 100);

  console.log('\n' + '─'.repeat(70));
  console.log(`📊 TOTAL: ${totalPassed}/${totalFacts} (${pct}%)`);
  console.log('─'.repeat(70));

  if (pct >= 80) {
    console.log('\n🎉 EXCELLENT! Cross-thread memory is working!');
    console.log('   Facts from Thread 1 (work) and Thread 2 (personal)');
    console.log('   were both recalled in Thread 3!');
  } else if (pct >= 50) {
    console.log('\n✨ GOOD! Some cross-thread recall working.');
  } else {
    console.log('\n⚠️ Cross-thread recall needs improvement.');
  }
}

main().catch(console.error);
