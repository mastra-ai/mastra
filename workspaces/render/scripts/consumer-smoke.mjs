import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { Workspace } from '@mastra/core/workspace';
import { Render } from '@renderinc/sdk';
import { RenderSandbox } from '@mastra/render';

const require = createRequire(import.meta.url);
const core = require('@mastra/core/package.json').version;
const client = new Render({ token: 'host-test-token', ownerId: 'tea-test' });
const api = client.experimental.sandboxes;
let terminated = 0,
  created = 0;
api.create = async () => {
  created++;
  return { id: 'sbx-consumer', status: 'running', createdAt: new Date().toISOString() };
};
api.get = async () => ({ id: 'sbx-consumer', status: 'running', createdAt: new Date().toISOString() });
api.exec = async () =>
  (async function* () {
    yield { type: 'output', stream: 'stdout', data: '42' };
    yield { type: 'exit', exit_code: 0 };
  })();
api.terminate = async () => {
  terminated++;
};
const sandbox = new RenderSandbox({ client });
const workspace = new Workspace({ sandbox });
await workspace.init();
assert.equal((await workspace.sandbox.executeCommand('echo 42')).stdout, '42');
await workspace.destroy();
assert.equal(created, 1);
assert.equal(terminated, 1);
let workflows = false;
if (process.argv.includes('--workflows')) {
  const { init, createMemoryPersistence } = await import('@renderinc/mastra');
  assert.equal(typeof init, 'function');
  assert.equal(typeof createMemoryPersistence, 'function');
  const packageJson = require('@renderinc/mastra/package.json');
  assert.equal(packageJson.dependencies['@renderinc/sdk'], '1.2.0');
  assert.equal(require('@mastra/render/package.json').dependencies['@renderinc/sdk'], '1.2.0');
  workflows = true;
} else {
  assert.throws(() => require.resolve('@renderinc/mastra'));
}
const source = await readFile(new URL(import.meta.resolve('@mastra/render')), 'utf8');
assert(!source.includes('@renderinc/mastra/'));
const result = {
  core,
  workflowsInstalled: workflows,
  sandboxImport: 'PASS',
  workspaceLifecycle: 'PASS',
  sdk: '1.2.0',
};
await writeFile('result.json', JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify(result));
