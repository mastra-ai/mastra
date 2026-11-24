import { createClient } from '@libsql/client';
import { expect, it } from 'vitest';

import { TestSpendingLedger } from './provider-spending-ledger';

it('reserves paid test attempts atomically and preserves unresolved usage', async () => {
  const client = createClient({ url: 'file::memory:' });
  const ledger = new TestSpendingLedger(client);
  try {
    const reservations = await Promise.all(
      ['one', 'two'].map(candidateId =>
        ledger.reserveProviderBudget({
          provider: 'jev',
          candidateId,
          amountUsd: 0.01,
          ceilingUsd: 0.01,
        }),
      ),
    );
    expect(reservations.filter(Boolean)).toHaveLength(1);
    const id = reservations.find(Boolean)!;
    const reopened = new TestSpendingLedger(client);
    expect(await reopened.providerBudgetAccounting('jev')).toEqual({
      knownUsd: 0,
      unresolvedUsd: 0.01,
      reservedUsd: 0.01,
    });
    expect(await reopened.settleProviderReservation({ id, knownAmountUnits: 100, unresolvedUnits: 1000 })).toBe(true);
    expect(await reopened.providerBudgetAccounting('jev')).toEqual({
      knownUsd: 0.0001,
      unresolvedUsd: 0.001,
      reservedUsd: 0.0011,
    });
    expect(await reopened.settleProviderReservation({ id, knownAmountUnits: 0, unresolvedUnits: 0 })).toBe(false);
  } finally {
    client.close();
  }
});
