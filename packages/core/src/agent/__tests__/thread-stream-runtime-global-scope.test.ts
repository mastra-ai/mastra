import type * as NodeCrypto from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';

describe('AgentThreadStreamRuntime global scope', () => {
  afterEach(() => {
    vi.doUnmock('node:crypto');
    vi.resetModules();
  });

  it('does not allocate a source id at module load or construction time', async () => {
    vi.resetModules();
    const randomUUID = vi.fn(() => 'runtime-id');

    vi.doMock('node:crypto', async importOriginal => {
      const actual = await importOriginal<typeof NodeCrypto>();
      return { ...actual, randomUUID };
    });

    const { AgentThreadStreamRuntime, agentThreadStreamRuntime } = await import('../thread-stream-runtime');

    expect(agentThreadStreamRuntime).toBeInstanceOf(AgentThreadStreamRuntime);
    expect(randomUUID).not.toHaveBeenCalled();

    new AgentThreadStreamRuntime();

    expect(randomUUID).not.toHaveBeenCalled();
  });
});
