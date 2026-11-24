import type { Transaction } from '@libsql/client/node';

/** Preserve an idle local account's historical credit balance under the generic meter key. */
export async function transitionCredits(tx: Transaction, accountId: string) {
  const source = (
    await tx.execute({
      sql: `SELECT m.* FROM commercial_meters m JOIN billing_accounts a ON a.id = m.account_id
      WHERE m.account_id = ? AND a.provider = 'local' AND m.key = 'image-credits' AND m.funding = 'prepaid'
      AND NOT EXISTS (SELECT 1 FROM commercial_meters t WHERE t.account_id = m.account_id AND t.key = 'credits')
      AND NOT EXISTS (SELECT 1 FROM local_credit_migrations t WHERE t.account_id = m.account_id)
      AND NOT EXISTS (SELECT 1 FROM billing_reservations r WHERE r.account_id = m.account_id AND r.active = 1)
      AND NOT EXISTS (SELECT 1 FROM local_provider_reservations r WHERE r.account_id = m.account_id AND r.state = 'reserved')
      AND NOT EXISTS (SELECT 1 FROM billing_executions e WHERE e.account_id = m.account_id AND (e.status IN ('running', 'uncertain') OR e.settlement IN ('reserved', 'pending', 'uncertain')))
      AND NOT EXISTS (SELECT 1 FROM billing_remote_operations r JOIN billing_executions e ON e.id = r.execution_id WHERE e.account_id = m.account_id AND r.terminal_state = 'pending' AND r.reserve_state != 'denied')`,
      args: [accountId],
    })
  ).rows[0];
  if (!source) return;
  await tx.execute({
    sql: "INSERT INTO local_credit_migrations VALUES (?, 'image-credits', 'credits', ?, ?)",
    args: [accountId, source.balance, source.consumed],
  });
  await tx.execute({
    sql: "INSERT INTO commercial_meters VALUES (?, 'credits', 'prepaid', ?, ?, ?, ?)",
    args: [accountId, source.balance, source.consumed, source.period_start, source.period_end],
  });
}

/** Retry the v1 data transition only after all work on the account has settled. */
export async function transitionImageCredits(tx: Transaction, accountId?: string) {
  // Only the recognized local simulation is transitioned. Preserve historical
  // keys and exact remaining/consumed quantities; never grant a new allowance.
  const candidates = (
    await tx.execute({
      sql: `SELECT a.id, m.balance, m.consumed, m.period_start, m.period_end
    FROM billing_accounts a JOIN commercial_meters m ON m.account_id = a.id
    WHERE a.provider = 'local' AND m.key = 'weather-credits' AND m.funding = 'prepaid' AND m.balance IS NOT NULL
    AND (? IS NULL OR a.id = ?)
    AND NOT EXISTS (SELECT 1 FROM local_image_credit_migrations t WHERE t.account_id = a.id)
    AND NOT EXISTS (SELECT 1 FROM commercial_meters t WHERE t.account_id = a.id AND t.key = 'image-credits')
    AND NOT EXISTS (SELECT 1 FROM billing_reservations r WHERE r.account_id = a.id AND r.active = 1)
    AND NOT EXISTS (SELECT 1 FROM local_provider_reservations r WHERE r.account_id = a.id AND r.state = 'reserved')
    AND NOT EXISTS (SELECT 1 FROM billing_executions e WHERE e.account_id = a.id AND (e.status IN ('running', 'uncertain') OR e.settlement IN ('reserved', 'pending', 'uncertain')))
    AND NOT EXISTS (SELECT 1 FROM billing_remote_operations r JOIN billing_executions e ON e.id = r.execution_id WHERE e.account_id = a.id AND r.terminal_state = 'pending' AND r.reserve_state != 'denied')`,
      args: [accountId ?? null, accountId ?? null],
    })
  ).rows;
  for (const row of candidates) {
    await tx.execute({
      sql: "INSERT INTO local_image_credit_migrations VALUES (?, 'weather-credits', 'image-credits', ?, ?)",
      args: [row.id, row.balance, row.consumed],
    });
    await tx.execute({
      sql: "INSERT INTO commercial_meters VALUES (?, 'image-credits', 'prepaid', ?, ?, ?, ?)",
      args: [row.id, row.balance, row.consumed, row.period_start, row.period_end],
    });
  }
}
