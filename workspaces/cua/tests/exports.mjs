import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { test } from 'node:test';

const require = createRequire(import.meta.url);

for (const format of ['esm', 'cjs']) {
  test(`${format} package export loads Fleet and preserves sanitized errors`, async t => {
    const { CuaFleetSandbox } = format === 'esm' ? await import('@mastra/cua') : require('@mastra/cua');
    let requests = 0;
    t.mock.method(globalThis, 'fetch', async () => {
      requests++;
      throw new Error('private transport detail');
    });
    const sandbox = new CuaFleetSandbox({
      id: 'export-test',
      poolName: 'fake-pool',
      clientId: 'fake-client',
      clientSecret: 'fake-secret',
    });
    await assert.rejects(sandbox.start(), { message: 'Cua Fleet: START_FAILED' });
    assert.ok(requests > 0, 'the built export loads and initializes the ESM Fleet SDK');
    await sandbox.destroy();
  });
}
