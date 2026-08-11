#!/usr/bin/env node
/**
 * CLI entry for the session token-composition rollup.
 *
 * Usage: tsx scripts/token-composition-rollup.ts <exported-spans.json> [--json]
 *
 * Input is a JSON array of exported spans (the shape @mastra/observability
 * exporters emit). Output is a human-readable report, or raw JSON with --json.
 */

import { readFileSync } from 'node:fs';

import {
  formatTokenCompositionRollup,
  rollupTokenComposition,
} from '../src/observability/rollup/token-composition-rollup';

function main() {
  const args = process.argv.slice(2);
  const asJson = args.includes('--json');
  const file = args.find(arg => !arg.startsWith('--'));

  if (!file) {
    console.error('usage: token-composition-rollup <exported-spans.json> [--json]');
    process.exit(1);
  }

  const parsed = JSON.parse(readFileSync(file, 'utf-8'));
  const spans = Array.isArray(parsed) ? parsed : (parsed.spans ?? []);
  const rollup = rollupTokenComposition(spans);

  console.log(asJson ? JSON.stringify(rollup, null, 2) : formatTokenCompositionRollup(rollup));

  if (rollup.steps.total === 0) {
    // An all-zero report from a mis-exported session reads exactly like a real
    // finding. Fail loudly instead.
    console.error(
      `\nno MODEL_STEP spans found in ${file} — check the exporter is wired and MODEL_STEP is not in excludeSpanTypes`,
    );
    process.exit(2);
  }

  if (rollup.steps.uninstrumented === rollup.steps.total) {
    // Every span predates the instrumentation: the region table above is an
    // all-zero table, which reads like a finding rather than a stale capture.
    console.error(`\nno MODEL_STEP span in ${file} carries promptRegions — these spans predate the instrumentation`);
    process.exit(2);
  }
}

main();
