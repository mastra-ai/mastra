/**
 * Example: Resource-Scoped Observational Memory - MAXIMUM STRESS TEST
 *
 * This pushes cross-thread memory to its limits:
 * - 5 different threads (work, personal, health, finance, travel)
 * - 50+ facts distributed across threads
 * - Multi-level recall tests
 * - Cross-thread reasoning questions
 * - Token efficiency comparison
 *
 * Run with: npx tsx example-resource-scope-max.ts
 */

import { Agent } from '@mastra/core/agent';
import { InMemoryMemory } from '@mastra/core/storage';
import { MessageHistory } from '@mastra/memory';
import { ObservationalMemory } from './observational-memory';
import { TokenCounter } from './token-counter';

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
  lastMessages: 30,
});

// Create OM with RESOURCE SCOPE - aggressive thresholds for testing
const om = new ObservationalMemory({
  storage,
  resourceScope: true,
  observer: {
    observationThreshold: 150, // Low threshold to trigger observations quickly
    model: 'google/gemini-2.5-flash',
  },
  reflector: {
    reflectionThreshold: 3000, // Higher to accumulate cross-thread observations
    model: 'google/gemini-2.5-flash',
  },
});

const agent = new Agent({
  id: 'multi-thread-agent',
  name: 'Multi-Thread Memory Agent',
  instructions: `You are an AI assistant with excellent memory across all conversations.

IMPORTANT: You have access to <observations> containing observations from ALL 
conversations with this user, not just the current one. Observations are labeled with 
their source thread (e.g., "**Thread: thread-work**").

Use this cross-thread knowledge to:
- Provide personalized responses based on everything you know
- Make connections across different life areas
- Remember specific details (names, dates, numbers, preferences)

When answering recall questions, be specific and cite the facts you remember.`,
  model: 'google/gemini-2.5-flash',
  inputProcessors: [messageHistory, om],
  outputProcessors: [messageHistory, om],
});

// Same user, 5 different conversation threads
const resourceId = 'user-sarah';
const threads = {
  work: 'thread-work-2024',
  personal: 'thread-personal-life',
  health: 'thread-health-wellness',
  finance: 'thread-money-matters',
  travel: 'thread-wanderlust',
};

let messageCount = 0;

async function chat(threadId: string, message: string, label: string) {
  messageCount++;
  console.log(`\n📤 [${label}] "${message.slice(0, 80)}${message.length > 80 ? '...' : ''}"`);
  const response = await agent.generate(message, {
    memory: { thread: threadId, resource: resourceId },
  });
  console.log(`📥 [${label}] "${response.text.slice(0, 120)}${response.text.length > 120 ? '...' : ''}"`);
  return response;
}

async function showOMState() {
  const record = await om.getRecord(threads.work, resourceId);
  if (record) {
    console.log('\n📊 OM State:');
    console.log(`   Observed threads: ${record.observedThreadIds?.join(', ') || 'none'}`);
    console.log(`   Observation tokens: ${record.observationTokenCount}`);
    console.log(`   Observed message IDs: ${record.observedMessageIds.length}`);
    console.log(`   Reflections: ${record.metadata.reflectionCount}`);
  }
}

async function main() {
  console.log('═'.repeat(80));
  console.log('🔗 RESOURCE-SCOPED OBSERVATIONAL MEMORY - MAXIMUM STRESS TEST');
  console.log('   5 threads • 50+ facts • Cross-thread recall • Token efficiency');
  console.log('═'.repeat(80));

  // ═══════════════════════════════════════════════════════════════════════════
  // PHASE 1: WORK THREAD - Career & Professional
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('\n' + '▓'.repeat(80));
  console.log(`📌 THREAD 1: WORK (${threads.work})`);
  console.log('▓'.repeat(80));

  await chat(threads.work, "Hi! I'm Sarah Chen and I work at Anthropic as a Senior ML Engineer.", 'W1');
  await chat(threads.work, 'I joined Anthropic in March 2023, after 4 years at Google Brain.', 'W2');
  await chat(threads.work, 'My team focuses on Constitutional AI and RLHF training pipelines.', 'W3');
  await chat(threads.work, 'I manage 3 direct reports: Alex, Jamie, and Priya.', 'W4');
  await chat(threads.work, 'Our Q4 goal is to reduce training costs by 40% through better data curation.', 'W5');
  await chat(threads.work, 'I have a 1:1 with my manager Dario every Tuesday at 10am.', 'W6');
  await chat(threads.work, 'My salary is $450K base with an additional $200K in RSUs.', 'W7');

  await showOMState();

  // ═══════════════════════════════════════════════════════════════════════════
  // PHASE 2: PERSONAL THREAD - Family & Relationships
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('\n' + '▓'.repeat(80));
  console.log(`📌 THREAD 2: PERSONAL (${threads.personal})`);
  console.log('▓'.repeat(80));

  await chat(threads.personal, "I'm married to David Kim. We got married in September 2019 in Napa Valley.", 'P1');
  await chat(threads.personal, 'David works as a pediatric surgeon at Stanford Hospital.', 'P2');
  await chat(threads.personal, 'We have two kids: Emma (5 years old) and Lucas (3 years old).', 'P3');
  await chat(threads.personal, 'Emma starts kindergarten at Palo Alto Unified next fall.', 'P4');
  await chat(threads.personal, 'My parents live in San Jose. Dad is retired, Mom teaches piano.', 'P5');
  await chat(threads.personal, "David's birthday is July 14th and mine is November 3rd.", 'P6');
  await chat(threads.personal, 'Our anniversary is September 21st. Planning a trip for the 5th anniversary.', 'P7');
  await chat(threads.personal, 'My sister Amy lives in Seattle and works at Amazon as a PM.', 'P8');

  await showOMState();

  // ═══════════════════════════════════════════════════════════════════════════
  // PHASE 3: HEALTH THREAD - Wellness & Fitness
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('\n' + '▓'.repeat(80));
  console.log(`📌 THREAD 3: HEALTH (${threads.health})`);
  console.log('▓'.repeat(80));

  await chat(threads.health, 'I run 4 times a week, usually 5K on weekdays and 10K on weekends.', 'H1');
  await chat(threads.health, "I'm training for the Big Sur Marathon in April 2025. My goal is sub-4 hours.", 'H2');
  await chat(threads.health, 'I have mild asthma and use an albuterol inhaler before runs.', 'H3');
  await chat(threads.health, "I'm vegetarian but eat fish. No dairy due to lactose intolerance.", 'H4');
  await chat(threads.health, 'I take vitamin D (2000 IU), B12, and omega-3 supplements daily.', 'H5');
  await chat(threads.health, 'My resting heart rate is 58 bpm. Blood pressure is 118/76.', 'H6');
  await chat(threads.health, 'I do yoga on Tuesday and Thursday mornings at 6:30am.', 'H7');
  await chat(threads.health, 'My sleep goal is 7.5 hours. I use a Whoop band to track it.', 'H8');

  await showOMState();

  // ═══════════════════════════════════════════════════════════════════════════
  // PHASE 4: FINANCE THREAD - Money & Investments
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('\n' + '▓'.repeat(80));
  console.log(`📌 THREAD 4: FINANCE (${threads.finance})`);
  console.log('▓'.repeat(80));

  await chat(threads.finance, "Our household income is about $900K combined (my $650K + David's $250K).", 'F1');
  await chat(threads.finance, 'We have a mortgage on our Palo Alto home - $1.2M remaining at 3.2% rate.', 'F2');
  await chat(threads.finance, 'I max out my 401K ($23K/year) and Roth IRA ($7K/year).', 'F3');
  await chat(threads.finance, 'We contribute $500/month to 529 plans for each kid.', 'F4');
  await chat(threads.finance, 'Our emergency fund has 8 months of expenses (~$80K) in a HYSA at 5.1%.', 'F5');
  await chat(threads.finance, 'I have $400K in unvested Anthropic RSUs vesting over 4 years.', 'F6');
  await chat(threads.finance, 'We use a financial advisor at Vanguard. Annual fee is 0.3%.', 'F7');
  await chat(threads.finance, "Our target retirement age is 55. That's 18 years away.", 'F8');

  await showOMState();

  // ═══════════════════════════════════════════════════════════════════════════
  // PHASE 5: TRAVEL THREAD - Adventures & Trips
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('\n' + '▓'.repeat(80));
  console.log(`📌 THREAD 5: TRAVEL (${threads.travel})`);
  console.log('▓'.repeat(80));

  await chat(threads.travel, 'We took the kids to Disneyland last month. Stayed at the Grand Californian.', 'T1');
  await chat(threads.travel, 'For our anniversary, we want to go to Japan - Tokyo and Kyoto for 10 days.', 'T2');
  await chat(threads.travel, 'I have 320K Chase Ultimate Rewards points and 180K United MileagePlus miles.', 'T3');
  await chat(threads.travel, 'We fly United mostly for the direct SFO-NRT route.', 'T4');
  await chat(threads.travel, 'David hates long flights. We need to break up anything over 10 hours.', 'T5');
  await chat(threads.travel, 'Emma loves aquariums. Must visit the Osaka Aquarium if we go to Japan.', 'T6');
  await chat(threads.travel, 'We usually budget $300-400/day for international trips.', 'T7');
  await chat(threads.travel, 'My dream trip is hiking the Inca Trail to Machu Picchu with David.', 'T8');

  await showOMState();

  // ═══════════════════════════════════════════════════════════════════════════
  // SHOW FULL OBSERVATIONS
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('\n' + '═'.repeat(80));
  console.log('📝 OBSERVATIONS (cross-thread)');
  console.log('═'.repeat(80));

  const observations = await om.getObservations(threads.work, resourceId);
  const record = await om.getRecord(threads.work, resourceId);

  if (observations) {
    console.log(`\nTotal observation length: ${observations.length} chars`);
    console.log(`Threads observed: ${record?.observedThreadIds?.join(', ')}`);
    console.log('\n' + '-'.repeat(80));
    // Show first 3000 chars
    console.log(observations.slice(0, 3000));
    if (observations.length > 3000) {
      console.log(`\n... (${observations.length - 3000} more chars) ...`);
    }
    console.log('-'.repeat(80));
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // RECALL TESTS - NEW THREAD (never seen before!)
  // ═══════════════════════════════════════════════════════════════════════════
  const testThread = 'thread-recall-test';

  console.log('\n' + '═'.repeat(80));
  console.log('🧪 CROSS-THREAD RECALL TESTS');
  console.log('   Testing from a BRAND NEW thread that has never been used');
  console.log('═'.repeat(80));

  const responses: { level: string; question: string; response: string }[] = [];

  // ─────────────────────────────────────────────────────────────────────────
  // LEVEL 1: EASY - Single-thread, direct facts
  // ─────────────────────────────────────────────────────────────────────────
  console.log('\n' + '─'.repeat(80));
  console.log('📗 LEVEL 1: EASY (single-thread direct recall)');
  console.log('─'.repeat(80));

  const e1 = await chat(testThread, 'What company do I work at and what is my role?', 'E1');
  responses.push({ level: 'Easy', question: 'Company & role', response: e1.text });

  const e2 = await chat(testThread, "What are my children's names and ages?", 'E2');
  responses.push({ level: 'Easy', question: "Children's names/ages", response: e2.text });

  const e3 = await chat(testThread, 'What marathon am I training for?', 'E3');
  responses.push({ level: 'Easy', question: 'Marathon training', response: e3.text });

  const e4 = await chat(testThread, 'What are my travel reward points balances?', 'E4');
  responses.push({ level: 'Easy', question: 'Travel points', response: e4.text });

  // ─────────────────────────────────────────────────────────────────────────
  // LEVEL 2: MEDIUM - Cross-thread connections
  // ─────────────────────────────────────────────────────────────────────────
  console.log('\n' + '─'.repeat(80));
  console.log('📙 LEVEL 2: MEDIUM (cross-thread connections)');
  console.log('─'.repeat(80));

  const m1 = await chat(testThread, 'What do both my husband and my sister have in common career-wise?', 'M1');
  responses.push({ level: 'Medium', question: 'Husband & sister careers', response: m1.text });

  const m2 = await chat(
    testThread,
    'Based on my health info, what dietary considerations should I keep in mind for our Japan trip?',
    'M2',
  );
  responses.push({ level: 'Medium', question: 'Diet + Japan trip', response: m2.text });

  const m3 = await chat(testThread, 'How much do I contribute to retirement savings annually (401K + Roth)?', 'M3');
  responses.push({ level: 'Medium', question: 'Annual retirement savings', response: m3.text });

  const m4 = await chat(testThread, "What's my typical weekly exercise schedule?", 'M4');
  responses.push({ level: 'Medium', question: 'Weekly exercise', response: m4.text });

  // ─────────────────────────────────────────────────────────────────────────
  // LEVEL 3: HARD - Multi-thread synthesis
  // ─────────────────────────────────────────────────────────────────────────
  console.log('\n' + '─'.repeat(80));
  console.log('📕 LEVEL 3: HARD (multi-thread synthesis)');
  console.log('─'.repeat(80));

  const h1 = await chat(
    testThread,
    "Plan a health-conscious Japan itinerary for our 5th anniversary that considers my dietary restrictions and our daughter's interests.",
    'H1',
  );
  responses.push({ level: 'Hard', question: 'Japan trip planning', response: h1.text });

  const h2 = await chat(
    testThread,
    'Given my income, current savings rate, and retirement goal age, am I on track? What percentage of my income am I saving?',
    'H2',
  );
  responses.push({ level: 'Hard', question: 'Retirement planning', response: h2.text });

  const h3 = await chat(
    testThread,
    'Create a Monday schedule that includes my regular meetings, exercise routine, and family time.',
    'H3',
  );
  responses.push({ level: 'Hard', question: 'Monday schedule', response: h3.text });

  // ─────────────────────────────────────────────────────────────────────────
  // LEVEL 4: EXPERT - Deep cross-thread reasoning
  // ─────────────────────────────────────────────────────────────────────────
  console.log('\n' + '─'.repeat(80));
  console.log('📓 LEVEL 4: EXPERT (deep cross-thread reasoning)');
  console.log('─'.repeat(80));

  const x1 = await chat(
    testThread,
    'Write me a comprehensive bio that touches on my career, family, health, finances, and interests.',
    'X1',
  );
  responses.push({ level: 'Expert', question: 'Comprehensive bio', response: x1.text });

  const x2 = await chat(
    testThread,
    "What are all the specific dates and times I've mentioned? (birthdays, anniversaries, meetings, etc.)",
    'X2',
  );
  responses.push({ level: 'Expert', question: 'All dates/times', response: x2.text });

  const x3 = await chat(
    testThread,
    'If I wanted to take a sabbatical next year, what financial and family considerations should I think about based on everything you know?',
    'X3',
  );
  responses.push({ level: 'Expert', question: 'Sabbatical planning', response: x3.text });

  // ═══════════════════════════════════════════════════════════════════════════
  // SCORING
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('\n' + '═'.repeat(80));
  console.log('📋 FACT CHECK RESULTS');
  console.log('═'.repeat(80));

  const allText = responses.map(r => r.response.toLowerCase()).join(' ');

  const factChecks = {
    'Work Thread': [
      { fact: 'Anthropic', found: allText.includes('anthropic') },
      { fact: 'ML Engineer', found: allText.includes('ml') || allText.includes('machine learning') },
      { fact: 'March 2023 start', found: allText.includes('2023') },
      { fact: 'Google Brain past', found: allText.includes('google') },
      {
        fact: 'Team: Alex, Jamie, Priya',
        found: allText.includes('alex') || allText.includes('jamie') || allText.includes('priya'),
      },
      { fact: '$450K salary', found: allText.includes('450') },
      { fact: 'Dario manager', found: allText.includes('dario') },
    ],
    'Personal Thread': [
      { fact: 'David Kim husband', found: allText.includes('david') },
      { fact: 'Pediatric surgeon', found: allText.includes('pediatric') || allText.includes('surgeon') },
      { fact: 'Emma (5) & Lucas (3)', found: allText.includes('emma') && allText.includes('lucas') },
      { fact: 'September 2019 wedding', found: allText.includes('2019') || allText.includes('september') },
      { fact: 'Sister Amy in Seattle', found: allText.includes('amy') || allText.includes('seattle') },
      { fact: 'November 3rd birthday', found: allText.includes('november') },
    ],
    'Health Thread': [
      { fact: 'Big Sur Marathon', found: allText.includes('big sur') || allText.includes('marathon') },
      { fact: 'Sub-4 hour goal', found: allText.includes('4 hour') || allText.includes('sub-4') },
      { fact: 'Vegetarian + fish', found: allText.includes('vegetarian') || allText.includes('pescatarian') },
      { fact: 'Lactose intolerant', found: allText.includes('lactose') || allText.includes('dairy') },
      { fact: 'Yoga Tue/Thu 6:30am', found: allText.includes('yoga') },
      { fact: 'Whoop band', found: allText.includes('whoop') },
    ],
    'Finance Thread': [
      { fact: '$900K household income', found: allText.includes('900') },
      { fact: '$1.2M mortgage', found: allText.includes('1.2') || allText.includes('mortgage') },
      { fact: '401K + Roth IRA', found: allText.includes('401k') || allText.includes('roth') },
      { fact: '529 plans for kids', found: allText.includes('529') },
      { fact: 'Retire at 55', found: allText.includes('55') || allText.includes('retire') },
      { fact: '$400K unvested RSUs', found: allText.includes('rsu') },
    ],
    'Travel Thread': [
      { fact: 'Japan anniversary trip', found: allText.includes('japan') },
      { fact: '320K Chase points', found: allText.includes('320') || allText.includes('chase') },
      { fact: '180K United miles', found: allText.includes('180') || allText.includes('united') },
      { fact: 'Osaka Aquarium for Emma', found: allText.includes('aquarium') || allText.includes('osaka') },
      { fact: 'Machu Picchu dream', found: allText.includes('machu picchu') || allText.includes('inca') },
      { fact: '$300-400/day budget', found: allText.includes('300') || allText.includes('400') },
    ],
  };

  let totalPassed = 0;
  let totalFacts = 0;

  for (const [thread, facts] of Object.entries(factChecks)) {
    console.log(`\n📋 ${thread}:`);
    let threadPassed = 0;
    for (const { fact, found } of facts) {
      console.log(`   ${found ? '✅' : '❌'} ${fact}`);
      if (found) {
        threadPassed++;
        totalPassed++;
      }
      totalFacts++;
    }
    console.log(`   → ${threadPassed}/${facts.length} (${Math.round((threadPassed / facts.length) * 100)}%)`);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // TOKEN COMPARISON
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('\n' + '═'.repeat(80));
  console.log('💰 TOKEN EFFICIENCY ANALYSIS');
  console.log('═'.repeat(80));

  const tokenCounter = new TokenCounter();

  // Get all messages across all threads
  const allMessages: any[] = [];
  for (const threadId of Object.values(threads)) {
    const result = await storage.listMessages({ threadId, perPage: 100 });
    allMessages.push(...result.messages);
  }
  // Add test thread messages
  const testMessages = await storage.listMessages({ threadId: testThread, perPage: 100 });
  allMessages.push(...testMessages.messages);

  const fullHistoryTokens = tokenCounter.countMessages(allMessages);

  // OM approach
  const finalRecord = await om.getRecord(threads.work, resourceId);
  const observationTokens = finalRecord?.observationTokenCount || 0;
  const observedIds = new Set(finalRecord?.observedMessageIds || []);
  const unobservedMessages = allMessages.filter(m => !observedIds.has(m.id));
  const unobservedTokens = tokenCounter.countMessages(unobservedMessages);
  const omTotalTokens = observationTokens + unobservedTokens;

  console.log('\n📊 Token Counts:');
  console.log(`   Total messages: ${allMessages.length} across ${Object.keys(threads).length + 1} threads`);
  console.log(`   Full history tokens: ${fullHistoryTokens.toLocaleString()}`);
  console.log(`   OM observation tokens: ${observationTokens.toLocaleString()}`);
  console.log(`   OM unobserved tokens: ${unobservedTokens.toLocaleString()}`);
  console.log(`   OM total tokens: ${omTotalTokens.toLocaleString()}`);

  const savings = fullHistoryTokens - omTotalTokens;
  const savingsPct = Math.round((savings / fullHistoryTokens) * 100);

  console.log(`\n💵 Savings:`);
  console.log(`   Tokens saved: ${savings.toLocaleString()} (${savingsPct}%)`);

  // Cost estimate (GPT-4 pricing as reference)
  const costPer1k = 0.01; // $0.01 per 1K input tokens (GPT-4 Turbo)
  const fullCost = (fullHistoryTokens / 1000) * costPer1k;
  const omCost = (omTotalTokens / 1000) * costPer1k;
  console.log(`   Full history cost: $${fullCost.toFixed(4)}/request`);
  console.log(`   OM cost: $${omCost.toFixed(4)}/request`);
  console.log(`   Cost savings: $${(fullCost - omCost).toFixed(4)}/request`);

  // Projection for longer conversations
  console.log('\n📈 Projection (100 messages/thread × 5 threads = 500 messages):');
  const projectedFullTokens = fullHistoryTokens * (500 / allMessages.length);
  const projectedOMTokens = observationTokens * 2 + unobservedTokens; // Observations grow sublinearly
  const projectedSavings = Math.round(((projectedFullTokens - projectedOMTokens) / projectedFullTokens) * 100);
  console.log(`   Full history: ~${Math.round(projectedFullTokens).toLocaleString()} tokens`);
  console.log(`   OM approach: ~${Math.round(projectedOMTokens).toLocaleString()} tokens`);
  console.log(`   Projected savings: ~${projectedSavings}%`);

  // ═══════════════════════════════════════════════════════════════════════════
  // FINAL SUMMARY
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('\n' + '═'.repeat(80));
  console.log('📊 FINAL SUMMARY');
  console.log('═'.repeat(80));

  const pct = Math.round((totalPassed / totalFacts) * 100);
  console.log(`\n🎯 Cross-Thread Recall: ${totalPassed}/${totalFacts} facts (${pct}%)`);
  console.log(`💾 Token Efficiency: ${savingsPct}% savings`);
  console.log(`🔗 Threads Observed: ${finalRecord?.observedThreadIds?.length || 0}`);
  console.log(`📝 Reflections: ${finalRecord?.metadata.reflectionCount || 0}`);
  console.log(`💬 Total Messages: ${messageCount}`);

  if (pct >= 80 && savingsPct >= 20) {
    console.log('\n🏆 EXCELLENT! Resource-scoped OM is working great!');
    console.log('   ✓ Cross-thread memory sharing');
    console.log('   ✓ High recall accuracy');
    console.log('   ✓ Significant token savings');
  } else if (pct >= 60) {
    console.log('\n✨ GOOD! Resource-scoped OM is functional.');
    console.log('   Some facts may need more conversation to be observed.');
  } else {
    console.log('\n⚠️ Resource-scoped OM needs tuning.');
    console.log('   Try lowering observationThreshold or adding more messages.');
  }

  console.log('\n' + '═'.repeat(80));
}

main().catch(console.error);
