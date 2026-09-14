import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import test from 'node:test';

const WORKFLOWS_DIR = resolve('.github/workflows');
const PINNED_ACTION = /@[0-9a-f]{40}$/;

function getWorkflowFiles(directory = WORKFLOWS_DIR) {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) return getWorkflowFiles(path);
    return /\.ya?ml$/.test(entry.name) ? [path] : [];
  });
}

test('all external GitHub Actions are pinned to full commit SHAs', () => {
  const failures = [];

  for (const workflowFile of getWorkflowFiles()) {
    const file = relative(WORKFLOWS_DIR, workflowFile);
    const lines = readFileSync(workflowFile, 'utf8').split(/\r?\n/);
    lines.forEach((line, index) => {
      const match = line.match(/\buses:\s*['"]?([^'"#\s]+)/);
      if (!match) return;

      const target = match[1];
      if (target.startsWith('./') || target.startsWith('docker://')) return;
      if (!PINNED_ACTION.test(target)) {
        failures.push(`${file}:${index + 1}: ${target}`);
      }
    });
  }

  assert.deepEqual(failures, [], `Floating action references:\n${failures.join('\n')}`);
});
