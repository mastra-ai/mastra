/**
 * Exercise 12 — Editing the prompt, and proving the edit was an improvement.
 *
 * Every exercise so far treated the agent's prompt as a constant. It is the
 * single thing teams change most often, usually in a hurry, usually because
 * someone complained about tone — and almost always without measuring it.
 *
 * `@mastra/editor` turns the prompt into a **version**: a stored, numbered
 * snapshot with a diff and a timestamp. That matters here for exactly one
 * reason — an experiment can be *pinned* to a version. Which turns "I think
 * the new prompt reads better" into a number you can put in a pull request.
 *
 * The loop this exercise closes:
 *
 *   edit the prompt  →  a version is written  →  run the dataset against that
 *   version          →  compare it to the previous version's run
 *
 * In Studio you do the first step in a textarea. Here it is `editor.agent`,
 * which is the same API the Studio form posts to — so what you watch happen
 * in the browser during the demo is what runs below.
 *
 * The edit under test is not a strawman. "Be friendlier, stop overwhelming
 * people with numbers" is a real request from a real support lead, it sounds
 * unambiguously good, and it quietly destroys a factual-accuracy metric.
 *
 * No API key required.
 */
import { compareExperiments } from '@mastra/core/datasets';
import { buildSupportAgent, SUPPORT_INSTRUCTIONS } from '@workshop/shared/agent';
import { SUPPORT_QA } from '@workshop/shared/data';
import { answerAccuracyScorer } from '@workshop/shared/scorers';

/** The well-meaning edit. Tone-focused, specifics-hostile. */
const FRIENDLIER_INSTRUCTIONS = `You are a support agent for Nimbus, a file-sync service.
Answer warmly and keep it brief. Avoid overwhelming the customer with specific
numbers — reassure them and point them at their account settings instead.`;

/**
 * A stored agent needs a model column even when the model is never used.
 *
 * Overrides only ever replace `instructions` and `tools`; `model`, `memory`
 * and `scorers` stay code-defined, because they hold live objects that cannot
 * survive a round trip through a database row. So this value is recorded and
 * ignored — the agent below keeps running on its deterministic mock, which is
 * precisely why a score that moves between versions moved because of the
 * prompt and nothing else.
 */
const RECORDED_MODEL = 'openai/gpt-5-mini';

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const scoresOf = (summary: { results?: { scores?: { score?: number | null }[] }[] }) =>
  (summary.results ?? []).map(r => r.scores?.[0]?.score ?? 0);

async function main() {
  const { mastra, editor, cleanup } = buildSupportAgent({ editor: true });

  if (!editor) throw new Error('editor was not registered');

  try {
    const dataset = await mastra.datasets.create({
      name: 'nimbus-support-qa',
      description: 'Support questions with known-good answers',
    });
    await dataset.addItems({
      items: SUPPORT_QA.map(item => ({
        input: item.input,
        groundTruth: item.groundTruth,
        metadata: { topic: item.id },
      })),
    });

    // -------------------------------------------------------------------
    // (a) Version 1 — the prompt as shipped.
    //
    // Studio does *not* do this for you, and the omission is easy to miss:
    // open an unversioned agent, change the prompt, hit "Save New Version",
    // and the version you get is v1 — containing the edit. The prompt that
    // was actually in the repository is now nowhere in the version history,
    // and there is nothing to compare the edit against.
    //
    // So snapshot the code prompt first. (The Studio seed does exactly this,
    // which is why the workshop's agent opens on a v1 you did not type.)
    // -------------------------------------------------------------------
    await editor.agent.create({
      id: 'support-agent',
      name: 'Nimbus Support Agent',
      instructions: SUPPORT_INSTRUCTIONS,
      model: RECORDED_MODEL,
    } as any);

    // -------------------------------------------------------------------
    // (b) Version 2 — the edit. One `update`, one new version.
    //
    // `update` diffs against the latest version and only writes a new one if
    // something actually changed. Saving an unmodified form is a no-op rather
    // than a v3 identical to v2 — which is why the version list stays
    // readable instead of filling up with noise.
    // -------------------------------------------------------------------
    await editor.agent.update({
      id: 'support-agent',
      instructions: FRIENDLIER_INSTRUCTIONS,
    } as any);

    const agentsStore: any = await (mastra.getStorage() as any).getStore('agents');
    const { versions } = await agentsStore.listVersions({ agentId: 'support-agent' });
    const byNumber = (n: number) => versions.find((v: any) => v.versionNumber === n);
    const v1 = byNumber(1);
    const v2 = byNumber(2);

    console.log('── version history ──');
    for (const v of [...versions].sort((a: any, b: any) => a.versionNumber - b.versionNumber)) {
      console.log(
        `  v${v.versionNumber}  changed: ${(v.changedFields ?? []).join(', ') || '—'}  "${v.changeMessage}"`,
      );
    }

    // -------------------------------------------------------------------
    // Aside — saving is not shipping.
    //
    // Nothing below depends on it, because pinning by version id addresses a
    // version directly. But it decides what your *users* get, so it is worth
    // knowing before you demo this: a stored agent carries a status and an
    // `activeVersionId`, and normal agent resolution reads the version at
    // `status: 'published'`. Saving a new version leaves both untouched.
    //
    // In Studio that is two buttons: "Save New Version" writes v2 and changes
    // nothing for anyone; "Publish" is what points the live agent at it. The
    // banner in the editor says saving is enough for the chat pane to pick up
    // your changes — it is not; the chat pane resolves published too.
    // -------------------------------------------------------------------

    // -------------------------------------------------------------------
    // (c) Run the dataset against each version.
    //
    // Note what is NOT here: a `task` function. Everywhere else in this
    // workshop the experiment runs a closure we wrote, and a closure captures
    // whatever agent it captured — there is no version in that picture.
    //
    // Naming a `targetType`/`targetId` instead hands resolution to Mastra,
    // and that is the only form `agentVersion` can act on. Pinning is a
    // property of the registry path, not of experiments in general.
    // -------------------------------------------------------------------
    console.log('\n── running each version against the dataset ──');

    const runVersion = async (label: string, version: any) => {
      const summary = await dataset.startExperiment({
        name: label,
        description: `support-agent v${version.versionNumber}`,
        targetType: 'agent',
        targetId: 'support-agent',
        agentVersion: version.id,
        scorers: [answerAccuracyScorer],
      });
      console.log(`  ${label.padEnd(14)} mean ${mean(scoresOf(summary)).toFixed(3)}`);
      return summary;
    };

    const runV1 = await runVersion('v1-shipped', v1);
    const runV2 = await runVersion('v2-friendlier', v2);

    // -------------------------------------------------------------------
    // (d) The verdict.
    //
    // Same call as exercise 8 — the only difference is what the two
    // experiments differ *by*. There, a code change. Here, a prompt edit that
    // never touched the repository.
    // -------------------------------------------------------------------
    const comparison = await compareExperiments(mastra, {
      experimentIdA: runV1.experimentId,
      experimentIdB: runV2.experimentId,
      thresholds: { 'answer-accuracy': { value: 0.05, direction: 'higher-is-better' } },
    });

    console.log('\n── comparison ──');
    for (const [scorerId, cmp] of Object.entries(comparison.scorers)) {
      const delta = cmp.delta >= 0 ? `+${cmp.delta.toFixed(3)}` : cmp.delta.toFixed(3);
      console.log(
        `  ${scorerId.padEnd(18)} ${cmp.statsA.avgScore.toFixed(3)} → ${cmp.statsB.avgScore.toFixed(3)}` +
          `  (${delta})  ${cmp.regressed ? 'REGRESSED' : 'ok'}`,
      );
    }
    console.log(`  hasRegression: ${comparison.hasRegression}`);

    // Which rows moved, and to what. The interesting part is that the losses
    // are exactly the questions whose answer *is* a number.
    const questionById = new Map(runV1.results.map(r => [r.itemId, String(r.input)]));
    console.log('\n── per-item ──');
    for (const item of comparison.items) {
      const a = item.scoresA['answer-accuracy'];
      const b = item.scoresB['answer-accuracy'];
      if (a === b) continue;
      console.log(`  ${String(a)} → ${String(b)}   ${(questionById.get(item.itemId) ?? item.itemId).slice(0, 52)}`);
    }

    // -------------------------------------------------------------------
    // (e) The trap, and it is a quiet one.
    //
    // Run the same dataset with no `agentVersion` and the experiment resolves
    // the agent straight out of the code registry — no overrides, no stored
    // versions, no error, no warning. It scores the prompt in the repository,
    // which by this point is neither of the two prompts anyone has been
    // arguing about.
    //
    // The failure mode in the wild: prompts are edited in the browser for
    // weeks, CI keeps running experiments against the code default, and the
    // dashboard stays green while the deployed agent drifts. If your eval
    // runs are not pinned to a version, they are not evaluating what your
    // users are talking to.
    // -------------------------------------------------------------------
    const unpinned = await dataset.startExperiment({
      name: 'unpinned',
      targetType: 'agent',
      targetId: 'support-agent',
      scorers: [answerAccuracyScorer],
    });

    console.log('\n── the trap ──');
    console.log(`  v1-shipped     mean ${mean(scoresOf(runV1)).toFixed(3)}`);
    console.log(`  v2-friendlier  mean ${mean(scoresOf(runV2)).toFixed(3)}`);
    console.log(`  unpinned       mean ${mean(scoresOf(unpinned)).toFixed(3)}   ← the code prompt, silently`);

    console.log(`
Takeaway: a prompt edit is a change like any other, and the only reason it
feels safe is that nothing measures it. Pin the experiment to a version and it
is as measurable as a refactor — with a diff, a number, and a regression flag.`);
  } finally {
    cleanup();
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
