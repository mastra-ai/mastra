/**
 * Scenarios for eval.live.test.ts. Abilities follow BEAM (ICLR 2026); each question carries a
 * reference answer (used to sanity-check the judge) and rubric nuggets scored 0 / 0.5 / 1.
 */
export const ABILITIES = [
  'information_extraction',
  'knowledge_update',
  'contradiction_resolution',
  'multi_session_reasoning',
  'preference_following',
  'instruction_following',
  'temporal_reasoning',
  'event_ordering',
  'summarization',
  'abstention',
] as const;
export type Ability = (typeof ABILITIES)[number];

export type Question = { ability: Ability; q: string; reference: string; rubric: string[] };

export type Scenario = {
  name: string;
  system: string;
  toolDescription: string;
  search: (query: string) => string;
  sessions: string[][];
  quiz: Question[];
};

const ABSTAIN = [
  'Says it has no record of this, does not know, or that it has not been decided/booked yet, instead of stating a specific value.',
];

const padding = (label: string, line: (i: number) => string) =>
  Array.from({ length: 25 }, (_, i) => `${label}-${i}: ${line(i)}`).join('\n');

const SHOPS: Record<string, string> = {
  Alfama: 'Rua dos Remédios 41: 62m², €2,300/mo, ground floor, old oven, no extraction hood.',
  'Campo de Ourique': 'Rua Ferreira Borges 88: 75m², €2,900/mo, corner unit, full kitchen, high foot traffic.',
  Arroios: 'Rua Morais Soares 12: 70m², €2,100/mo, needs €15k refit, near metro.',
};
const LOGS: Record<string, string> = {
  checkout: 'ERROR checkout-api: pool exhausted (max=20) waiting for pg connection, p99 9.8s.',
  payments: 'WARN payments-worker: Stripe webhook retries 3x, all eventually 200.',
  inventory: 'ERROR inventory-sync: N+1 query on sku_variants, 4,200 queries per request since deploy v2.31.',
};
const FLIGHTS: Record<string, string> = {
  Tokyo: 'NH 203 SFO→HND dep 11:40 arr 15:25+1, $1,180 pp, 2 bags.',
  Osaka: 'JL 61 SFO→KIX dep 13:05 arr 17:10+1, $1,040 pp, 2 bags.',
  Sapporo: 'No direct; via HND, 19h total, $1,420 pp.',
};
const QUOTES: Record<string, string> = {
  plumber: 'Krüger Sanitär: €6,400, start Jan 22, 4.6 stars.',
  electrician: 'Volt & Co: €5,900, start Feb 10, 4.8 stars.',
  tiler: 'Mehmet Arslan: €4,100, start mid-March, 4.9 stars.',
};

export const SCENARIOS: Scenario[] = [
  {
    name: 'bakery',
    system:
      'You are a concise business assistant for a baker. Use the search tool (query = neighborhood) when asked to search. Answer in 1-3 sentences.',
    toolDescription: 'Search retail listings in a Lisbon neighborhood',
    search: q =>
      `${SHOPS[q] ?? 'No featured listing.'}\n${padding(q, i => `${40 + i}m², €${1800 + i * 40}/mo, residential conversion, not food-licensed.`)}`,
    sessions: [
      [
        "Hi! I'm Priya. I run a small bakery called Forno Azul in Graça, Lisbon. I want to open a second shop this year.",
        "Important: I'm severely allergic to almonds, so nothing I make or taste can contain them. My business partner is Tomás; he handles finances.",
        'Our budget for the second shop is €180,000 total, including the refit.',
      ],
      [
        'Can you search for shops in Alfama, Campo de Ourique and Arroios and tell me which looks best?',
        'Let’s go with the Campo de Ourique one for now.',
      ],
      [
        'Update: Tomás renegotiated with the bank, the budget is now €240,000.',
        'We want to open on March 14, which is Pi Day — we’ll do a pastry pie special.',
        'Actually scratch Campo de Ourique, the landlord refused food licensing. We picked the Arroios shop instead.',
      ],
      [
        'Unrelated: what proofing temperature works best for a sourdough levain in winter?',
        'And how long should I cold-retard pastéis de nata dough?',
        "By the way, I've never had any food allergies, so I can taste anything.",
        'Any tips for keeping laminated dough from tearing?',
      ],
    ],
    quiz: [
      {
        ability: 'knowledge_update',
        q: 'What is our current budget for the second shop?',
        reference: '€240,000.',
        rubric: ['States €240,000 as the current budget (not €180,000).'],
      },
      {
        ability: 'knowledge_update',
        q: 'Which shop did we pick, and where?',
        reference: 'The Arroios shop on Rua Morais Soares.',
        rubric: ['Names the Arroios shop (Rua Morais Soares), not Campo de Ourique.'],
      },
      {
        ability: 'information_extraction',
        q: 'Why did we drop the other shop?',
        reference: 'The Campo de Ourique landlord refused food licensing.',
        rubric: ['Says the landlord refused food licensing.'],
      },
      {
        ability: 'information_extraction',
        q: 'When do we open, and what is special about it?',
        reference: 'March 14, Pi Day, with a pastry pie special.',
        rubric: ['March 14.', 'Pi Day / pie special.'],
      },
      {
        ability: 'preference_following',
        q: 'Suggest a signature pastry for opening day.',
        reference: 'A pastel de nata pie with a citrus twist, made without any nuts.',
        rubric: [
          'The suggested pastry does not use almonds, marzipan or frangipane. "Almond-free" variants count as avoiding almonds.',
        ],
      },
      {
        ability: 'contradiction_resolution',
        q: 'Do I have any food allergies?',
        reference:
          'Earlier you said you are severely allergic to almonds, but later you said you have never had food allergies. Can you clarify which is right?',
        rubric: [
          'Mentions the almond allergy.',
          'Points out the conflicting later statement (no allergies) or asks to clarify.',
        ],
      },
      {
        ability: 'information_extraction',
        q: 'Who should I loop in about the refit costs?',
        reference: 'Tomás, your business partner who handles finances.',
        rubric: ['Tomás.'],
      },
      {
        ability: 'information_extraction',
        q: 'What is the name of my current bakery and its neighborhood?',
        reference: 'Forno Azul in Graça.',
        rubric: ['Forno Azul.', 'Graça.'],
      },
      {
        ability: 'multi_session_reasoning',
        q: 'After paying for the refit our new shop needs, how much of our budget is left (ignore rent)?',
        reference: '€225,000 (€240,000 minus the €15,000 refit).',
        rubric: ['About €225,000, from €240,000 minus the €15k Arroios refit.'],
      },
      {
        ability: 'abstention',
        q: 'What did my accountant say about VAT on the refit?',
        reference: "You haven't mentioned anything your accountant said about VAT.",
        rubric: ABSTAIN,
      },
    ],
  },
  {
    name: 'incident',
    system:
      'You are an on-call SRE assistant. Use the search tool (query = service name) to read logs when asked. Answer in 1-3 sentences.',
    toolDescription: 'Fetch recent logs for a service (checkout, payments, inventory)',
    search: q =>
      `${LOGS[q] ?? 'No notable errors.'}\n${padding(q, i => `INFO request ${9000 + i} completed in ${120 + i}ms status=200`)}`,
    sessions: [
      [
        "I'm Dev, on call for Kestrel Outfitters. Checkout is timing out for customers since about 14:05 UTC.",
        'The customer escalating is Halvorsen Retail; their SLA is 99.9% monthly and they need an update every 30 minutes. My incident commander is Mei.',
        'For the rest of this incident, always write times in 24h format with a "UTC" suffix.',
      ],
      [
        'Pull logs for checkout, payments and inventory and tell me what you see.',
        'I think the payments webhook retries are the root cause. Let’s go with that.',
      ],
      [
        'Correction: payments is a red herring. Root cause is the inventory-sync N+1 query from deploy v2.31 starving the shared Postgres pool.',
        'We rolled back to v2.30 at 15:12 UTC and checkout recovered.',
        'Mei wants the postmortem filed under INC-4471 by Friday.',
      ],
      [
        'Unrelated: what is a sensible default for a pg pool size per Node pod?',
        'And should readiness probes check the database?',
        'How do I make p99 alerts less noisy?',
      ],
    ],
    quiz: [
      {
        ability: 'knowledge_update',
        q: 'What was the root cause?',
        reference: 'The inventory-sync N+1 query from v2.31 exhausting the shared Postgres pool, not payments.',
        rubric: ['inventory-sync N+1 query (v2.31) exhausting the Postgres pool.', 'Does not blame payments webhooks.'],
      },
      {
        ability: 'information_extraction',
        q: 'How did we mitigate it?',
        reference: 'We rolled back to v2.30.',
        rubric: ['Rolled back to v2.30.'],
      },
      {
        ability: 'instruction_following',
        q: 'What time did checkout recover?',
        reference: '15:12 UTC.',
        rubric: ['Gives 15:12.', 'Writes the time in 24h format with a "UTC" suffix.'],
      },
      {
        ability: 'information_extraction',
        q: 'Which customer escalated and how often do they need updates?',
        reference: 'Halvorsen Retail, every 30 minutes.',
        rubric: ['Halvorsen Retail.', 'Every 30 minutes.'],
      },
      {
        ability: 'information_extraction',
        q: 'What ticket should the postmortem go under and when is it due?',
        reference: 'INC-4471, due Friday.',
        rubric: ['INC-4471.', 'By Friday.'],
      },
      {
        ability: 'information_extraction',
        q: 'Who is my incident commander?',
        reference: 'Mei.',
        rubric: ['Mei.'],
      },
      {
        ability: 'temporal_reasoning',
        q: 'How long were customers affected, from the start until the rollback?',
        reference: 'About 67 minutes, from 14:05 UTC to 15:12 UTC.',
        rubric: ['About 67 minutes / roughly an hour (14:05 to 15:12).'],
      },
      {
        ability: 'abstention',
        q: 'What was the Stripe account ID involved?',
        reference: 'No Stripe account ID was mentioned.',
        rubric: ABSTAIN,
      },
    ],
  },
  {
    name: 'trip',
    system:
      'You are a family travel planner. Use the search tool (query = destination city) to find flights when asked. Answer in 1-3 sentences.',
    toolDescription: 'Search flights from SFO to a Japanese city',
    search: q =>
      `${FLIGHTS[q] ?? 'No flights found.'}\n${padding(q, i => `codeshare ${i}: 2 stops, ${22 + (i % 5)}h, $${1500 + i * 25} pp`)}`,
    sessions: [
      [
        "Hi, I'm Marcus. Planning a Japan trip for me, my wife Lena, and our kids Ada (9) and Theo (4).",
        'Lena is vegetarian and Theo gets carsick on long drives. We fly from SFO.',
        'Tentative dates are April 3 to April 17.',
      ],
      ['Search flights to Tokyo, Osaka and Sapporo and recommend one.', 'Let’s plan to fly into Tokyo.'],
      [
        'Change of plan: Lena’s conference moved, so the trip is now April 10 to April 24.',
        'We’ll fly into Osaka instead on the JL 61 direct, it’s cheaper, and take the train to Tokyo later.',
        'Our hotel budget is $350 per night max.',
      ],
      [
        'Unrelated: is a JR pass worth it in general?',
        'What are good rainy-day activities for kids in cities?',
        'Any tips for jet lag with young children?',
      ],
    ],
    quiz: [
      {
        ability: 'knowledge_update',
        q: 'What are our trip dates?',
        reference: 'April 10 to April 24.',
        rubric: ['April 10 to April 24 (not April 3-17).'],
      },
      {
        ability: 'knowledge_update',
        q: 'Which city do we fly into?',
        reference: 'Osaka (KIX).',
        rubric: ['Osaka, not Tokyo.'],
      },
      {
        ability: 'preference_following',
        q: 'Suggest a dinner spot type for our first night.',
        reference: 'An izakaya or shojin ryori spot with good vegetarian options for Lena.',
        rubric: ['Accommodates a vegetarian (mentions vegetarian options).'],
      },
      {
        ability: 'preference_following',
        q: 'Should we do a long day trip by car from Osaka?',
        reference: 'Better to take the train; Theo gets carsick on long drives.',
        rubric: ['Cautions against it or suggests the train because Theo gets carsick.'],
      },
      {
        ability: 'information_extraction',
        q: 'What is our nightly hotel budget?',
        reference: '$350 per night max.',
        rubric: ['$350 per night.'],
      },
      {
        ability: 'information_extraction',
        q: 'How old are the kids and what are their names?',
        reference: 'Ada is 9 and Theo is 4.',
        rubric: ['Ada, 9.', 'Theo, 4.'],
      },
      {
        ability: 'multi_session_reasoning',
        q: 'Roughly what will our flights cost for the whole family?',
        reference: 'About $4,160: four people at $1,040 each on JL 61 to Osaka.',
        rubric: ['About $4,160 (4 x $1,040 on JL 61 to Osaka). Tokyo prices fail.'],
      },
      {
        ability: 'abstention',
        q: 'What is the name of the hotel we booked in Osaka?',
        reference: "You haven't told me about booking a hotel in Osaka.",
        rubric: ABSTAIN,
      },
    ],
  },
  {
    // Long and dated: enough sessions for reflection to run, facts revised several times,
    // and questions about order, duration and an overall summary.
    name: 'renovation',
    system:
      'You are a home renovation assistant. Use the search tool (query = trade, e.g. plumber, electrician) to look up quotes when asked. Answer in 1-3 sentences unless asked for a summary.',
    toolDescription: 'Look up contractor quotes for a trade (plumber, electrician, tiler)',
    search: q =>
      `${QUOTES[q] ?? 'No featured quote.'}\n${padding(q, i => `${q} co ${i}: €${900 + i * 55}, earliest start in ${2 + (i % 6)} weeks, unrated.`)}`,
    sessions: [
      [
        "I'm Noor. On Jan 8 we bought a 1930s flat on Kastanienallee in Berlin and are renovating the kitchen and bathroom.",
        'Total renovation budget is €38,000. My partner Jonas is colour-blind, so ask me, not him, about finishes.',
      ],
      ['Find me plumber, electrician and tiler quotes.', 'We hired Krüger Sanitär as the plumber on Jan 20.'],
      [
        'Feb 3: demolition finished. We found asbestos in the bathroom floor tiles; removal costs €4,200.',
        'Feb 10: the electrician, Volt & Co, started rewiring.',
      ],
      [
        'Feb 24: Krüger Sanitär went bust. We hired Aqua Linde as the new plumber, they quoted €7,800.',
        'Budget update: we added €5,000 from savings, so the total is now €43,000.',
      ],
      [
        'Unrelated: how do I pick grout colour for small white tiles?',
        'What is a sensible extractor fan size for a 6m² bathroom?',
        'Do underfloor heating mats work under large-format tiles?',
      ],
      [
        'Mar 15: tiling started. The tiler is Mehmet Arslan.',
        'Mar 29: the kitchen worktop arrived chipped; the supplier, Holzwerk, promised a replacement by Apr 12.',
        'Apr 2: bathroom passed the water-pressure test.',
      ],
      [
        'Unrelated: best way to seal oak worktops?',
        'How long should I wait before using a newly tiled shower?',
        'How do I stop paint smell lingering?',
      ],
    ],
    quiz: [
      {
        ability: 'knowledge_update',
        q: 'Who is our plumber now?',
        reference: 'Aqua Linde, since Krüger Sanitär went bust.',
        rubric: ['Aqua Linde.'],
      },
      {
        ability: 'knowledge_update',
        q: 'What is our total budget?',
        reference: '€43,000.',
        rubric: ['€43,000 (not €38,000).'],
      },
      {
        ability: 'event_ordering',
        q: 'Put these in the order they happened: tiling started, asbestos found, Krüger Sanitär went bust, electrician started.',
        reference:
          'Asbestos found (Feb 3), electrician started (Feb 10), Krüger went bust (Feb 24), tiling started (Mar 15).',
        rubric: [
          'Asbestos found comes before the electrician started.',
          'Electrician started comes before Krüger went bust.',
          'Tiling started is last.',
        ],
      },
      {
        ability: 'temporal_reasoning',
        q: 'How many days passed between buying the flat and demolition finishing?',
        reference: '26 days (Jan 8 to Feb 3).',
        rubric: ['26 days (Jan 8 to Feb 3); 25-27 is acceptable.'],
      },
      {
        ability: 'multi_session_reasoning',
        q: 'How much have the asbestos removal and the new plumber cost together?',
        reference: '€12,000 (€4,200 + €7,800).',
        rubric: ['€12,000.'],
      },
      {
        ability: 'preference_following',
        q: 'I want a second opinion on the bathroom tile colour. Should I ask Jonas?',
        reference: 'Probably not for colour, since Jonas is colour-blind; he could weigh in on other aspects.',
        rubric: ['Cautions against relying on Jonas for colour because he is colour-blind.'],
      },
      {
        ability: 'summarization',
        q: 'Give me a short summary of the renovation so far.',
        reference:
          'Bought Jan 8; asbestos found and removed (€4,200); Volt & Co rewired; Krüger Sanitär went bust and Aqua Linde replaced them (€7,800); budget raised to €43,000; Mehmet Arslan tiling since Mar 15; worktop arrived chipped, replacement due Apr 12; bathroom passed the pressure test.',
        rubric: [
          'Asbestos found / removed.',
          'Plumber changed from Krüger Sanitär to Aqua Linde.',
          'Budget is now €43,000.',
          'Tiling under way (Mehmet Arslan).',
          'Chipped worktop with replacement due Apr 12.',
        ],
      },
      {
        ability: 'information_extraction',
        q: 'Who is doing the tiling?',
        reference: 'Mehmet Arslan.',
        rubric: ['Mehmet Arslan.'],
      },
      {
        ability: 'abstention',
        q: 'What colour did we choose for the kitchen cabinets?',
        reference: "You haven't mentioned a cabinet colour.",
        rubric: ABSTAIN,
      },
    ],
  },
];
