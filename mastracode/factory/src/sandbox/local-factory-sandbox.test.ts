import { join } from 'node:path';
import { describeFactorySandbox, LocalSandbox } from '@mastra/core/workspace';
import { describe, expect, it } from 'vitest';
import { LocalFactorySandbox } from './local-factory-sandbox.js';

describe('LocalFactorySandbox', () => {
  it('roots each session under root/sessionId with the configured env', () => {
    const sandbox = new LocalFactorySandbox({ root: '/tmp/mc-sandboxes', env: { PATH: '/usr/bin' } });
    expect(describeFactorySandbox(sandbox)).toMatchObject({
      provider: 'local',
      capabilities: { template: false, builds: { available: false, history: false } },
    });
    const created = sandbox.create({ sessionId: 'sess-1', getRepositoryAccess: undefined }, {});
    expect(created).toBeInstanceOf(LocalSandbox);
    expect(created.workingDirectory).toBe(join('/tmp/mc-sandboxes', 'sess-1'));
    expect(created.env).toEqual({ PATH: '/usr/bin' });
  });
});
