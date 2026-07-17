import deepEqual from 'fast-deep-equal';

import { MastraError } from '../../../error';
import type {
  BatchInsertItemsInput,
  DatasetItemIdentityConflictDetail,
  DatasetItemPayload,
  DatasetItemRow,
} from '../../types';

const payloadFields = [
  'input',
  'groundTruth',
  'expectedTrajectory',
  'toolMocks',
  'requestContext',
  'metadata',
  'source',
] as const;

function canonicalPayload(payload: DatasetItemPayload | DatasetItemRow): Record<string, unknown> {
  return Object.fromEntries(payloadFields.map(field => [field, payload[field] ?? null]));
}

export function datasetItemPayloadsEqual(submitted: DatasetItemPayload, accepted: DatasetItemRow): boolean {
  return deepEqual(canonicalPayload(submitted), canonicalPayload(accepted));
}

export class DatasetItemIdentityConflictError extends MastraError {
  readonly conflicts: DatasetItemIdentityConflictDetail[];

  constructor(conflicts: DatasetItemIdentityConflictDetail[]) {
    super({
      id: 'DATASET_ITEM_IDENTITY_CONFLICT',
      text: 'One or more dataset item identities conflict with previously accepted items.',
      domain: 'STORAGE',
      category: 'USER',
    });
    this.conflicts = conflicts;
  }
}

export function createDatasetItemIdentityConflictError(
  conflicts: DatasetItemIdentityConflictDetail[],
): DatasetItemIdentityConflictError {
  return new DatasetItemIdentityConflictError(conflicts);
}

export interface DatasetItemBatchPlan {
  inserts: Array<{ id: string; item: BatchInsertItemsInput['items'][number] }>;
  resolvedIds: string[];
  existingCurrentItems: Map<string, DatasetItemRow>;
}

export function planDatasetItemBatch(
  items: BatchInsertItemsInput['items'],
  historyRows: DatasetItemRow[],
  createId: () => string,
): DatasetItemBatchPlan {
  const accepted = new Map<string, { first: DatasetItemRow; current: DatasetItemRow | null }>();
  for (const row of historyRows.sort((a, b) => a.datasetVersion - b.datasetVersion)) {
    if (!row.externalId) continue;
    const entry = accepted.get(row.externalId);
    if (entry && entry.first.id !== row.id) {
      throw new Error(`Dataset item identity history is corrupt for externalId: ${row.externalId}`);
    }
    if (!entry) accepted.set(row.externalId, { first: row, current: null });
    if (row.validTo === null) accepted.get(row.externalId)!.current = row.isDeleted ? null : row;
  }

  const conflicts: DatasetItemIdentityConflictDetail[] = [];
  const inserts: DatasetItemBatchPlan['inserts'] = [];
  const resolvedIds: string[] = [];
  const existingCurrentItems = new Map<string, DatasetItemRow>();
  const requestLocal = new Map<string, DatasetItemBatchPlan['inserts'][number]>();

  for (const [index, item] of items.entries()) {
    if (!item.externalId) {
      const insert = { id: createId(), item };
      inserts.push(insert);
      resolvedIds.push(insert.id);
      continue;
    }
    const stored = accepted.get(item.externalId);
    if (stored) {
      if (!stored.current) {
        conflicts.push({ index, externalId: item.externalId, existingItemId: stored.first.id, reason: 'deleted' });
      } else if (!datasetItemPayloadsEqual(item, stored.first)) {
        conflicts.push({
          index,
          externalId: item.externalId,
          existingItemId: stored.first.id,
          reason: 'payload_mismatch',
        });
      } else {
        existingCurrentItems.set(stored.first.id, stored.current);
      }
      resolvedIds.push(stored.first.id);
      continue;
    }
    const local = requestLocal.get(item.externalId);
    if (local) {
      const acceptedRow = {
        ...local.item,
        id: local.id,
        datasetId: '',
        datasetVersion: 0,
        validTo: null,
        isDeleted: false,
        createdAt: new Date(0),
        updatedAt: new Date(0),
      } satisfies DatasetItemRow;
      if (!datasetItemPayloadsEqual(item, acceptedRow)) {
        conflicts.push({ index, externalId: item.externalId, existingItemId: local.id, reason: 'payload_mismatch' });
      }
      resolvedIds.push(local.id);
      continue;
    }
    const insert = { id: createId(), item };
    inserts.push(insert);
    requestLocal.set(item.externalId, insert);
    resolvedIds.push(insert.id);
  }
  if (conflicts.length) throw createDatasetItemIdentityConflictError(conflicts);
  return { inserts, resolvedIds, existingCurrentItems };
}

export function validateDatasetItemExternalId(externalId: string | undefined): void {
  if (externalId === '') {
    throw new MastraError({
      id: 'DATASET_ITEM_EXTERNAL_ID_INVALID',
      text: 'Dataset item externalId must be a non-empty string.',
      domain: 'STORAGE',
      category: 'USER',
    });
  }
}
