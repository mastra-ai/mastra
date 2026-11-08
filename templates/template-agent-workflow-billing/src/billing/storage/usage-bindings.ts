import type { Transaction } from '@libsql/client/node';
import { z } from 'zod';
import { BillingError, identifierSchema, parseInput, usageBindingSchema, usageEventSchema } from '../contracts.js';
import type { UsageBinding } from '../contracts.js';
import { BillingDatabase } from './database.js';

// No outbox means a direct trusted provider call. Historical outbox work must
// have its original binding; present-day configuration is never evidence.
export async function readUsageBinding(
  transaction: Transaction,
  event: z.infer<typeof usageEventSchema>,
  allowLegacyClaim = false,
): Promise<UsageBinding | null> {
  const outbox = (
    await transaction.execute({
      sql: 'SELECT o.execution_id, o.payload AS event, b.payload FROM billing_outbox o LEFT JOIN billing_usage_bindings b ON b.execution_id = o.execution_id WHERE o.id = ?',
      args: [event.id],
    })
  ).rows[0];
  if (!outbox) return null;
  const original = parseInput(usageEventSchema, JSON.parse(String(outbox.event)));
  if (JSON.stringify(original) !== JSON.stringify(event)) throw new BillingError('conflict');
  if (outbox.payload === null) {
    if (allowLegacyClaim) return null;
    throw new BillingError('state_unavailable');
  }
  const binding = parseInput(usageBindingSchema, JSON.parse(String(outbox.payload)));
  if (binding.provider !== event.account.provider || binding.meter !== event.meter) throw new BillingError('conflict');
  return binding;
}

const restorationSchema = z.strictObject({
  eventId: identifierSchema,
  binding: usageBindingSchema,
  evidence: z.string().trim().min(1).max(2048),
});

// Trusted server-side repair only; deliberately absent from HTTP routes. One
// historical pending event per call, with an immutable evidence reference.
export class UsageBindingRecovery {
  private constructor(private readonly database: BillingDatabase) {}
  static async open(options: { url: string }) {
    return new UsageBindingRecovery(await BillingDatabase.open(options));
  }
  close() {
    this.database.close();
  }
  async restore(input: z.input<typeof restorationSchema>): Promise<void> {
    const restoration = parseInput(restorationSchema, input);
    return this.database.write(async transaction => {
      const row = (
        await transaction.execute({
          sql: "SELECT o.execution_id, o.payload FROM billing_outbox o JOIN billing_delivery d ON d.event_id = o.id WHERE o.id = ? AND d.status IN ('pending', 'retrying', 'uncertain') AND d.lease_token IS NULL",
          args: [restoration.eventId],
        })
      ).rows[0];
      if (!row) throw new BillingError('conflict');
      const event = parseInput(usageEventSchema, JSON.parse(String(row.payload)));
      if (restoration.binding.provider !== event.account.provider || restoration.binding.meter !== event.meter)
        throw new BillingError('conflict');
      const previous = (
        await transaction.execute({
          sql: 'SELECT execution_id FROM billing_usage_bindings WHERE execution_id = ?',
          args: [row.execution_id],
        })
      ).rows[0];
      if (previous) throw new BillingError('conflict');
      await transaction.execute({
        sql: 'INSERT INTO billing_usage_bindings (execution_id, payload, evidence) VALUES (?, ?, ?)',
        args: [row.execution_id, JSON.stringify(restoration.binding), restoration.evidence],
      });
    });
  }
}
