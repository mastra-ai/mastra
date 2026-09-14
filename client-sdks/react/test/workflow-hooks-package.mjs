import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';

const require = createRequire(import.meta.url);
const packageDir = fileURLToPath(new URL('..', import.meta.url));
const names = [
  'MastraReactProvider',
  'useMastraClient',
  'useCreateWorkflowRun',
  'useCancelWorkflowRun',
  'useStreamWorkflow',
];

for (const format of ['import', 'require']) {
  test(`${format}: built public entries share functions and provider context`, async () => {
    const root = format === 'import' ? await import('@mastra/react') : require('@mastra/react');
    const hooks =
      format === 'import' ? await import('@mastra/react/workflow-hooks') : require('@mastra/react/workflow-hooks');
    assert.deepEqual(Object.keys(hooks).sort(), [...names].sort());
    for (const name of names) assert.equal(hooks[name], root[name], name);
    for (const [provider, useClient] of [
      [root.MastraReactProvider, hooks.useMastraClient],
      [hooks.MastraReactProvider, root.useMastraClient],
    ]) {
      let client;
      function Child() {
        client = useClient();
        return null;
      }
      renderToString(createElement(provider, { baseUrl: 'https://mastra.example' }, createElement(Child)));
      assert.equal(typeof client?.getWorkflow, 'function');
    }
  });

  test(`${format}: workflow package graph excludes UI and syntax modules`, () => {
    const manifest = JSON.parse(readFileSync(path.join(packageDir, 'package.json'), 'utf8'));
    const entry = manifest.exports['./workflow-hooks'][format];
    assert.match(readFileSync(path.resolve(packageDir, entry.types), 'utf8'), /workflows\/hooks/);
    const pending = [path.resolve(packageDir, entry.default)];
    const visited = new Set();
    const sources = new Set();
    while (pending.length) {
      const file = pending.pop();
      if (visited.has(file)) continue;
      visited.add(file);
      const code = readFileSync(file, 'utf8');
      const imports = [...code.matchAll(/(?:from\s*|import\s*|require\(\s*)['"]([^'"]+)['"]/g)].map(match => match[1]);
      for (const specifier of imports) {
        assert.doesNotMatch(specifier, /shiki|hast-util|lucide|radix|react-dom|@mastra\/core\/agent/);
        if (specifier.startsWith('.')) pending.push(path.resolve(path.dirname(file), specifier));
      }
      if (existsSync(`${file}.map`)) {
        const map = JSON.parse(readFileSync(`${file}.map`, 'utf8'));
        for (const source of map.sources) {
          sources.add(source);
          assert.doesNotMatch(source, /\/ui\/|WorkflowStepFactory|\/agent\/hooks|\/voice\//);
        }
      }
    }
    assert.ok(visited.size > 0);
    assert.ok([...sources].some(source => source.endsWith('/workflows/use-stream-workflow.ts')));
  });
}
