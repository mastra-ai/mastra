import { createHash, randomUUID } from 'node:crypto';
import { createDatasetSnapshot, datasetSnapshotContentSchema } from '../../../datasets/snapshot';
import type { DatasetSnapshotContent, DatasetSnapshotOptions } from '../../../datasets/snapshot';
import type {
  DatasetSnapshotReferenceMapping,
  PreparedDatasetSnapshotImport,
} from '../../../datasets/snapshot-transfer';
import { SchemaValidator } from '../../../datasets/validation';
import { ErrorCategory, ErrorDomain, MastraError } from '../../../error';
import { TABLE_SCHEMAS } from '../../constants';
import type { TABLE_NAMES } from '../../constants';
import type { DatasetItem, DatasetItemRow, DatasetRecord, DatasetVersion, StorageColumn } from '../../types';

export interface DatasetSnapshotIdentityRecord {
  id: string;
  datasetId: string;
  itemId: string | null;
  portableId: string;
}

export interface DatasetSnapshotImportReceipt {
  id: string;
  requestFingerprint: string;
  artifactDigest: string;
  datasetIdentity: string;
  datasetId: string;
  datasetVersion: number;
  organizationId: string | null;
  projectId: string | null;
  targetMappings: DatasetSnapshotReferenceMapping[];
  scorerMappings: DatasetSnapshotReferenceMapping[];
  completedAt: string;
}

export interface DatasetSnapshotImportResult {
  receipt: DatasetSnapshotImportReceipt;
  datasetExists: boolean;
}

export function datasetSnapshotIdentityId(datasetId: string, itemId: string | null): string {
  return createHash('sha256')
    .update(JSON.stringify([datasetId, itemId]))
    .digest('hex');
}

export function datasetSnapshotStorageError(id: Uppercase<string>, text: string, cause?: unknown): MastraError {
  return new MastraError({ id, text, domain: ErrorDomain.STORAGE, category: ErrorCategory.USER }, cause);
}

/**
 * Column/value pairs for a snapshot record insert. Undefined values are skipped; a
 * defined value for a column the table schema does not declare is a programming error,
 * so it fails instead of being silently dropped.
 */
export function datasetSnapshotRecordEntries(
  table: TABLE_NAMES,
  record: object,
): Array<[column: string, value: unknown, type: StorageColumn['type']]> {
  const schema = TABLE_SCHEMAS[table];
  return Object.entries(record).flatMap(([column, value]) => {
    if (value === undefined) return [];
    const definition = schema[column];
    if (!definition) {
      throw datasetSnapshotStorageError(
        'DATASET_SNAPSHOT_INVALID_STORAGE_VALUE',
        `Snapshot record field "${column}" is not a column of ${table}`,
      );
    }
    return [[column, value, definition.type]];
  });
}

function definedFields(fields: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(fields).filter(([, value]) => value !== undefined));
}

function snapshotConfiguration(dataset: DatasetRecord): DatasetSnapshotContent['configuration'] {
  // The complete envelope schema validates these values before they are sealed.
  // The artifact format accepts `description: null`, but `DatasetRecord` only holds a
  // string or nothing, so an unset description always exports as absent. Re-exporting a
  // dataset that was imported with `null` therefore yields a different digest by design.
  return {
    name: dataset.name,
    ...definedFields({
      description: dataset.description ?? undefined,
      metadata: dataset.metadata ?? undefined,
      inputSchema: dataset.inputSchema ?? undefined,
      groundTruthSchema: dataset.groundTruthSchema ?? undefined,
      requestContextSchema: dataset.requestContextSchema ?? undefined,
      tags: dataset.tags ?? undefined,
      targetType: dataset.targetType ?? undefined,
      targetIds: dataset.targetIds ?? undefined,
      scorerIds: dataset.scorerIds ?? undefined,
    }),
  };
}

export function validateDatasetSnapshotSchemas(content: DatasetSnapshotContent): void {
  const validator = new SchemaValidator();
  const result = validator.validateBatch(
    content.items.map(item => item.payload),
    content.configuration.inputSchema,
    content.configuration.groundTruthSchema,
    'snapshot',
  );
  const contextResult = validator.validateBatch(
    content.items
      .filter(item => item.payload.requestContext != null)
      .map(item => ({ input: item.payload.requestContext })),
    content.configuration.requestContextSchema,
    undefined,
    'snapshot:context',
  );
  if (result.invalid.length || contextResult.invalid.length) {
    throw datasetSnapshotStorageError(
      'DATASET_SNAPSHOT_SCHEMA_MISMATCH',
      'Snapshot items do not satisfy the captured dataset schemas',
    );
  }
}

/** Called inside the adapter's consistency boundary; this function does not persist adoption. */
export function captureDatasetSnapshot(input: {
  dataset: DatasetRecord;
  items: DatasetItem[];
  identities: DatasetSnapshotIdentityRecord[];
  version: number;
  options?: DatasetSnapshotOptions;
  exportedAt?: Date;
  /** Skip schema validation when the content was already validated by the same request. */
  validateSchemas?: boolean;
}) {
  const { dataset, items, version } = input;
  if (!Number.isSafeInteger(version) || version < 0 || version > dataset.version) {
    throw datasetSnapshotStorageError('DATASET_SNAPSHOT_VERSION_NOT_FOUND', 'Dataset item version does not exist');
  }
  const identities = new Map(input.identities.map(identity => [identity.id, identity]));
  const adopted: DatasetSnapshotIdentityRecord[] = [];
  const identityFor = (itemId: string | null): string => {
    const id = datasetSnapshotIdentityId(dataset.id, itemId);
    const existing = identities.get(id);
    if (existing) return existing.portableId;
    const record = { id, datasetId: dataset.id, itemId, portableId: randomUUID() };
    adopted.push(record);
    identities.set(id, record);
    return record.portableId;
  };
  const datasetIdentity = identityFor(null);
  const snapshotItems = items.map(item => {
    if (item.metadata?.__purged === true) {
      throw datasetSnapshotStorageError(
        'DATASET_SNAPSHOT_ITEM_PURGED',
        'Cannot export a version containing purged item content',
      );
    }
    return {
      itemIdentity: identityFor(item.id),
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
      payload: definedFields({
        externalId: item.externalId ?? undefined,
        input: item.input,
        groundTruth: item.groundTruth,
        expectedTrajectory: item.expectedTrajectory,
        toolMocks: item.toolMocks,
        unmockedToolPolicy: item.unmockedToolPolicy,
        scorerIds: item.scorerIds,
        requestContext: item.requestContext,
        metadata: item.metadata,
        source: item.source,
      }),
    };
  });
  // Storage returns items in adapter-specific order. Sort by portable identity so
  // repeated exports of the same content are byte-identical and diffable.
  snapshotItems.sort((a, b) => (a.itemIdentity < b.itemIdentity ? -1 : a.itemIdentity > b.itemIdentity ? 1 : 0));
  const content = datasetSnapshotContentSchema.parse({
    formatVersion: 1,
    datasetIdentity,
    configuration: snapshotConfiguration(dataset),
    items: snapshotItems,
    provenance: {
      exportedAt: (input.exportedAt ?? new Date()).toISOString(),
      sourceDatasetId: dataset.id,
      itemVersion: version,
      configurationBasis: 'export-time',
    },
  });
  if (input.validateSchemas !== false) validateDatasetSnapshotSchemas(content);
  return { snapshot: createDatasetSnapshot(content, input.options), adopted };
}

/** Callers must validate `prepared.content` against its captured schemas first. */
export function planDatasetSnapshotImport(prepared: PreparedDatasetSnapshotImport, now = new Date()) {
  const configuration = prepared.content.configuration;
  const datasetId = randomUUID();
  const version = prepared.content.items.length ? 1 : 0;
  const dataset: DatasetRecord = {
    ...configuration,
    description: configuration.description ?? undefined,
    inputSchema: configuration.inputSchema ?? undefined,
    groundTruthSchema: configuration.groundTruthSchema ?? undefined,
    requestContextSchema: configuration.requestContextSchema ?? undefined,
    ...prepared.destination,
    id: datasetId,
    version,
    createdAt: now,
    updatedAt: now,
  };
  const identities: DatasetSnapshotIdentityRecord[] = [
    {
      id: datasetSnapshotIdentityId(datasetId, null),
      datasetId,
      itemId: null,
      portableId: prepared.content.datasetIdentity,
    },
  ];
  const items: DatasetItemRow[] = prepared.content.items.map(item => {
    const id = randomUUID();
    identities.push({
      id: datasetSnapshotIdentityId(datasetId, id),
      datasetId,
      itemId: id,
      portableId: item.itemIdentity,
    });
    return {
      ...item.payload,
      id,
      datasetId,
      datasetVersion: version,
      organizationId: prepared.destination.organizationId,
      projectId: prepared.destination.projectId,
      validTo: null,
      isDeleted: false,
      createdAt: new Date(item.createdAt),
      updatedAt: new Date(item.updatedAt),
    };
  });
  const versionRecord: DatasetVersion | undefined = version
    ? { id: randomUUID(), datasetId, version, createdAt: now }
    : undefined;
  const receipt: DatasetSnapshotImportReceipt = {
    id: prepared.receiptId,
    requestFingerprint: prepared.requestFingerprint,
    artifactDigest: prepared.snapshot.digest,
    datasetIdentity: prepared.snapshot.datasetIdentity,
    datasetId,
    datasetVersion: version,
    organizationId: prepared.destination.organizationId,
    projectId: prepared.destination.projectId,
    targetMappings: prepared.targetMappings,
    scorerMappings: prepared.scorerMappings,
    completedAt: now.toISOString(),
  };
  return { dataset, items, identities, versionRecord, receipt };
}

export function datasetSnapshotDestinationExists(
  receipt: DatasetSnapshotImportReceipt,
  dataset: DatasetRecord | null | undefined,
  identity: DatasetSnapshotIdentityRecord | null | undefined,
): boolean {
  return (
    !!dataset &&
    dataset.id === receipt.datasetId &&
    (dataset.organizationId ?? null) === receipt.organizationId &&
    (dataset.projectId ?? null) === receipt.projectId &&
    identity?.portableId === receipt.datasetIdentity
  );
}

export function verifyDatasetSnapshotReceipt(
  receipt: DatasetSnapshotImportReceipt,
  prepared: PreparedDatasetSnapshotImport,
): void {
  if (receipt.requestFingerprint !== prepared.requestFingerprint) {
    throw datasetSnapshotStorageError(
      'DATASET_SNAPSHOT_IMPORT_CONFLICT',
      'The idempotency key was already used for a different snapshot import',
    );
  }
}

export type DatasetSnapshotImportPlan = ReturnType<typeof planDatasetSnapshotImport>;

/** Verify the adapter's re-read, not the objects passed to its insert statements. */
export function verifyDatasetSnapshotImport(
  plan: DatasetSnapshotImportPlan,
  persisted: { dataset: DatasetRecord; items: DatasetItem[]; identities: DatasetSnapshotIdentityRecord[] },
): void {
  const exportedAt = new Date(plan.receipt.completedAt);
  // The plan content was validated during preparation; a digest match proves the
  // persisted content is identical, so schema validation is skipped on both sides.
  const capture = { version: plan.dataset.version, exportedAt, validateSchemas: false } as const;
  const expected = captureDatasetSnapshot({ ...plan, ...capture, options: { maxBytes: Number.MAX_SAFE_INTEGER } });
  const actual = captureDatasetSnapshot({
    ...persisted,
    ...capture,
    options: { maxBytes: Number.MAX_SAFE_INTEGER },
  });
  if (
    actual.adopted.length !== 0 ||
    persisted.identities.length !== plan.identities.length ||
    persisted.dataset.id !== plan.dataset.id ||
    persisted.dataset.version !== plan.dataset.version ||
    persisted.dataset.organizationId !== plan.dataset.organizationId ||
    persisted.dataset.projectId !== plan.dataset.projectId ||
    persisted.items.some(
      item =>
        item.datasetId !== plan.dataset.id ||
        item.organizationId !== plan.dataset.organizationId ||
        item.projectId !== plan.dataset.projectId,
    ) ||
    actual.snapshot.digest !== expected.snapshot.digest
  ) {
    throw datasetSnapshotStorageError(
      'DATASET_SNAPSHOT_IMPORT_VERIFICATION_FAILED',
      'Storage did not preserve the imported snapshot',
    );
  }
}
