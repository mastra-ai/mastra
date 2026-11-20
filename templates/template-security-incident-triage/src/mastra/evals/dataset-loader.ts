import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  assertDatasetContract,
  sha256Text,
  type SecurityEvalExpected,
  type SecurityEvalInput,
  type SecurityEvalManifest,
} from './dataset-contract.js';

export const securityEvalDatasetDirectory = join(dirname(fileURLToPath(import.meta.url)), 'datasets', 'v1');

function parseJsonLines(text: string): unknown[] {
  return text
    .trim()
    .split('\n')
    .filter(Boolean)
    .map(line => JSON.parse(line) as unknown);
}

export async function loadSecurityEvalDataset(
  options: Readonly<{ datasetDirectory?: string; projectRoot?: string }> = {},
): Promise<
  Readonly<{
    manifest: SecurityEvalManifest;
    inputs: readonly SecurityEvalInput[];
    expected: readonly SecurityEvalExpected[];
  }>
> {
  const directory = options.datasetDirectory ?? securityEvalDatasetDirectory;
  const [manifestText, inputText, expectedText] = await Promise.all([
    readFile(join(directory, 'manifest.json'), 'utf8'),
    readFile(join(directory, 'inputs.jsonl'), 'utf8'),
    readFile(join(directory, 'expected.jsonl'), 'utf8'),
  ]);
  const loaded = assertDatasetContract({
    manifest: JSON.parse(manifestText) as unknown,
    inputs: parseJsonLines(inputText),
    expected: parseJsonLines(expectedText),
    inputText,
    expectedText,
  });
  await assertProductProvenance(
    loaded.manifest,
    options.projectRoot ?? join(securityEvalDatasetDirectory, '..', '..', '..', '..', '..'),
    directory,
  );
  return loaded;
}

async function assertProductProvenance(
  manifest: SecurityEvalManifest,
  root: string,
  datasetDirectory: string,
): Promise<void> {
  // v1 is an immutable historical replay, so its prompt hash binds the
  // response planner as recorded, not the live file, whose model default
  // moves when providers retire models.
  const prompt = await readFile(join(datasetDirectory, 'prompt', 'response-planner.ts.txt'), 'utf8');
  if (sha256Text(prompt) !== manifest.provenance.promptHash)
    throw new Error('SECURITY_EVAL_DATASET_PROMPT_PROVENANCE_INVALID');
  const replay = await readFile(join(root, manifest.provenance.replayPath), 'utf8');
  if (sha256Text(replay) !== manifest.provenance.replayHash)
    throw new Error('SECURITY_EVAL_DATASET_REPLAY_PROVENANCE_INVALID');
  for (const runbook of manifest.provenance.runbooks) {
    const source = {
      'RB-IDENTITY-001': 'unauthorized-privilege-change.md',
      'RB-IDENTITY-002': 'disallowed-country-login.md',
      'RB-IDENTITY-003': 'unknown-device-login.md',
    }[runbook.id];
    if (!source) throw new Error('SECURITY_EVAL_DATASET_RUNBOOK_PROVENANCE_INVALID');
    // v1 is an immutable historical replay. Its approved hashes bind these
    // snapshots; current policy is exercised by eval:check's live workflow.
    const text = await readFile(join(datasetDirectory, 'runbooks', source), 'utf8');
    if (sha256Text(text) !== runbook.hash) throw new Error('SECURITY_EVAL_DATASET_RUNBOOK_PROVENANCE_INVALID');
  }
}
