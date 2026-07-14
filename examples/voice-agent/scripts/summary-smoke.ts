/**
 * THROWAWAY smoke for the end-of-call summary edge cases (pre-snapshot checklist item 3).
 * Run:   node --env-file=.env --import tsx scripts/summary-smoke.ts
 * Makes real OpenAI calls (gpt-4.1-mini + one embedding); writes smoke-* threads into the
 * local voice-agent.db (throwaway — `pnpm clean` removes it). Delete this file after use.
 */
import type { MastraDBMessage } from '@mastra/core/agent';
import { callRecords, hasSummaryConsent, summaryStorageRequired } from '../src/mastra/backend';
// Importing the Mastra instance wires its LibSQL storage into callCenterMemory (DI), same as the workers.
import { mastra } from '../src/mastra';
import { callCenterMemory, summarizeCall } from '../src/mastra/memory';

const callCenterAgent = mastra.getAgent('callCenter');
// getMemory() injects the Mastra instance's LibSQL storage into callCenterMemory (lazy DI) —
// the workers get this for free on their first turn; a bare script must trigger it once.
await callCenterAgent.getMemory();

const REQUIRE_CONSENT = { summaryStorage: true }; // what the REGULATED worker configures (defaults are permissive)
const RUN = Date.now().toString(36); // unique ids per run — the db file persists between runs

let failures = 0;
function check(label: string, cond: boolean, detail?: unknown) {
  const mark = cond ? 'PASS' : 'FAIL';
  if (!cond) failures++;
  console.log(`  [${mark}] ${label}${detail !== undefined ? ` — ${JSON.stringify(detail)}` : ''}`);
}

function msg(
  threadId: string,
  resourceId: string,
  role: 'user' | 'assistant',
  text: string,
  createdAt: Date,
): MastraDBMessage {
  return {
    id: `${threadId}-${Math.random().toString(36).slice(2, 10)}`,
    threadId,
    resourceId,
    role,
    type: 'text',
    createdAt,
    content: { format: 2, parts: [{ type: 'text', text }] },
  } as MastraDBMessage;
}

async function seedThread(
  threadId: string,
  resourceId: string,
  turns: Array<['user' | 'assistant', string]>,
  baseTime = Date.now(),
) {
  await callCenterMemory.saveThread({
    thread: {
      id: threadId,
      resourceId,
      title: threadId,
      metadata: {},
      createdAt: new Date(baseTime),
      updatedAt: new Date(baseTime),
    },
  });
  const messages = turns.map(([role, text], i) =>
    msg(threadId, resourceId, role, text, new Date(baseTime + i * 4_000)),
  );
  await callCenterMemory.saveMessages({ messages });
}

/** The DEFAULT (permissive) onCallEnd: summary always runs — as in voice-worker.ts / -workflow.ts. */
async function defaultOnCallEnd(thread: string, resource: string) {
  await summarizeCall({ thread, resource });
  return 'ran';
}

/** The REGULATED consent gate + summary, as voice-worker-regulated.ts runs it. */
async function regulatedOnCallEnd(thread: string, resource: string) {
  if (summaryStorageRequired(REQUIRE_CONSENT) && !hasSummaryConsent(resource)) return 'skipped';
  await summarizeCall({ thread, resource });
  return 'ran';
}

// ---------------------------------------------------------------------------
console.log('\n=== A. Short call (one exchange) → summary record produced ===');
{
  const thread = `smoke-call-a-${RUN}`;
  const resource = `smoke-caller-a-${RUN}`;
  await seedThread(thread, resource, [
    [
      'user',
      'Hi, this is Dana Smith. I think I need a roof inspection — I saw a water stain on the ceiling after the storm. The house is at 815 Oak Street, zip 94103. Best number for me is 415-555-0142. Oh, and do you folks also do gutter cleaning?',
    ],
    [
      'assistant',
      "Thanks Dana — I've got you down for a roof inspection at 815 Oak Street in 94103, and yes, gutter cleaning is something the team offers; I'll note your interest. Someone will call you back at 415-555-0142 to schedule. Is it okay if we keep a short summary of this call on file?",
    ],
    ['user', 'Yes, that is fine. Thanks so much, bye!'],
  ]);
  const outcome = await defaultOnCallEnd(thread, resource);
  const record = callRecords.get(thread);
  check('permissive default ran the summary', outcome === 'ran');
  check('CallSummaryRecord saved', !!record);
  check('summary is non-empty prose', !!record && record.summary.length > 20, record?.summary);
  check(
    'sentiment is a valid enum value',
    !!record && ['positive', 'neutral', 'negative'].includes(record.sentiment),
    record?.sentiment,
  );
  check(
    'requestedServices captured roof inspection',
    !!record && record.requestedServices.join(' ').toLowerCase().includes('roof'),
    record?.requestedServices,
  );
  check('record keyed to caller', record?.callerId === resource);
}

// ---------------------------------------------------------------------------
console.log('\n=== B. REGULATED worker, no consent → summary skipped, no record ===');
{
  const thread = `smoke-call-b-${RUN}`;
  const resource = `smoke-caller-b-${RUN}`; // no consent recorded → default NOT granted
  await seedThread(thread, resource, [
    ['user', 'Hello, just calling to ask if you handle bathroom remodels.'],
    ['assistant', 'We do — can I take your name and number for a callback?'],
    ['user', 'No thanks, I will call back later.'],
  ]);

  const outcome = await regulatedOnCallEnd(thread, resource);
  check('regulated gate skipped the summary', outcome === 'skipped');
  check('no CallSummaryRecord saved', !callRecords.has(thread));
}

// ---------------------------------------------------------------------------
console.log('\n=== C. Degenerate calls: greeting-only and empty thread ===');
{
  const thread = `smoke-call-c-${RUN}`;
  const resource = `smoke-caller-c-${RUN}`;
  await seedThread(thread, resource, [
    [
      'assistant',
      "Hi, you've reached Meridian Trades — quick heads up that I'm an AI assistant. How can I help today?",
    ],
  ]);
  let crashed = false;
  try {
    await defaultOnCallEnd(thread, resource);
  } catch (error) {
    crashed = true;
    console.log('  greeting-only summarize threw:', error);
  }
  check('greeting-only call does not crash', !crashed);
  console.log(
    `  [INFO] greeting-only produced a record: ${callRecords.has(thread)}`,
    callRecords.get(thread)?.summary ?? '',
  );

  // Empty thread: summarizeThread must no-op without a model call.
  const emptyThread = `smoke-call-empty-${RUN}`;
  await callCenterMemory.saveThread({
    thread: {
      id: emptyThread,
      resourceId: resource,
      title: emptyThread,
      metadata: {},
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  });
  const empty = await callCenterMemory.summarizeThread({
    model: 'openai/gpt-4.1-mini',
    threadId: emptyThread,
    resourceId: resource,
  });
  check('empty thread → empty result, no crash', empty.summary === '' && Object.keys(empty.extracted).length === 0);
}

// ---------------------------------------------------------------------------
console.log('\n=== D. Returning caller: sync OM distills call 1 at threshold; call 2 sees the facts ===');
{
  const resource = `smoke-caller-d-${RUN}`;
  const thread1 = `smoke-om-call-1-${RUN}`;
  const thread2 = `smoke-om-call-2-${RUN}`;
  // Resource scope runs OM SYNCHRONOUSLY (async buffering is unsupported with scope 'resource'):
  // the observer fires inline once unobserved messages cross `messageTokens` (3000 in the example
  // config — sized so typical demo calls end below it). To exercise distillation without seeding a
  // 3000-token transcript, lower the threshold for THIS caller only via the per-record override.
  await seedThread(thread1, resource, [
    [
      'user',
      "Hi, my name is Marco Reyes and I'm looking for a general contractor for a kitchen remodel — new cabinets, countertops, and probably rewiring one wall for the oven.",
    ],
    [
      'assistant',
      'Thanks Marco, a kitchen remodel with cabinets, countertops, and some electrical work — got it. What area are you in?',
    ],
    ['user', "I'm in the Mission, zip is 94110. The building is a two-unit Victorian, my unit is the ground floor."],
    ['assistant', '94110 is inside our service area. Do you have a rough timeline and budget in mind?'],
    [
      'user',
      'Hoping to start in September, budget around forty thousand dollars, and I would prefer weekday work only since I work from home on weekends.',
    ],
    [
      'assistant',
      'September start, about $40k, weekdays only — noted. What is the best number to reach you for the estimator?',
    ],
    [
      'user',
      'You can reach me at 415-555-0177. Mornings are best. One more thing — for the cabinets I was thinking shaker style in a sage green, and my partner wants a quartz countertop, maybe with a waterfall edge on the island if the budget allows.',
    ],
    [
      'assistant',
      'Shaker cabinets in sage green and quartz countertops with a possible waterfall-edge island — lovely choices, noted. Do you already have appliances picked out, or should the estimator plan for appliance recommendations too?',
    ],
    [
      'user',
      "We're keeping the fridge, but the range is being replaced with a thirty-six inch dual-fuel one, which is why that wall needs rewiring — the old range was gas only. The dishwasher is on its last legs too, so add that.",
    ],
    [
      'assistant',
      'Understood — new thirty-six inch dual-fuel range with the electrical work to support it, plus a new dishwasher, keeping the existing fridge. Anything about flooring or are you keeping what you have?',
    ],
    [
      'user',
      'The floor is original fir and we want to keep and protect it during the work. Also, heads up: there is street parking only, and we have a very friendly but very loud beagle named Waffles who will be home during the day.',
    ],
    [
      'assistant',
      "We'll plan floor protection for the original fir, note the street-parking situation for the crew, and warn everyone about Waffles the beagle — thanks for the heads up. Do you know if the building has any permit history we should look at?",
    ],
    [
      'user',
      'The upstairs unit did a similar remodel two years ago and their permits went through the city fine, so I can share their paperwork as a reference. Do you handle the permit filing or do I?',
    ],
    [
      'assistant',
      "We handle permit filing as part of the project — having the upstairs unit's paperwork as a reference will speed that up. The estimator will confirm the permit scope during the visit.",
    ],
    ['user', 'Great. Next question: is your work insured and do you offer any warranty on the remodel?'],
    [
      'assistant',
      "Yes — we're fully licensed and insured, and remodel work carries a two-year workmanship warranty. I'll have the estimator bring the full warranty terms to the visit so you can read them before signing anything.",
    ],
    [
      'user',
      'Good to know. How long does a remodel like this usually take once it starts? We are hosting family for the holidays in late November, so the kitchen really needs to be usable again by the third week of November at the absolute latest.',
    ],
    [
      'assistant',
      'A remodel of this scope typically runs eight to ten weeks. A September start puts completion in early-to-mid November, which fits your holiday deadline, but the estimator will build a schedule with buffer so a permit delay does not push you past the third week of November.',
    ],
    [
      'user',
      'Perfect. And while the wall is open for the range rewiring, could your electrician also add two extra outlets on the island and move the light switch that is currently hidden behind where the new fridge cabinet panel will go?',
    ],
    [
      'assistant',
      'Absolutely — two additional island outlets and relocating the switch away from the fridge panel are easy to fold into the same electrical scope while the wall is open. I have added both to the notes for the estimator.',
    ],
  ]);

  const om = await callCenterMemory.omEngine;
  check('OM engine present on the example memory', !!om);
  if (om) {
    // Ensure the OM record exists (getStatus creates it), then lower the threshold for THIS
    // caller only via the per-record override; everyone else stays at 3000.
    await om.getStatus({ threadId: thread1, resourceId: resource });
    await callCenterMemory.updateObservationalMemoryConfig({
      threadId: thread1,
      resourceId: resource,
      config: { observation: { messageTokens: 800 } },
    });

    const before = await om.getStatus({ threadId: thread1, resourceId: resource });
    check('call-1 transcript crosses the observation threshold', before.shouldObserve, {
      pendingTokens: before.pendingTokens,
      threshold: before.threshold,
    });

    // In a live call this fires inline during a turn; observe() is the same threshold-gated pass.
    const observed = await om.observe({ threadId: thread1, resourceId: resource });
    check(
      'observer distilled call 1 into active observations',
      observed.observed && !!observed.record.activeObservations,
    );
    check(
      'observations mention the kitchen remodel',
      (observed.record.activeObservations ?? '').toLowerCase().includes('kitchen'),
    );

    // Call 2: one real agent turn, same caller, new thread — resource-scoped OM carries the facts.
    const reply = await callCenterAgent.generate(
      "Hi, it's Marco again — quick question about the project I called about earlier, did we say September or October for the start?",
      { memory: { thread: thread2, resource } },
    );
    console.log('  agent reply (call 2):', JSON.stringify(reply.text.slice(0, 220)));
    check("agent's reply reflects the prior call (September)", reply.text.toLowerCase().includes('september'));

    const status2 = await om.getStatus({ threadId: thread2, resourceId: resource });
    check('resource-scoped observations visible from call 2', !!status2.record?.activeObservations);
  }
}

// ---------------------------------------------------------------------------
console.log('\n=== E. summarizeThread on Gemini ===');
if (process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GOOGLE_API_KEY) {
  const res = await callCenterMemory.summarizeThread({
    model: 'google/gemini-2.5-flash',
    threadId: `smoke-call-a-${RUN}`,
    resourceId: `smoke-caller-a-${RUN}`,
    instructions: 'Summarize this call for the business owner.',
  });
  check('gemini summarize returned a summary', res.summary.length > 0);
} else {
  console.log('  [SKIP] no Google API key in .env — keep this on the live-test list (Plancraft runs Gemini)');
}

console.log(`\n=== DONE: ${failures === 0 ? 'ALL PASS' : `${failures} FAILURE(S)`} ===`);
process.exit(failures === 0 ? 0 : 1);
