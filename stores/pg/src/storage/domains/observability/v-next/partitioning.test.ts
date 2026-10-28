import { describe, expect, it, vi } from 'vitest';
import type { DbClient } from '../../../client';
import { TABLE_SPAN_EVENTS } from './ddl';
import { ensureDayPartitions } from './partitioning';

const today = new Date();
const todayChild = `${TABLE_SPAN_EVENTS}_p${today.toISOString().slice(0, 10).replace(/-/g, '')}`;

function pgError(code: string, message: string) {
  return Object.assign(new Error(message), { code });
}

/**
 * A catalog with a mutable list of attached children. `onAttach` runs in
 * place of the real ATTACH and may throw or record a concurrent winner.
 */
function fakeClient(attached: string[], onAttach: () => void) {
  const none = vi.fn(async (sql: string) => {
    if (/ATTACH PARTITION/.test(sql)) onAttach();
  });
  const tx = vi.fn(async (fn: (t: { none: typeof none }) => Promise<void>) => fn({ none }));
  const manyOrNone = vi.fn(async () => attached.map(relname => ({ relname })));
  return { client: { tx, manyOrNone } as unknown as DbClient, tx };
}

describe('ensureDayPartitions', () => {
  it('runs no DDL for a day whose partition already exists', async () => {
    const { client, tx } = fakeClient([todayChild], () => {
      throw pgError('42501', 'must be owner of table');
    });
    await expect(ensureDayPartitions(client, 'obs', TABLE_SPAN_EVENTS, [today])).resolves.toBeUndefined();
    expect(tx).not.toHaveBeenCalled();
  });

  it('treats a failed ATTACH as success when a concurrent caller attached the day meanwhile', async () => {
    const attached: string[] = [];
    const { client } = fakeClient(attached, () => {
      attached.push(todayChild);
      throw pgError('42809', `»${todayChild}« ist bereits eine Partition`);
    });
    await expect(ensureDayPartitions(client, 'obs', TABLE_SPAN_EVENTS, [today])).resolves.toBeUndefined();
  });

  it('propagates a failed ATTACH when the day is still not attached', async () => {
    const { client } = fakeClient([], () => {
      throw pgError('42501', 'must be owner of table mastra_span_events');
    });
    await expect(ensureDayPartitions(client, 'obs', TABLE_SPAN_EVENTS, [today])).rejects.toThrow(/must be owner/);
  });
});
