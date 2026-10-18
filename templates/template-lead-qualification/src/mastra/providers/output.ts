import { z } from 'zod';
import type { Client } from '@libsql/client';
import type { NormalizedEvent } from '../contracts';
import type { OwnedPatch } from '../review/contracts';
import { digestValue } from '../review/contracts';

export interface DestinationState {
  fields: Record<string, unknown>;
  marker: string | null;
}
export interface OutputProvider {
  id: string;
  read(destination: NormalizedEvent['destination']): Promise<DestinationState | null>;
  apply(
    destination: NormalizedEvent['destination'],
    operationId: string,
    patch: OwnedPatch,
    expected: Record<string, unknown>,
  ): Promise<void>;
}
/** Local compare-and-set updates only integration-owned fields. */
export class LocalOutputProvider implements OutputProvider {
  readonly id = 'local';
  constructor(private readonly client: Client) {}
  async read(destination: NormalizedEvent['destination']) {
    const row = (
      await this.client.execute({
        sql: 'SELECT * FROM lead_local_destinations WHERE reference=?',
        args: [destination.reference],
      })
    ).rows[0];
    return row
      ? {
          fields: JSON.parse(z.string().parse(row.fields_json)) as Record<string, unknown>,
          marker: row.marker === null ? null : z.string().parse(row.marker),
        }
      : null;
  }
  async apply(
    destination: NormalizedEvent['destination'],
    operationId: string,
    patch: OwnedPatch,
    expected: Record<string, unknown>,
  ) {
    const current = await this.read(destination);
    if (!current || digestValue(ownedState(current.fields)) !== digestValue(expected))
      throw new Error('destination_conflict');
    const changed = await this.client.execute({
      sql: 'UPDATE lead_local_destinations SET fields_json=?,marker=? WHERE reference=? AND fields_json=? AND marker IS ?',
      args: [
        JSON.stringify({ ...current.fields, ...patch }),
        operationId,
        destination.reference,
        JSON.stringify(current.fields),
        current.marker,
      ],
    });
    if (changed.rowsAffected !== 1) throw new Error('destination_conflict');
  }
}
export function ownedState(fields: Record<string, unknown>): Record<string, unknown> {
  const keys: Array<keyof OwnedPatch> = [
    'assessmentId',
    'cycleId',
    'classification',
    'stage',
    'score',
    'summary',
    'evidenceLinks',
    'gaps',
    'reviewReasons',
    'nextAction',
    'reviewId',
    'reviewRevision',
    'reviewStatus',
    'decisionSource',
    'overrideClassification',
    'overrideReason',
  ];
  return Object.fromEntries(keys.filter(key => key in fields).map(key => [key, fields[key]]));
}
