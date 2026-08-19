import { describe, expect, it, vi } from 'vitest';

import { MemoryMySQL } from './domains/memory';

describe('MemoryMySQL error propagation (no empty-on-error)', () => {
  // These reads used to swallow DB errors and return an empty page, so an outage
  // looked exactly like "no data". They should throw instead.
  const createFailingDomain = () => {
    const failing = () =>
      new Proxy({}, { get: () => vi.fn().mockRejectedValue(new Error('simulated backend outage')) });
    return new MemoryMySQL({ pool: failing() as any, operations: failing() as any });
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

  it('listMessagesByResourceId re-throws backend failures instead of returning empty', async () => {
    await expectOutage(
      createFailingDomain().listMessagesByResourceId({ resourceId: 'res-err' }),
      /LIST_MESSAGES_BY_RESOURCE_ID.*FAILED/,
    );
  });
});
