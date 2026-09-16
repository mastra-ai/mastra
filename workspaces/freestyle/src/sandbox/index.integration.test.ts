import { randomUUID } from 'node:crypto';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { FreestyleSandbox } from './index';

describe.skipIf(!process.env.FREESTYLE_API_KEY)('FreestyleSandbox integration', () => {
  let sandbox: FreestyleSandbox | undefined;

  beforeAll(() => {
    sandbox = new FreestyleSandbox({ id: `mastra-test-${randomUUID().slice(0, 8)}` });
  });

  afterAll(async () => {
    await sandbox?._destroy();
  });

  it('executes commands and preserves files across pause and resume', async () => {
    if (!sandbox) throw new Error('Integration sandbox was not initialized');

    await sandbox.writeFiles([{ path: '/tmp/mastra-persistent.txt', content: 'persistent' }]);
    await sandbox._stop();
    await sandbox.start();

    const result = await sandbox.executeCommand('cat', ['/tmp/mastra-persistent.txt']);

    expect(result).toMatchObject({ success: true, stdout: 'persistent' });
  }, 120_000);
});
