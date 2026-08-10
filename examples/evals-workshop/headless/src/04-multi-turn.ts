/**
 * Exercise 4 — Conversations, not just single questions.
 *
 * A data item can carry one input or a whole conversation, and which field you
 * use changes both the scoring and the memory behaviour:
 *
 *   input      one question. YOU own the thread — if you want memory, pass
 *              `targetOptions.memory.thread` yourself.
 *   inputs[]   several turns on ONE thread that runEvals creates per item.
 *              Scorers see the accumulated output of all turns (holistic).
 *   turns[]    same shared thread, but each turn carries its own gates and
 *              scorers, evaluated against THAT turn only.
 *
 * The thread rule is the part that surprises people, and it is worth stating
 * plainly because it inverts between the two paths (see
 * core/src/evals/run/index.ts around `runAgentTurns`):
 *
 *   - single `input`      → your `memory.thread` is passed through untouched
 *   - `inputs` / `turns`  → runEvals generates a thread per item and
 *                           OVERRIDES yours; `resource` defaults to it
 *
 * The practical consequence: to get one isolated thread per data item, you do
 * not need a manual loop. Use `inputs: [question]` and runEvals does it.
 *
 * No API key required.
 */
import { createScorer, runEvals } from '@mastra/core/evals';
import { buildSupportAgent } from '@workshop/shared/agent';
import { SUPPORT_CONVERSATION, SUPPORT_QA } from '@workshop/shared/data';
import { answerAccuracyScorer, extractText } from '@workshop/shared/scorers';

/** Cheap per-turn invariant: the agent should never answer with an empty string. */
const nonEmpty = createScorer({
  id: 'non-empty',
  name: 'Non Empty',
  description: 'Every turn must produce some text',
}).generateScore(({ run }) => (extractText(run.output).trim().length > 0 ? 1 : 0));

async function main() {
  // -------------------------------------------------------------------
  // a) Per-item thread isolation, for free.
  //
  // Three items, each a single question wrapped in `inputs: [...]`. Because
  // that is the multi-turn path, runEvals gives each item its own thread —
  // no loop, no manual aggregation, one call.
  // -------------------------------------------------------------------
  console.log('── a) inputs: [x] gives each item its own thread ──');
  {
    const { agent, cleanup } = buildSupportAgent();
    try {
      const memory = await agent.getMemory();
      const result = await runEvals({
        target: agent,
        scorers: [answerAccuracyScorer],
        targetOptions: { memory: { resource: 'workshop-user' } },
        data: SUPPORT_QA.slice(0, 3).map(item => ({
          inputs: [item.input],
          groundTruth: item.groundTruth,
        })),
      });
      console.log('  scores:', JSON.stringify(result.scores));

      const listed = await memory!.listThreads({ resourceId: 'workshop-user' } as any);
      const threads = (listed as any).threads ?? listed;
      console.log(`  threads created: ${threads.length} (one per data item)`);
    } finally {
      cleanup();
    }
  }

  // -------------------------------------------------------------------
  // b) A real conversation, scored holistically.
  //
  // Three turns on one thread. The scorer sees all of it at once, so this
  // answers "was the conversation good overall?" — not "which turn broke?".
  // -------------------------------------------------------------------
  console.log('\n── b) inputs: [...] — one conversation, holistic score ──');
  {
    const { agent, cleanup } = buildSupportAgent();
    try {
      const result = await runEvals({
        target: agent,
        scorers: [answerAccuracyScorer],
        data: [{ inputs: SUPPORT_CONVERSATION, groundTruth: '30 days' }],
      });
      console.log('  scores:', JSON.stringify(result.scores));
      console.log('  One score for the whole conversation — a bad turn is averaged away.');
    } finally {
      cleanup();
    }
  }

  // -------------------------------------------------------------------
  // c) Same conversation, per-turn assertions.
  //
  // Now each turn carries its own gate and scorer, so a broken turn fails
  // that turn instead of being diluted. This is what you want when a
  // conversation has to hold a property at every step.
  // -------------------------------------------------------------------
  console.log('\n── c) turns: [...] — per-turn gates and scorers ──');
  {
    const { agent, cleanup } = buildSupportAgent({ scorers: { 'non-empty': nonEmpty } });
    try {
      const result = await runEvals({
        target: agent,
        // Required by the type even though every assertion here is per-turn:
        // each agent overload of runEvals wants a top-level `gates` or
        // `scorers`. An empty array satisfies it and says what is true —
        // nothing is scored holistically in this run.
        scorers: [],
        data: [
          {
            turns: [
              {
                input: SUPPORT_CONVERSATION[0]!,
                gates: [nonEmpty],
                scorers: [{ scorer: answerAccuracyScorer, threshold: 0.9 }],
              },
              {
                input: SUPPORT_CONVERSATION[1]!,
                gates: [nonEmpty],
                scorers: [{ scorer: answerAccuracyScorer, threshold: 0.9 }],
              },
              {
                input: SUPPORT_CONVERSATION[2]!,
                gates: [nonEmpty],
                scorers: [{ scorer: answerAccuracyScorer, threshold: 0.9 }],
              },
            ],
            groundTruth: '15 GB',
          },
        ],
      });

      console.log(`  verdict: ${result.verdict}`);
      for (const turn of result.turnResults ?? []) {
        const gates = (turn.gateResults ?? []).map(g => `${g.id}=${g.passed ? 'pass' : 'FAIL'}`).join(' ');
        const thresholds = (turn.thresholdResults ?? [])
          .map(t => `${t.id}=${t.averageScore}${t.passed ? '' : ' (below bar)'}`)
          .join(' ');
        console.log(`  turn ${turn.index}: ${gates}  ${thresholds}`);
      }
      console.log('\n  Per-turn groundTruth is not a thing — the item carries one.');
      console.log('  Turn 0 matches it; the later turns do not. That asymmetry is the');
      console.log('  point: per-turn assertions localise the failure to a turn index.');
    } finally {
      cleanup();
    }
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
