/**
 * Run two prompt configurations over the same reconstructed cycles and print the
 * difference in the knowledge they produce.
 *
 *   pnpm simulate:ab -- \
 *     --input postgres://user:local@127.0.0.1:55432/simulate_input \
 *     --target-prefix postgres://user:local@127.0.0.1:55432/simulate_arm \
 *     --arm-a ./arm-a.txt --arm-b ./arm-b.txt
 *
 * Arms differ only in the instructions appended to the built-in capture and curate
 * prompts. Everything else — models, cadence, scopes, cycles — is identical by
 * construction, and a third "control" arm re-runs arm A's configuration so the
 * A-vs-B numbers can be read against the model's own nondeterminism.
 */
import { readFileSync, writeFileSync } from 'node:fs';

import { diffArms } from './diff';
import type { KnowledgeDiff } from './diff';
import { armConfigHash, assertArmsComparable } from './drive';
import type { ArmConfig } from './drive';
import { armDatabaseUrl, cadenceOrOff, parseFlags, positiveInt, recreateDatabase, runArm, snapshotArm } from './replay';

function readInstructions(path: string | undefined): string | undefined {
  return path ? readFileSync(path, 'utf8').trim() : undefined;
}

function indentBlock(text: string, prefix: string): string {
  return text
    .split('\n')
    .map(line => `${prefix}${line}`)
    .join('\n');
}

function printDiff(label: string, diff: KnowledgeDiff) {
  console.log(`--- ${label} ---`);
  console.log(`  nodes only in first : ${diff.onlyInA.length}`);
  console.log(`  nodes only in second: ${diff.onlyInB.length}`);
  console.log(`  matched nodes       : ${diff.matchedNodes.length}`);
  console.log(`  records added       : ${diff.addedRecords}`);
  console.log(`  records removed     : ${diff.removedRecords}`);
  console.log(`  records changed     : ${diff.changedRecords}`);

  // Aggregate counts say how MUCH diverged; only the per-node text says WHETHER the
  // change made the knowledge better, worse, or merely different.
  for (const entry of diff.perNode) {
    const presence =
      entry.presence === 'both' ? '' : entry.presence === 'only-a' ? ' (only in first arm)' : ' (only in second arm)';
    console.log(`  node "${entry.node}"${presence}:`);
    for (const pair of entry.changed) {
      console.log(`    ~ changed:`);
      console.log(indentBlock(`a: ${pair.a}`, '      '));
      console.log(indentBlock(`b: ${pair.b}`, '      '));
    }
    for (const text of entry.removed) console.log(indentBlock(`- ${text}`, '    '));
    for (const text of entry.added) console.log(indentBlock(`+ ${text}`, '    '));
  }
}

async function main() {
  const flags = parseFlags(process.argv.slice(2));
  const args = {
    get: (key: string) => flags.get(key)?.at(-1),
    getAll: (key: string) => flags.get(key) ?? [],
  };

  const input = args.get('input');
  const targetPrefix = args.get('target-prefix');
  if (!input || !targetPrefix) {
    throw new Error('Usage: simulate:ab --input <local-pg-url> --target-prefix <local-pg-url-without-suffix>');
  }

  const model = args.get('model') ?? 'openai/gpt-5-mini';
  const captureModel = args.get('capture-model') ?? model;
  const curateModel = args.get('curate-model') ?? model;
  const embedder = args.get('embedder') ?? 'google/gemini-embedding-001';
  const organizationId = args.get('org') ?? 'simulate';
  const onlyThreads = args.getAll('thread-id');
  const runControl = args.get('control') !== 'false';
  const reportPath = args.get('report');

  const shared = {
    curationCadence: cadenceOrOff('cadence', args.get('cadence'), 1),
    defaultScope: 'resource' as const,
    maxScope: 'resource' as const,
    curateMaxSteps: positiveInt('curate-max-steps', args.get('curate-max-steps'), 25),
  };
  const armA: ArmConfig = {
    ...shared,
    name: 'a',
    prompts: { capture: readInstructions(args.get('arm-a')), curate: readInstructions(args.get('arm-a-curate')) },
  };
  const armB: ArmConfig = {
    ...shared,
    name: 'b',
    prompts: { capture: readInstructions(args.get('arm-b')), curate: readInstructions(args.get('arm-b-curate')) },
  };
  // Refuses to run if anything outside the prompt fields differs between arms.
  assertArmsComparable(armA, armB);
  // The control re-runs arm A's prompts; only the arm name (and its database) differ.
  const control: ArmConfig = { ...armA, name: 'control' };

  const targets = {
    a: armDatabaseUrl(targetPrefix, 'a'),
    b: armDatabaseUrl(targetPrefix, 'b'),
    control: armDatabaseUrl(targetPrefix, 'control'),
  };

  const arms: [ArmConfig, string][] = [
    [armA, targets.a],
    [armB, targets.b],
    ...(runControl ? ([[control, targets.control]] as [ArmConfig, string][]) : []),
  ];

  let cyclesReplayed = 0;
  let threadsReplayed = 0;
  const outcomes: Record<string, Record<string, number>> = {};

  for (const [arm, target] of arms) {
    // Fresh database per arm: the curation cursor, semantic outbox idempotency keys
    // and CAS versions would otherwise leak from one arm into the next.
    await recreateDatabase(target);
    const result = await runArm({
      arm,
      inputUrl: input,
      targetUrl: target,
      organizationId,
      captureModel,
      curateModel,
      embedder,
      onlyThreads,
    });
    outcomes[arm.name] = result.outcomes;
    cyclesReplayed = result.cyclesReplayed;
    threadsReplayed = result.threadsReplayed;
  }

  const snapshotA = await snapshotArm(targets.a);
  const snapshotB = await snapshotArm(targets.b);
  const abDiff = diffArms(snapshotA, snapshotB);
  const controlDiff = runControl ? diffArms(snapshotA, await snapshotArm(targets.control)) : undefined;

  printDiff('A vs B (prompt change)', abDiff);
  if (controlDiff) printDiff('A vs A (control: model noise floor)', controlDiff);

  if (reportPath) {
    // The full structured diff — everything printDiff shows plus the matched-node lists —
    // for downstream tooling that wants more than the greppable summary lines.
    const report = {
      model: { capture: captureModel, curate: curateModel },
      armConfigHashes: { a: armConfigHash(armA), b: armConfigHash(armB) },
      threadsReplayed,
      cyclesReplayed,
      abDiff,
      controlDiff: controlDiff ?? null,
      curationOutcomes: outcomes,
    };
    writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
    console.log(`REPORT=${reportPath}`);
  }

  console.log(`SOURCE_THREADS=${threadsReplayed}`);
  console.log(`CYCLES_REPLAYED=${cyclesReplayed}`);
  console.log(`MODEL=${captureModel}|${curateModel}`);
  console.log(`ARM_A_CONFIG_HASH=${armConfigHash(armA)}`);
  console.log(`ARM_B_CONFIG_HASH=${armConfigHash(armB)}`);
  console.log(`ARM_A_NODES=${abDiff.aNodeCount}`);
  console.log(`ARM_B_NODES=${abDiff.bNodeCount}`);
  console.log(`ARM_A_RECORDS=${abDiff.aRecordCount}`);
  console.log(`ARM_B_RECORDS=${abDiff.bRecordCount}`);
  console.log(`ONLY_IN_A=${abDiff.onlyInA.length}`);
  console.log(`ONLY_IN_B=${abDiff.onlyInB.length}`);
  console.log(`CHANGED_RECORDS=${abDiff.changedRecords}`);
  console.log(`CONTROL_CHANGED_RECORDS=${controlDiff ? controlDiff.changedRecords : 'n/a'}`);
  for (const [arm, counts] of Object.entries(outcomes)) {
    for (const [outcome, count] of Object.entries(counts)) {
      console.log(`CURATION_${arm.toUpperCase()}_${outcome.toUpperCase()}=${count}`);
    }
  }

  // An arm whose curator never completed holds raw capture output. Its knowledge is at a
  // different stage of the pipeline than an arm that curated, so the diff measures that
  // difference as much as it measures the prompt. Say so instead of letting the numbers imply
  // a clean comparison. With the cadence off every arm is uncurated by design, so the
  // warning would be noise — the run asked for a raw-capture comparison.
  if (shared.curationCadence !== false) {
    const uncurated = Object.entries(outcomes)
      .filter(([, counts]) => !counts.ran)
      .map(([arm]) => arm);
    console.log(`UNCURATED_ARMS=${uncurated.length ? uncurated.join(',') : 'none'}`);
    for (const arm of uncurated) {
      console.log(
        `WARNING: arm ${arm} completed 0 curations — its knowledge is uncurated capture output and the diff is not a curated-vs-curated comparison.`,
      );
    }
  }
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
