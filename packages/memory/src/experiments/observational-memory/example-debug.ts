/**
 * Debug example to trace exactly what OM is doing
 *
 * Run with: npx tsx example-debug.ts
 */

import { Agent } from '@mastra/core/agent';
import { InMemoryMemory } from '@mastra/core/storage';
import { MessageHistory } from '@mastra/memory';
import { ObservationalMemory } from './observational-memory';
import { TokenCounter } from './token-counter';

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
    observationThreshold: 100, // VERY low - trigger after ~2 exchanges
    model: 'google/gemini-2.5-flash',
  },
  reflector: {
    reflectionThreshold: 500, // Very low - trigger reflection quickly
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
  console.log(`   - Reflections: ${record?.metadata?.reflectionCount || 0}`);

  return response;
}

async function main() {
  console.log('═'.repeat(70));
  console.log('🧪 OBSERVATIONAL MEMORY - EXTREME RECALL TEST');
  console.log(`   observationThreshold: 100 tokens (trigger observation)`);
  console.log(`   reflectionThreshold: 500 tokens (trigger reflection)`);
  console.log('═'.repeat(70));
  console.log('\nThis test plants 30+ specific facts across 6 categories,');
  console.log('then tests recall with increasingly difficult questions.\n');

  // ═══════════════════════════════════════════════════════════════════
  // PHASE 1: Personal Identity
  // ═══════════════════════════════════════════════════════════════════
  console.log('─'.repeat(70));
  console.log('📌 PHASE 1: Personal Identity');
  console.log('─'.repeat(70));

  await chat('My name is Alice Chen and I was born on March 15, 1990.', '1.1');
  await chat("I'm originally from Seattle but moved to San Francisco in 2015.", '1.2');
  await chat('I live in the Mission District, on Valencia Street near 24th.', '1.3');
  await chat("My partner's name is Jordan - we've been together for 4 years.", '1.4');

  // ═══════════════════════════════════════════════════════════════════
  // PHASE 2: Pets & Family
  // ═══════════════════════════════════════════════════════════════════
  console.log('\n' + '─'.repeat(70));
  console.log('📌 PHASE 2: Pets & Family');
  console.log('─'.repeat(70));

  await chat('I have a golden retriever named Max - he turned 3 last month.', '2.1');
  await chat('We also have a tabby cat named Whiskers who is 7 years old.', '2.2');
  await chat('My parents still live in Seattle - my mom is a teacher, dad is retired.', '2.3');
  await chat('I have a younger brother named David who works at Google.', '2.4');

  // ═══════════════════════════════════════════════════════════════════
  // PHASE 3: Career & Work
  // ═══════════════════════════════════════════════════════════════════
  console.log('\n' + '─'.repeat(70));
  console.log('📌 PHASE 3: Career & Work');
  console.log('─'.repeat(70));

  await chat("I work at TechCorp as a Senior Software Engineer. I've been there 3 years.", '3.1');
  await chat('I lead a team of 5 engineers building a payments platform called PayFlow.', '3.2');
  await chat('My manager is Sarah Thompson - she was promoted to VP last quarter.', '3.3');
  await chat('Our tech stack is TypeScript, Node.js, PostgreSQL, and Redis.', '3.4');
  await chat('I use VS Code with the Dracula theme and vim keybindings.', '3.5');
  await chat('Before TechCorp, I worked at Stripe for 2 years and Square for 3.', '3.6');

  // ═══════════════════════════════════════════════════════════════════
  // PHASE 4: Hobbies & Interests
  // ═══════════════════════════════════════════════════════════════════
  console.log('\n' + '─'.repeat(70));
  console.log('📌 PHASE 4: Hobbies & Interests');
  console.log('─'.repeat(70));

  await chat('I love hiking - my favorite trail is the Dipsea Trail on Mount Tam.', '4.1');
  await chat("I'm training for the SF Marathon in July - currently at 30 miles/week.", '4.2');
  await chat('I read a lot of sci-fi. Ursula K. Le Guin is my favorite author.', '4.3');
  await chat('The Left Hand of Darkness is probably my all-time favorite book.', '4.4');
  await chat('I play guitar - mostly acoustic, learning fingerstyle right now.', '4.5');
  await chat("I'm into photography too - I shoot with a Fujifilm X-T4.", '4.6');

  // ═══════════════════════════════════════════════════════════════════
  // PHASE 5: Preferences & Habits
  // ═══════════════════════════════════════════════════════════════════
  console.log('\n' + '─'.repeat(70));
  console.log('📌 PHASE 5: Preferences & Habits');
  console.log('─'.repeat(70));

  await chat('For coffee I always get a cortado with oat milk from Ritual Coffee.', '5.1');
  await chat("I'm vegetarian - have been for about 5 years now.", '5.2');
  await chat('My go-to restaurant is Burma Superstar on Clement Street.', '5.3');
  await chat("I wake up at 6am every day - I'm definitely a morning person.", '5.4');
  await chat('I use the Pomodoro technique for work - 25 min focus, 5 min break.', '5.5');

  // ═══════════════════════════════════════════════════════════════════
  // PHASE 6: Recent Events & Plans
  // ═══════════════════════════════════════════════════════════════════
  console.log('\n' + '─'.repeat(70));
  console.log('📌 PHASE 6: Recent Events & Plans');
  console.log('─'.repeat(70));

  await chat('Last week our team shipped PayFlow v2.0 - huge milestone!', '6.1');
  await chat('Jordan and I are planning a trip to Japan next April for cherry blossoms.', '6.2');
  await chat("I'm thinking about getting my AWS Solutions Architect certification.", '6.3');
  await chat("We're adopting another dog soon - looking at rescue shelters.", '6.4');

  // ═══════════════════════════════════════════════════════════════════
  // Show OM State
  // ═══════════════════════════════════════════════════════════════════
  console.log('\n' + '═'.repeat(70));
  console.log('📊 OBSERVATIONAL MEMORY STATE');
  console.log('═'.repeat(70));

  const record = await om.getRecord(threadId, resourceId);
  console.log(`   Total messages sent: ~24 user + ~24 assistant = ~48`);
  console.log(`   Messages observed: ${record?.observedMessageIds.length || 0}`);
  console.log(`   Observation tokens: ${record?.observationTokenCount || 0}`);
  const reflections = record?.metadata?.reflectionCount || 0;
  console.log(`   Reflections: ${reflections} ${reflections > 0 ? '🔄' : ''}`);

  // ═══════════════════════════════════════════════════════════════════
  // RECALL TESTS - Easy
  // ═══════════════════════════════════════════════════════════════════
  console.log('\n' + '═'.repeat(70));
  console.log('🧪 RECALL TESTS - EASY (Basic facts)');
  console.log('═'.repeat(70));

  const easy1 = await chat('What is my name?', 'E1');
  const easy2 = await chat('Where do I work?', 'E2');
  const easy3 = await chat("What are my pets' names?", 'E3');

  // ═══════════════════════════════════════════════════════════════════
  // RECALL TESTS - Medium
  // ═══════════════════════════════════════════════════════════════════
  console.log('\n' + '═'.repeat(70));
  console.log('🧪 RECALL TESTS - MEDIUM (Specific details)');
  console.log('═'.repeat(70));

  const med1 = await chat('What is my birthday and where was I born?', 'M1');
  const med2 = await chat("What is my partner's name and how long have we been together?", 'M2');
  const med3 = await chat('What is my tech stack at work?', 'M3');
  const med4 = await chat("What's my favorite hiking trail?", 'M4');

  // ═══════════════════════════════════════════════════════════════════
  // RECALL TESTS - Hard
  // ═══════════════════════════════════════════════════════════════════
  console.log('\n' + '═'.repeat(70));
  console.log('🧪 RECALL TESTS - HARD (Obscure details)');
  console.log('═'.repeat(70));

  const hard1 = await chat("What is my manager's name and what happened to them recently?", 'H1');
  const hard2 = await chat('What camera do I shoot with?', 'H2');
  const hard3 = await chat("What's my favorite book and who wrote it?", 'H3');
  const hard4 = await chat('Where do I get my coffee and what do I order?', 'H4');
  const hard5 = await chat('What did my team ship last week?', 'H5');

  // ═══════════════════════════════════════════════════════════════════
  // RECALL TESTS - Expert
  // ═══════════════════════════════════════════════════════════════════
  console.log('\n' + '═'.repeat(70));
  console.log('🧪 RECALL TESTS - EXPERT (Combined knowledge)');
  console.log('═'.repeat(70));

  const exp1 = await chat('What certifications am I considering and what trips am I planning?', 'X1');
  const exp2 = await chat("Tell me about my brother - what's his name and where does he work?", 'X2');
  const exp3 = await chat(
    'Give me a complete profile: name, age, location, job, team, hobbies, pets, and plans.',
    'X3',
  );

  // ═══════════════════════════════════════════════════════════════════
  // SCORING
  // ═══════════════════════════════════════════════════════════════════
  console.log('\n' + '═'.repeat(70));
  console.log('📋 RECALL SCORING');
  console.log('═'.repeat(70));

  const allText = [easy1, easy2, easy3, med1, med2, med3, med4, hard1, hard2, hard3, hard4, hard5, exp1, exp2, exp3]
    .map(r => r.text.toLowerCase())
    .join(' ');

  const facts = [
    // Easy
    { category: 'Easy', key: 'Alice Chen', found: allText.includes('alice') },
    { category: 'Easy', key: 'TechCorp', found: allText.includes('techcorp') },
    { category: 'Easy', key: 'Max (dog)', found: allText.includes('max') },
    { category: 'Easy', key: 'Whiskers (cat)', found: allText.includes('whiskers') },

    // Medium
    { category: 'Medium', key: 'March 15 / 1990', found: allText.includes('march') || allText.includes('1990') },
    { category: 'Medium', key: 'Seattle (born)', found: allText.includes('seattle') },
    { category: 'Medium', key: 'Jordan (partner)', found: allText.includes('jordan') },
    { category: 'Medium', key: '4 years together', found: allText.includes('4 year') || allText.includes('four year') },
    { category: 'Medium', key: 'TypeScript', found: allText.includes('typescript') },
    {
      category: 'Medium',
      key: 'Dipsea Trail',
      found: allText.includes('dipsea') || allText.includes('mount tam') || allText.includes('tam'),
    },

    // Hard
    { category: 'Hard', key: 'Sarah Thompson (manager)', found: allText.includes('sarah') },
    { category: 'Hard', key: 'VP promotion', found: allText.includes('vp') || allText.includes('promot') },
    {
      category: 'Hard',
      key: 'Fujifilm X-T4',
      found: allText.includes('fuji') || allText.includes('x-t4') || allText.includes('xt4'),
    },
    {
      category: 'Hard',
      key: 'Left Hand of Darkness',
      found: allText.includes('left hand') || allText.includes('le guin'),
    },
    { category: 'Hard', key: 'Cortado + oat milk', found: allText.includes('cortado') },
    { category: 'Hard', key: 'Ritual Coffee', found: allText.includes('ritual') },
    { category: 'Hard', key: 'PayFlow v2.0', found: allText.includes('payflow') || allText.includes('v2') },

    // Expert
    {
      category: 'Expert',
      key: 'AWS certification',
      found: allText.includes('aws') || allText.includes('certification'),
    },
    { category: 'Expert', key: 'Japan trip', found: allText.includes('japan') },
    { category: 'Expert', key: 'David (brother)', found: allText.includes('david') },
    { category: 'Expert', key: 'Google (David works)', found: allText.includes('google') },
    { category: 'Expert', key: 'Adopting another dog', found: allText.includes('adopt') || allText.includes('rescue') },
  ];

  const categories = ['Easy', 'Medium', 'Hard', 'Expert'];
  let totalPassed = 0;

  for (const category of categories) {
    const categoryFacts = facts.filter(f => f.category === category);
    const categoryPassed = categoryFacts.filter(f => f.found).length;
    totalPassed += categoryPassed;

    console.log(`\n${category}:`);
    for (const { key, found } of categoryFacts) {
      console.log(`   ${found ? '✅' : '❌'} ${key}`);
    }
    console.log(`   Score: ${categoryPassed}/${categoryFacts.length}`);
  }

  const totalFacts = facts.length;
  const pct = Math.round((totalPassed / totalFacts) * 100);

  console.log('\n' + '─'.repeat(70));
  console.log(`📊 TOTAL SCORE: ${totalPassed}/${totalFacts} (${pct}%)`);
  console.log('─'.repeat(70));

  if (pct >= 90) console.log('🏆 EXCEPTIONAL RECALL!');
  else if (pct >= 75) console.log('🎉 EXCELLENT RECALL!');
  else if (pct >= 60) console.log('✨ GOOD RECALL!');
  else if (pct >= 40) console.log('👍 MODERATE RECALL');
  else console.log('⚠️ NEEDS IMPROVEMENT');

  // Final state
  const finalRecord = await om.getRecord(threadId, resourceId);
  console.log('\n📊 FINAL OM STATS:');
  console.log(`   - Total observed messages: ${finalRecord?.observedMessageIds.length || 0}`);
  console.log(`   - Final observation tokens: ${finalRecord?.observationTokenCount || 0}`);
  console.log(`   - Reflections: ${finalRecord?.metadata?.reflectionCount || 0}`);

  // ═══════════════════════════════════════════════════════════════════
  // TOKEN COMPARISON: Message History vs Observational Memory
  // ═══════════════════════════════════════════════════════════════════
  console.log('\n' + '═'.repeat(70));
  console.log('💰 TOKEN USAGE COMPARISON');
  console.log('═'.repeat(70));

  const tokenCounter = new TokenCounter();

  // Get all messages from storage (what MessageHistory would load)
  const allMessages = await storage.listMessages({
    threadId,
    page: 0,
    perPage: 1000,
    orderBy: { field: 'createdAt', direction: 'ASC' },
  });

  // Count tokens for full message history
  const fullHistoryTokens = tokenCounter.countMessages(allMessages.messages);

  // Count tokens for OM approach (observations + unobserved messages)
  const observationTokens = finalRecord?.observationTokenCount || 0;
  const observedMessageIds = new Set(finalRecord?.observedMessageIds || []);
  const unobservedMessages = allMessages.messages.filter(m => !observedMessageIds.has(m.id));
  const unobservedTokens = tokenCounter.countMessages(unobservedMessages);
  const omTotalTokens = observationTokens + unobservedTokens;

  // Calculate savings
  const tokensSaved = fullHistoryTokens - omTotalTokens;
  const savingsPercent = fullHistoryTokens > 0 ? Math.round((tokensSaved / fullHistoryTokens) * 100) : 0;

  console.log('\n📊 Without OM (full message history):');
  console.log(`   - Total messages: ${allMessages.messages.length}`);
  console.log(`   - Total tokens: ${fullHistoryTokens.toLocaleString()}`);

  console.log('\n📊 With OM (observations + unobserved):');
  console.log(`   - Observation tokens: ${observationTokens.toLocaleString()}`);
  console.log(`   - Unobserved messages: ${unobservedMessages.length}`);
  console.log(`   - Unobserved tokens: ${unobservedTokens.toLocaleString()}`);
  console.log(`   - Total tokens: ${omTotalTokens.toLocaleString()}`);

  console.log('\n💰 SAVINGS:');
  console.log(`   - Tokens saved: ${tokensSaved.toLocaleString()} (${savingsPercent}%)`);

  if (savingsPercent > 50) {
    console.log(`\n🎉 EXCELLENT! OM saved over ${savingsPercent}% of tokens!`);
  } else if (savingsPercent > 20) {
    console.log(`\n✨ GOOD! OM saved ${savingsPercent}% of tokens.`);
  } else if (savingsPercent > 0) {
    console.log(`\n👍 OM saved ${savingsPercent}% of tokens (savings grow with longer conversations).`);
  } else {
    console.log(`\n📈 OM hasn't saved tokens yet (savings appear after more observations).`);
  }

  // Show what would happen with even more messages
  console.log('\n📈 PROJECTION (if conversation continued):');
  const projectedMessages = allMessages.messages.length * 3;
  const projectedFullTokens = fullHistoryTokens * 3;
  const projectedOMTokens = observationTokens + unobservedTokens; // Observations don't grow linearly!
  const projectedSavings = Math.round(((projectedFullTokens - projectedOMTokens) / projectedFullTokens) * 100);
  console.log(`   - With ${projectedMessages} messages:`);
  console.log(`     • Full history: ~${projectedFullTokens.toLocaleString()} tokens`);
  console.log(`     • With OM: ~${projectedOMTokens.toLocaleString()} tokens`);
  console.log(`     • Projected savings: ~${projectedSavings}%`);
}

main().catch(console.error);
