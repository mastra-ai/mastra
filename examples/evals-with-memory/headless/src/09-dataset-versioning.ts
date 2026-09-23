/**
 * Exercise 9 — Dataset versioning, and the number that lies.
 *
 * Datasets are versioned, and every edit creates a new version rather than
 * overwriting the old one. Items are stored SCD-2 style: editing an item closes
 * off the previous row (`validTo`) and writes a new one, so the dataset as it
 * stood at any past version can still be read back exactly.
 *
 * The reason this matters is not bookkeeping. It is that **a dataset edit and a
 * model improvement look identical in a score**. Both make the number go up.
 * Without versioning you cannot tell them apart, and the failure mode is
 * embarrassing: you congratulate yourself for a fix that was really you
 * rewording a question your agent kept failing.
 *
 * This exercise manufactures exactly that lie, then shows the two APIs that
 * catch it — pinning a run to an old version, and item history.
 *
 * No API key required.
 */
import { buildSupportAgent } from '@workshop/shared/agent';
import { SUPPORT_QA } from '@workshop/shared/data';
import { answerAccuracyScorer } from '@workshop/shared/scorers';

async function main() {
  const { mastra, agent, cleanup } = buildSupportAgent();

  try {
    const dataset = await mastra.datasets.create({
      name: 'nimbus-support-qa',
      description: 'Support questions with known-good answers',
    });

    const created = await dataset.addItems({
      items: SUPPORT_QA.map(item => ({
        input: item.input,
        groundTruth: item.groundTruth,
        metadata: { topic: item.id },
      })),
    });

    const ask = async (input: unknown) => (await agent.generate(String(input))).text;
    const run = async (label: string, version?: number) => {
      const summary = await dataset.startExperiment({
        name: label,
        ...(version !== undefined ? { version } : {}),
        scorers: [answerAccuracyScorer],
        task: async ({ input }) => ask(input),
      });
      const scores = summary.results.map(r => r.scores[0]?.score ?? 0);
      const mean = scores.reduce((a, b) => a + b, 0) / (scores.length || 1);
      console.log(`  ${label.padEnd(26)} items=${summary.totalItems}  mean=${mean.toFixed(3)}`);
      return mean;
    };

    // -------------------------------------------------------------------
    // Version 1: the dataset as authored, including the row the agent is
    // known to fail (it has no knowledge matching "phone number for login
    // codes", so it says it does not know).
    // -------------------------------------------------------------------
    console.log('── version 1 ──');
    const meanV1 = await run('experiment on v1');

    // -------------------------------------------------------------------
    // Now the edit. Someone looks at the failing row, decides the question is
    // "unfair", and rewords it to use vocabulary the agent actually has.
    //
    // Nothing about the agent changes. Not one token of its instructions, not
    // its model, not its tools.
    // -------------------------------------------------------------------
    const failing = created.find(item => (item.metadata as any)?.topic === 'sms-2fa');
    if (!failing) throw new Error('expected the sms-2fa item to exist');

    await dataset.updateItem({
      itemId: failing.id,
      input: 'Does two-factor authentication work over SMS?',
      groundTruth: 'not SMS',
    });
    console.log('\n  (edited one question — the agent was not touched)');

    const versions = await dataset.listVersions();
    console.log(`\n  versions now: ${versions.versions.map(v => v.version).join(', ')}`);

    // -------------------------------------------------------------------
    // The lie, and the correction.
    //
    // Running "the dataset" now means running version 2 — and the score jumps.
    // Pinning to version 1 reproduces the old number exactly, which is the
    // whole point: it proves the agent is unchanged and the movement came
    // entirely from the data.
    // -------------------------------------------------------------------
    console.log('\n── after the edit ──');
    const meanV2 = await run('experiment on latest (v2)');
    const meanPinned = await run('experiment pinned to v1', 1);

    console.log(
      `\n  v1 ${meanV1.toFixed(3)} → v2 ${meanV2.toFixed(3)}  (looks like a +${(meanV2 - meanV1).toFixed(3)} win)\n` +
        `  but pinned to v1 the agent still scores ${meanPinned.toFixed(3)} — unchanged.\n` +
        '  The improvement was entirely in the question, not the answer.',
    );

    // -------------------------------------------------------------------
    // Item history is the audit trail. SCD-2: the old row is not overwritten,
    // it is closed off with a `validTo` and superseded. So you can always ask
    // "what did this item look like when that experiment ran?"
    // -------------------------------------------------------------------
    console.log('\n── history of the edited item ──');
    const history = await dataset.getItemHistory({ itemId: failing.id });
    for (const row of history) {
      const open = row.validTo === null ? 'current' : `closed@${row.validTo}`;
      console.log(`  v${row.datasetVersion}  ${open.padEnd(14)} ${String(row.input).slice(0, 46)}`);
    }

    // Reading the dataset at a past version works the same way.
    const atV1 = (await dataset.listItems({ version: 1 })) as any[];
    const atV2 = (await dataset.listItems({ version: 2 })) as any[];
    console.log(`\n  listItems({version: 1}) → ${atV1.length} items`);
    console.log(`  listItems({version: 2}) → ${atV2.length} items`);

    console.log(
      '\n  Worth saying out loud: editing a dataset is not forbidden — datasets\n' +
        '  should improve. What is forbidden is editing one and then comparing\n' +
        '  across the edit without noticing. Exercise 8 shows the warning that\n' +
        '  catches it; this is the API that lets you prove which side moved.',
    );
  } finally {
    cleanup();
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
