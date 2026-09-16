import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import type { ScenarioDefinition } from '../scenarios/index.js';

export async function recordAssertionEvidence(
  scenario: ScenarioDefinition,
  evidence: Record<string, unknown>,
): Promise<void> {
  const reportDirectory = process.env.MASTRA_EXPERIMENT_E2E_REPORT_DIR;
  if (!reportDirectory) return;

  const expected = [...scenario.assertions].sort();
  const actual = Object.keys(evidence).sort();
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(
      `Assertion evidence mismatch for ${scenario.id}: expected ${expected.join(', ')}, received ${actual.join(', ')}`,
    );
  }

  const reportRoot = resolve(reportDirectory);
  await mkdir(reportRoot, { recursive: true });
  await writeFile(
    join(reportRoot, `${scenario.id}.assertions.json`),
    `${JSON.stringify({ schemaVersion: 1, scenarioId: scenario.id, evidence }, null, 2)}\n`,
  );
}
