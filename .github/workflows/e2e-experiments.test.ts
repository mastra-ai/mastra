import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, test } from 'vitest';

const workflowRoot = import.meta.dirname;

describe('experiments workflow contract', () => {
  test('routes the workflow_call experiments input directly to the experiments job', async () => {
    const contents = await readFile(resolve(workflowRoot, 'e2e-tests.yml'), 'utf8');
    expect(contents).toContain('experiment_worker_e2e_changed:');
    expect(contents).toContain('if: inputs.experiment_worker_e2e_changed');
  });

  test.each(['e2e-tests.yml', 'e2e-experiment-worker.yml'])(
    '%s verifies an immutable registry snapshot at the consumer boundary',
    async workflow => {
      const contents = await readFile(resolve(workflowRoot, workflow), 'utf8');
      expect(contents).toContain('registry-snapshot.tar');
      expect(contents).toContain('registry-artifact-digest.cjs');
      expect(contents).toContain('MASTRA_E2E_REGISTRY_ARTIFACT_PATH:');
      expect(contents).toContain('MASTRA_E2E_REGISTRY_ARTIFACT_DIGEST:');
      expect(contents).toContain('handoff-digest.txt');
    },
  );
});
