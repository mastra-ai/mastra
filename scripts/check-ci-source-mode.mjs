#!/usr/bin/env node
import { readFileSync } from 'node:fs';

const checkedWorkflows = [
  '.github/workflows/lint.yml',
  '.github/workflows/prebuild.yml',
  '.github/workflows/test-suite.yml',
  '.github/workflows/vitest-all.yml',
  '.github/workflows/secrets.e2e.yml',
  '.github/workflows/secrets.test-memory.yml',
  '.github/workflows/secrets.test-combined-stores.yml',
  '.github/workflows/secrets.test-workspaces.yml',
  '.github/workflows/test-workspaces.yml',
];

const allowedBuilds = new Set(['.github/workflows/prebuild.yml:73']);

const buildPattern = /^\s*run:\s+.*\bpnpm\s+(?:build|turbo\b.*\bbuild\b)|^\s*run:\s+.*\bturbo\s+build\b/;
const violations = [];

for (const workflow of checkedWorkflows) {
  const lines = readFileSync(workflow, 'utf8').split('\n');
  for (const [index, line] of lines.entries()) {
    const location = `${workflow}:${index + 1}`;
    if (buildPattern.test(line) && !allowedBuilds.has(location)) {
      violations.push(`${location}: ${line.trim()}`);
    }
  }
}

if (violations.length > 0) {
  console.error('CI test workflows must run from source mode. Unexpected build commands found:');
  for (const violation of violations) console.error(`- ${violation}`);
  process.exit(1);
}

console.log('CI source-mode workflow check passed.');
