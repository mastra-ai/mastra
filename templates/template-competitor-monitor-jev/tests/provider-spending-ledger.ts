import { randomUUID } from 'node:crypto';
import type { Client } from '@libsql/client';
import { CLASSIFICATION_LIMITS } from './provider-spending-config';

/** Durable spending guard for explicitly invoked paid tests only. */
export class TestSpendingLedger {
  private initialization?: Promise<void>;
  constructor(readonly client: Client) {}
  private init() {
    return (this.initialization ??= this.client.executeMultiple(`
      CREATE TABLE IF NOT EXISTS provider_reservations (
        id TEXT PRIMARY KEY,
        provider TEXT NOT NULL,
        candidate_id TEXT NOT NULL,
        amount_units INTEGER NOT NULL,
        known_amount_units INTEGER,
        unresolved_units INTEGER NOT NULL,
        status TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
    `));
  }
  /** Atomically reserves the full bounded native-call allowance. Reservations remain on uncertain billing. */
  async reserveProviderBudget(input: {
    provider: 'jev' | 'openai';
    candidateId: string;
    amountUsd: number;
    ceilingUsd: number;
  }) {
    await this.init();
    const id = randomUUID();
    const amountUnits = Math.ceil(input.amountUsd * CLASSIFICATION_LIMITS.usdReservationUnits);
    const ceilingUnits = Math.floor(input.ceilingUsd * CLASSIFICATION_LIMITS.usdReservationUnits);
    const result = await this.client.execute({
      sql: `INSERT INTO provider_reservations (id, provider, candidate_id, amount_units, unresolved_units, status, created_at)
            SELECT ?, ?, ?, ?, ?, 'uncertain', ?
            WHERE COALESCE((SELECT SUM(COALESCE(known_amount_units + unresolved_units, amount_units)) FROM provider_reservations WHERE provider = ?), 0) + ? <= ?`,
      args: [
        id,
        input.provider,
        input.candidateId,
        amountUnits,
        amountUnits,
        new Date().toISOString(),
        input.provider,
        amountUnits,
        ceilingUnits,
      ],
    });
    return result.rowsAffected > 0 ? id : undefined;
  }

  /** Record completed provider usage only when all billed components are known within the original reservation. */
  async settleProviderReservation(input: { id: string; knownAmountUnits: number; unresolvedUnits: number }) {
    await this.init();
    if (
      !Number.isSafeInteger(input.knownAmountUnits) ||
      !Number.isSafeInteger(input.unresolvedUnits) ||
      input.knownAmountUnits < 0 ||
      input.unresolvedUnits < 0
    ) {
      throw new Error('INVALID_PROVIDER_RESERVATION_SETTLEMENT');
    }
    const result = await this.client.execute({
      sql: `UPDATE provider_reservations
            SET known_amount_units = ?, unresolved_units = ?, status = CASE WHEN ? = 0 THEN 'settled' ELSE 'uncertain' END
            WHERE id = ? AND status = 'uncertain' AND known_amount_units IS NULL AND unresolved_units = amount_units
              AND ? + ? <= amount_units`,
      args: [
        input.knownAmountUnits,
        input.unresolvedUnits,
        input.unresolvedUnits,
        input.id,
        input.knownAmountUnits,
        input.unresolvedUnits,
      ],
    });
    return result.rowsAffected > 0;
  }

  /** Durable provider totals distinguish reconciled spend from attempts whose billing remains unknown. */
  async providerBudgetAccounting(provider: 'jev' | 'openai') {
    await this.init();
    const result = await this.client.execute({
      sql: `SELECT COALESCE(SUM(known_amount_units), 0) AS known, COALESCE(SUM(unresolved_units), 0) AS unresolved
            FROM provider_reservations WHERE provider = ?`,
      args: [provider],
    });
    const knownUsd = Number(result.rows[0]?.known ?? 0) / CLASSIFICATION_LIMITS.usdReservationUnits;
    const unresolvedUsd = Number(result.rows[0]?.unresolved ?? 0) / CLASSIFICATION_LIMITS.usdReservationUnits;
    return { knownUsd, unresolvedUsd, reservedUsd: knownUsd + unresolvedUsd };
  }
}
