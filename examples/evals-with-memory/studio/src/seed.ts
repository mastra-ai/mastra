/**
 * Seed the Studio Evaluation dashboard.
 *
 * An empty dashboard demos nothing, and a dashboard where every run is
 * identical demos almost as little. This seeds three experiments over one
 * dataset that tell a story you can point at:
 *
 *   1. baseline    the agent as shipped
 *   2. regression  a change that quietly breaks two answers
 *   3. fix         the repair, back to baseline
 *
 * Open the dataset in Studio afterwards and the three runs line up side by
 * side: the middle one dips, the third recovers. That shape — noticing a
 * regression you did not intend — is the entire argument for evals.
 *
 * Note on determinism: this script runs `tsx` without `--env-file-if-exists`,
 * so it does NOT pick up `.env` and the agent falls back to the mock model.
 * That is deliberate — the seeded history is teaching material and should be
 * byte-identical on every machine in the room, which an LLM cannot promise.
 * The dev server does load `.env`, so live chat uses the real model. Seeded
 * history: reproducible. Live traffic: real. Both visible in one dashboard.
 *
 * Rerunning: safe. The seed is idempotent — it gives the dataset a fixed id
 * and stops early if that dataset is already there, rather than stacking a
 * second copy of the items and three more experiments on top of the first run.
 * `pnpm reset` is the way to rebuild the story from scratch: it drops both
 * databases and calls this script again.
 *
 * Run:  pnpm seed      (or `pnpm reset` to start over)
 */
import { SUPPORT_QA } from '@workshop/shared/data';
import { JUDGE_MODEL } from '@workshop/shared/models';
import { answerAccuracyScorer } from '@workshop/shared/scorers';
import { editor, mastra, observability, supportAgent } from './mastra/index.ts';
import { STORED_SKILLS } from './stored-skills.ts';

/** Answers the way the shipped agent does. */
async function baselineTask({ input }: { input: unknown }) {
  const result = await supportAgent.generate(String(input));
  return result.text;
}

/**
 * A plausible regression: someone "improves" the agent by making it hedge, and
 * the hedging swallows the specific numbers the scorer looks for.
 */
async function regressedTask({ input }: { input: unknown }) {
  const result = await supportAgent.generate(String(input));
  const text = result.text;
  // Two of the four rows lose their fact to a vague rewrite.
  if (text.includes('15 GB') || text.includes('30 days')) {
    return 'That depends on your plan — please check your account settings for details.';
  }
  return text;
}

/**
 * Stored skills, so the Agent Builder's skill picker has something in it.
 *
 * These are the database-backed kind, not the markdown-under-workspace kind —
 * see src/stored-skills.ts for why both exist. The Builder reads exactly this
 * list when it decides whether to call `set-agent-skills`, so with none seeded
 * that step silently never happens and the demo looks like the feature is
 * missing.
 *
 * Idempotent, and run on every seed including one that finds the dataset
 * already there: adding an entry to STORED_SKILLS and re-running `pnpm seed`
 * installs just the new one, without disturbing the seeded experiments.
 */
async function seedStoredSkills() {
  for (const skill of STORED_SKILLS) {
    const existing = await editor.skill.getById(skill.id).catch(() => null);
    if (existing) {
      console.log(`  skill "${skill.name.padEnd(20)}" — already present, left alone`);
      continue;
    }
    await editor.skill.create(skill as any);
    console.log(`  skill "${skill.name.padEnd(20)}" — created`);
  }
}

async function main() {
  console.log('Seeding the Evaluation dashboard…\n');

  // A fixed id, so a rerun can find this dataset instead of making another.
  // Dataset *names* are not unique, so without an id every `pnpm seed` would
  // add a fresh dataset carrying its own duplicate copy of the items.
  const DATASET_ID = 'nimbus-support-qa';

  const existing = await mastra.datasets.get({ id: DATASET_ID }).catch(() => null);
  if (existing) {
    console.log(`  dataset "${DATASET_ID}" — already seeded, experiments left alone`);
    await seedStoredSkills();
    await observability.shutdown();
    console.log(`
Nothing else to do. Run \`pnpm reset\` to drop both databases and rebuild the
baseline → regression → fix story from scratch.`);
    return;
  }

  const dataset = await mastra.datasets.create({
    id: DATASET_ID,
    name: 'nimbus-support-qa',
    description: 'Support questions with known-good answers — workshop dataset',
  });

  await dataset.addItems({
    items: SUPPORT_QA.map(item => ({
      input: item.input,
      groundTruth: item.groundTruth,
      metadata: { topic: item.id, expectedToFail: Boolean(item.expectedToFail) },
    })),
  });
  console.log(`  dataset "nimbus-support-qa" — ${SUPPORT_QA.length} items`);

  const runs = [
    { label: 'baseline', description: 'The agent as shipped', task: baselineTask },
    { label: 'regression', description: 'A hedging "improvement" that swallowed the facts', task: regressedTask },
    { label: 'fix', description: 'Hedging reverted — back to baseline', task: baselineTask },
  ];

  for (const run of runs) {
    const summary = await dataset.startExperiment({
      // Name them. Without this the Studio experiments list shows three
      // opaque uuids and the whole baseline→regression→fix story is invisible.
      name: run.label,
      description: run.description,
      scorers: [answerAccuracyScorer],
      task: run.task,
    });
    const scores = (summary.results ?? []).map((r: any) => r.scores?.[0]?.score ?? 0);
    const mean = scores.length ? scores.reduce((a: number, b: number) => a + b, 0) / scores.length : 0;
    console.log(
      `  experiment "${run.label.padEnd(10)}" → mean ${mean.toFixed(3)}  (${summary.succeededCount}/${summary.totalItems} ok)`,
    );
  }

  // -------------------------------------------------------------------
  // Snapshot the shipped prompt as agent v1, and publish it.
  //
  // Without this the Editor tab opens on "No versions yet", and the first
  // thing anyone saves becomes v1 — meaning the edit *is* the baseline and
  // there is nothing to compare it against. Recording what the code says
  // first is both better practice and the only way the demo has two versions
  // to put side by side.
  //
  // Publishing matters as much as saving. A saved-but-unpublished version is
  // inert: the server resolves agents at `status: 'published'`, so v2 sitting
  // in draft changes nothing about what the agent answers. Save writes a
  // version; Publish is what makes it the live one.
  //
  // The `model` field is required by the stored-agent row and then ignored —
  // overrides only ever replace instructions and tools, never the model.
  // -------------------------------------------------------------------
  const instructions = await supportAgent.getInstructions();
  // Reached only on a fresh database (the dataset check above returns early
  // otherwise), so this fixed id cannot collide with an existing agent row.
  await editor.agent.create({
    id: 'support-agent',
    name: 'Nimbus Support Agent',
    description: 'Answers Nimbus product questions from the documentation.',
    instructions: typeof instructions === 'string' ? instructions : String(instructions),
    model: JUDGE_MODEL,
  } as any);

  const agentsStore: any = await (mastra.getStorage() as any).getStore('agents');
  const { versions } = await agentsStore.listVersions({ agentId: 'support-agent' });
  const v1 = versions.find((v: any) => v.versionNumber === 1);
  if (!v1) {
    throw new Error(
      `expected support-agent v1 to exist after create, found: ${versions.map((v: any) => v.versionNumber).join(', ') || 'no versions'}`,
    );
  }
  await agentsStore.update({ id: 'support-agent', status: 'published', activeVersionId: v1.id });
  console.log(`  agent "support-agent" — v1 snapshotted from code and published`);

  await seedStoredSkills();

  // Flush the trace spans this seed just produced. Spans export in batches and
  // this script is about to exit, so without the flush the Observability →
  // Traces view is empty on a fresh clone — silently, with no error. Doing it
  // here means the trace panel has something to show before anyone has chatted.
  await observability.shutdown();

  console.log(`
Done. Now:

  pnpm dev     # API + Studio UI, both on :4111

Then open http://localhost:4111 → Evaluation → Datasets → "nimbus-support-qa".
The three experiments are listed newest-first; the middle one is the regression.

The agent's Editor tab opens on v1 — the prompt as the code has it, published.
Edit it there and save to create v2; publish to make v2 the one users get.

Chat with the agent too — it is wired for live scoring, so each reply is graded
as it arrives and shows up alongside the dataset runs.`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
