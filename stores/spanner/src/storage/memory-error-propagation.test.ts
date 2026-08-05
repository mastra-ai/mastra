import { describe, expect, it, vi } from 'vitest';

import { MemorySpanner } from './domains/memory';

describe('MemorySpanner error propagation (no empty-on-error)', () => {
  // listMessagesById used to swallow DB errors and return an empty list, so an
  // outage looked exactly like "no data". It should throw instead. The other
  // list reads (listThreads, listMessages) already threw.
  const createFailingDomain = () => {
    const database = new Proxy({}, { get: () => vi.fn().mockRejectedValue(new Error('simulated backend outage')) });
    return new MemorySpanner({ database: database as any });
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

  it('listMessagesById re-throws backend failures instead of returning empty', async () => {
    await expectOutage(
      createFailingDomain().listMessagesById({ messageIds: ['msg-err'] }),
      /LIST_MESSAGES_BY_ID.*FAILED/,
    );
  });
});
