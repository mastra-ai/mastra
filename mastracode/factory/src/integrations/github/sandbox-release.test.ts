import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  __clearSessionSandboxesForTests,
  getSessionSandbox,
  peekSessionSandbox,
} from '../../sandbox/session-sandbox.js';
import { reclaimDeletedSessionSandbox, releaseSessionSandbox } from './sandbox-release.js';

afterEach(() => {
  __clearSessionSandboxesForTests();
});

function seedMemoSandbox(sessionId: string) {
  const fake = {
    id: `sbx-${sessionId}`,
    provider: 'stub',
    stop: vi.fn(async () => {}),
    destroy: vi.fn(async () => {}),
    executeCommand: vi.fn(async () => ({ exitCode: 0, stdout: '', stderr: '' })),
  };
  getSessionSandbox(sessionId, '/workspace/acme/repo', () => fake as never);
  return fake;
}

describe('releaseSessionSandbox', () => {
  it('stops the memoized sandbox and evicts it so a later open reconstructs', async () => {
    const fake = seedMemoSandbox('row-1');

    await releaseSessionSandbox({ sessionId: 'row-1' });

    expect(fake.stop).toHaveBeenCalledTimes(1);
    expect(fake.destroy).not.toHaveBeenCalled();
    expect(peekSessionSandbox('row-1')).toBeUndefined();
  });

  it('destroys instead of stopping when the session is gone for good', async () => {
    const fake = seedMemoSandbox('row-1');

    await releaseSessionSandbox({ sessionId: 'row-1', destroy: true });

    expect(fake.destroy).toHaveBeenCalledTimes(1);
    expect(fake.stop).not.toHaveBeenCalled();
    expect(peekSessionSandbox('row-1')).toBeUndefined();
  });

  it('no-ops when this process holds no sandbox for the session', async () => {
    await expect(releaseSessionSandbox({ sessionId: 'unknown' })).resolves.toBeUndefined();
  });

  it('evicts before stopping, so a concurrent open never reuses a stopping instance', async () => {
    let resolveStop!: () => void;
    const fake = {
      id: 'sbx-row-1',
      provider: 'stub',
      stop: vi.fn(() => new Promise<void>(resolve => (resolveStop = resolve))),
      executeCommand: vi.fn(async () => ({ exitCode: 0, stdout: '', stderr: '' })),
    };
    getSessionSandbox('row-1', '/workspace/acme/repo', () => fake as never);

    const releasing = releaseSessionSandbox({ sessionId: 'row-1' });
    expect(peekSessionSandbox('row-1')).toBeUndefined();
    resolveStop();
    await releasing;
  });
});

describe('reclaimDeletedSessionSandbox', () => {
  it('destroys the deleted session sandbox held by this process', async () => {
    const fake = seedMemoSandbox('row-9');

    await reclaimDeletedSessionSandbox({ session: { id: 'row-9' } });

    expect(fake.destroy).toHaveBeenCalledTimes(1);
    expect(peekSessionSandbox('row-9')).toBeUndefined();
  });
});
