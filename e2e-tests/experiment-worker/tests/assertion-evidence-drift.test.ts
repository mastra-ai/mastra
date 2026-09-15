import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, test } from 'vitest';
import * as scenarioDefinitions from '../scenarios/index.js';
import type { ScenarioDefinition } from '../scenarios/index.js';

const suiteRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const producerFiles = [
  'full-workspace-lifecycle.test.ts',
  'installed-boundary-negative.test.ts',
  'minimal-agent.test.ts',
  'native-duckdb.test.ts',
  'postgres-lifecycle.test.ts',
  'runtime-resources.test.ts',
  'target-process.test.ts',
];

const scenariosByExport = new Map<string, ScenarioDefinition>();
for (const [exportName, value] of Object.entries(scenarioDefinitions)) {
  if (typeof value === 'object' && value !== null && !Array.isArray(value) && 'assertions' in value) {
    scenariosByExport.set(exportName, value as ScenarioDefinition);
  }
}

describe('assertion evidence producers', () => {
  test('use the exact assertion IDs declared by their scenarios', async () => {
    const checked = new Set<string>();

    for (const file of producerFiles) {
      const source = await readFile(join(suiteRoot, 'tests', file), 'utf8');
      const calls = source.matchAll(/recordAssertionEvidence\((\w+),\s*\{([\s\S]*?)\n\s*\}\);/g);
      for (const call of calls) {
        const [, exportName, body] = call;
        const scenario = scenariosByExport.get(exportName!);
        expect(scenario, `${file}: unknown scenario export ${exportName}`).toBeDefined();
        const actual = [...body!.matchAll(/['"]([^'"]+)['"]\s*:/g)].map(match => match[1]).sort();
        expect(actual, `${file}: ${exportName}`).toEqual([...scenario!.assertions].sort());
        checked.add(exportName!);
      }
    }

    expect(checked.size).toBeGreaterThan(0);
  });
});
