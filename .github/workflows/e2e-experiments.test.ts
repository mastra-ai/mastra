import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, test } from 'vitest';

const workflowRoot = import.meta.dirname;

function mappingBlock(contents: string, key: string, parentIndent = -1) {
  const lines = contents.split('\n');
  const start = lines.findIndex(line => {
    const indent = line.length - line.trimStart().length;
    return indent > parentIndent && line.trimStart().startsWith(`${key}:`);
  });
  expect(start, `Expected YAML key ${key}`).toBeGreaterThanOrEqual(0);

  const indent = lines[start]!.length - lines[start]!.trimStart().length;
  const end = lines.findIndex((line, index) => {
    if (index <= start || line.trim() === '') return false;
    return line.length - line.trimStart().length <= indent;
  });
  return lines.slice(start, end === -1 ? undefined : end).join('\n');
}

function namedStep(contents: string, name: string) {
  const lines = contents.split('\n');
  const start = lines.findIndex(line => line.trim() === `- name: ${name}`);
  expect(start, `Expected workflow step ${name}`).toBeGreaterThanOrEqual(0);

  const indent = lines[start]!.length - lines[start]!.trimStart().length;
  const end = lines.findIndex((line, index) => {
    if (index <= start || line.trim() === '') return false;
    const lineIndent = line.length - line.trimStart().length;
    return lineIndent === indent && line.trimStart().startsWith('- ');
  });
  return lines.slice(start, end === -1 ? undefined : end).join('\n');
}

describe('experiments workflow contract', () => {
  test('routes the workflow_call experiments input directly to the experiments job', async () => {
    const contents = await readFile(resolve(workflowRoot, 'e2e-tests.yml'), 'utf8');
    const workflowCall = mappingBlock(mappingBlock(contents, 'on'), 'workflow_call');
    const inputs = mappingBlock(workflowCall, 'inputs');
    const experimentsInput = mappingBlock(inputs, 'experiment_worker_e2e_changed');
    expect(experimentsInput).toContain('type: boolean');

    const jobs = mappingBlock(contents, 'jobs');
    const experimentsJob = mappingBlock(jobs, 'e2e-experiments');
    expect(experimentsJob).toContain('if: inputs.experiment_worker_e2e_changed');
  });

  test.each([
    {
      workflow: 'e2e-tests.yml',
      producer: 'Create immutable registry snapshot',
      consumer: 'Run strict published-registry PR tier',
    },
    {
      workflow: 'e2e-experiment-worker.yml',
      producer: 'Create immutable registry snapshot',
      consumer: 'Run PR tier',
    },
  ])(
    '$workflow verifies an immutable registry snapshot at the consumer boundary',
    async ({ workflow, producer, consumer }) => {
      const contents = await readFile(resolve(workflowRoot, workflow), 'utf8');
      const producerStep = namedStep(contents, producer);
      expect(producerStep).toContain('registry-snapshot.tar');
      expect(producerStep).toContain('registry-artifact-digest.cjs');
      expect(producerStep).toContain('handoff-digest.txt');

      const extractionStep = namedStep(contents, 'Extract immutable registry snapshot');
      expect(extractionStep).toContain('registry-snapshot.tar');

      const consumerStep = namedStep(contents, consumer);
      expect(consumerStep).toContain('MASTRA_E2E_REGISTRY_ARTIFACT_PATH:');
      expect(consumerStep).toContain('MASTRA_E2E_REGISTRY_ARTIFACT_DIGEST:');
    },
  );
});
