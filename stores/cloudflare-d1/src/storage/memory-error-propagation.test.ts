import { describe, expect, it, vi } from 'vitest';

import { MemoryStorageD1 } from './domains/memory';

describe('MemoryStorageD1 error propagation (no empty-on-error)', () => {
  // These reads used to swallow DB errors and return an empty page, so an outage
  // looked exactly like "no data". They should throw instead.
  const createFailingDomain = () => {
    const client = { query: vi.fn().mockRejectedValue(new Error('simulated backend outage')) };
    return new MemoryStorageD1({ client: client as any });
  };

  // Also check the cause is the original error, so a broken mock can't pass as
  // a real outage.
  const expectOutage = async (promise: Promise<unknown>, idPattern: RegExp) => {
    const err: any = await promise.then(
      () => {
        throw new Error('expected the read to reject, but it resolved');
      },
      e => e,
    );
    expect(err).toMatchObject({ id: expect.stringMatching(idPattern) });
    expect(String(err?.cause?.message ?? err?.message)).toContain('simulated backend outage');
  };

  it('listThreads re-throws backend failures instead of returning empty', async () => {
    await expectOutage(createFailingDomain().listThreads({}), /LIST_THREADS.*FAILED/);
  });

  it('listMessages re-throws backend failures instead of returning empty', async () => {
    await expectOutage(createFailingDomain().listMessages({ threadId: 'thread-err' }), /LIST_MESSAGES.*FAILED/);
  });
});
