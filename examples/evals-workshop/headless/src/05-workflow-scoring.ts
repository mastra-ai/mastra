/**
 * Exercise 5 — Evals are not an agent-only feature.
 *
 * `runEvals` takes a Workflow target, and workflow scorers aim at three levels:
 *
 *   workflow    the overall input → output
 *   steps       one specific step, addressed by its id
 *   trajectory  the sequence of steps that actually ran
 *
 * Step-level scoring is the one nobody expects and the one that pays for
 * itself. When a two-step pipeline starts answering badly, an overall score
 * tells you it got worse; a step score tells you triage started
 * misclassifying, which is the actual bug.
 *
 * No API key required.
 */
import { createScorer, runEvals } from '@mastra/core/evals';
import { buildSupportAgent } from '@workshop/shared/agent';
import { SUPPORT_QA } from '@workshop/shared/data';
import { supportWorkflow } from '@workshop/shared/workflow';

/** Overall: did the workflow's final answer carry the expected fact? */
const workflowAnswerCorrect = createScorer({
  id: 'workflow-answer-correct',
  name: 'Workflow Answer Correct',
  description: 'The final answer contains the expected fact',
}).generateScore(({ run }) => {
  const answer = String((run.output as any)?.answer ?? '').toLowerCase();
  const expected = String(run.groundTruth ?? '').toLowerCase();
  return expected && answer.includes(expected) ? 1 : 0;
});

/** Step-level: did triage pick a real topic rather than falling through? */
const triageResolved = createScorer({
  id: 'triage-resolved',
  name: 'Triage Resolved',
  description: 'Triage classified the question instead of returning "unknown"',
}).generateScore(({ run }) => {
  const topic = String((run.output as any)?.topic ?? '');
  return topic && topic !== 'unknown' ? 1 : 0;
});

async function main() {
  const { mastra, cleanup } = buildSupportAgent({
    scorers: {
      'workflow-answer-correct': workflowAnswerCorrect,
      'triage-resolved': triageResolved,
    },
  });

  try {
    const workflow = mastra.getWorkflow('support-workflow') ?? supportWorkflow;

    const result = await runEvals({
      target: workflow as any,
      // Note the shape: an object keyed by level, not a flat array.
      scorers: {
        workflow: [workflowAnswerCorrect],
        steps: {
          // Keys are step ids, exactly as given to createStep().
          triage: [triageResolved],
        },
      },
      data: SUPPORT_QA.map(item => ({
        input: { question: item.input },
        groundTruth: item.groundTruth,
      })),
    });

    console.log('── workflow + step scoring ──');
    console.log('  scores:', JSON.stringify(result.scores, null, 2));
    console.log(`  items : ${result.summary.totalItems}`);
    console.log(
      '\n  Two numbers, two questions: "is the answer right?" and "is triage\n' +
        '  working?". One overall score could not separate them.',
    );
  } finally {
    cleanup();
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
