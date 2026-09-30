import { ErrorCategory, ErrorDomain, MastraError } from '../../error';

/** Entity types that currently expose version labels publicly. */
export type VersionLabelEntityType = 'agent';

/** A persisted custom label pointing at one immutable entity version. */
export interface VersionLabelPointer<TEntityType extends string = VersionLabelEntityType> {
  entityType: TEntityType;
  entityId: string;
  label: string;
  versionId: string;
  revisionToken: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface VersionLabelEntityCapabilities {
  read: true;
  write: true;
  compareAndSwap: true;
  retentionProtection: true;
}

export const VERSION_LABEL_ENTITY_CAPABILITIES: VersionLabelEntityCapabilities = Object.freeze({
  read: true,
  write: true,
  compareAndSwap: true,
  retentionProtection: true,
});

export interface VersionLabelStorageCapabilities {
  versionLabels: {
    entityTypes: Partial<Record<VersionLabelEntityType, VersionLabelEntityCapabilities>>;
  };
}

export interface GetVersionLabelInput<TEntityType extends string = VersionLabelEntityType> {
  entityType: TEntityType;
  entityId: string;
  label: string;
}

export interface ListVersionLabelsInput<TEntityType extends string = VersionLabelEntityType> {
  entityType: TEntityType;
  entityId: string;
  page?: number;
  perPage?: number | false;
}

export interface ListVersionLabelsOutput<TEntityType extends string = VersionLabelEntityType> {
  labels: VersionLabelPointer<TEntityType>[];
  total: number;
  page: number;
  perPage: number | false;
  hasMore: boolean;
}

export interface ListVersionLabelsByVersionInput<TEntityType extends string = VersionLabelEntityType> {
  entityType: TEntityType;
  entityId: string;
  versionId: string;
}

export interface SetVersionLabelInput<TEntityType extends string = VersionLabelEntityType> {
  entityType: TEntityType;
  entityId: string;
  label: string;
  versionId: string;
  expectedRevisionToken: string | null;
}

export interface DeleteVersionLabelInput<TEntityType extends string = VersionLabelEntityType> {
  entityType: TEntityType;
  entityId: string;
  label: string;
  expectedRevisionToken: string;
}

export interface DeleteVersionLabelsByEntityInput<TEntityType extends string = VersionLabelEntityType> {
  entityType: TEntityType;
  entityId: string;
}

/**
 * Optional channel implemented by versioned domains that persist custom labels.
 * Storage scope is implicit in the already-scoped adapter instance or database schema.
 */
export interface VersionLabelStorageChannel<TEntityType extends string = VersionLabelEntityType> {
  readonly entityType: TEntityType;
  readonly capabilities: VersionLabelEntityCapabilities;
  get(input: GetVersionLabelInput<TEntityType>): Promise<VersionLabelPointer<TEntityType> | null>;
  list(input: ListVersionLabelsInput<TEntityType>): Promise<ListVersionLabelsOutput<TEntityType>>;
  listByVersion(input: ListVersionLabelsByVersionInput<TEntityType>): Promise<VersionLabelPointer<TEntityType>[]>;
  set(input: SetVersionLabelInput<TEntityType>): Promise<VersionLabelPointer<TEntityType>>;
  delete(input: DeleteVersionLabelInput<TEntityType>): Promise<{ deleted: boolean }>;
  deleteByEntity(input: DeleteVersionLabelsByEntityInput<TEntityType>): Promise<number>;
}

export const VERSION_LABEL_PATTERN = /^[a-z0-9](?:[a-z0-9._-]{0,62}[a-z0-9])?$/;
export const RESERVED_VERSION_LABELS = new Set(['production', 'latest']);

/** Compare valid ASCII label names by code point for adapter-independent paging. */
export function compareVersionLabelNames(left: string, right: string): number {
  return left === right ? 0 : left < right ? -1 : 1;
}

export type VersionLabelErrorCode =
  | 'VERSION_LABELS_UNSUPPORTED'
  | 'INVALID_VERSION_LABEL'
  | 'RESERVED_VERSION_LABEL'
  | 'VERSION_LABEL_NOT_FOUND'
  | 'VERSION_LABEL_CONFLICT'
  | 'ENTITY_NOT_FOUND'
  | 'VERSION_NOT_FOUND'
  | 'VERSION_NOT_OWNED_BY_ENTITY'
  | 'VERSION_IN_USE_BY_LABEL'
  | 'VERSION_LABEL_INTEGRITY_ERROR';

const ERROR_MESSAGES: Record<VersionLabelErrorCode, string> = {
  VERSION_LABELS_UNSUPPORTED: 'Version labels are not supported for this entity type and storage adapter.',
  INVALID_VERSION_LABEL: 'The version label is invalid.',
  RESERVED_VERSION_LABEL: 'The version label is reserved and cannot be mutated.',
  VERSION_LABEL_NOT_FOUND: 'The version label was not found.',
  VERSION_LABEL_CONFLICT: 'The version label changed after it was read.',
  ENTITY_NOT_FOUND: 'The owning entity was not found.',
  VERSION_NOT_FOUND: 'The requested version was not found.',
  VERSION_NOT_OWNED_BY_ENTITY: 'The requested version does not belong to the owning entity.',
  VERSION_IN_USE_BY_LABEL: 'The version cannot be deleted while a custom label points to it.',
  VERSION_LABEL_INTEGRITY_ERROR: 'The version label points to an invalid version.',
};

type ErrorDetailValue = string | number | boolean | null | undefined;

export function createVersionLabelError(
  code: VersionLabelErrorCode,
  details: Record<string, ErrorDetailValue> = {},
  text = ERROR_MESSAGES[code],
): MastraError {
  const serializedDetails: Record<string, string | number | boolean | null> = {};
  for (const [key, value] of Object.entries(details)) {
    if (value !== undefined) serializedDetails[key] = value;
  }

  return new MastraError({
    id: code,
    domain: ErrorDomain.STORAGE,
    category: code === 'VERSION_LABEL_INTEGRITY_ERROR' ? ErrorCategory.SYSTEM : ErrorCategory.USER,
    text,
    details: serializedDetails,
  });
}

export function createVersionLabelConflictError(
  input: Pick<SetVersionLabelInput, 'entityId' | 'label' | 'expectedRevisionToken'>,
  current: VersionLabelPointer | null,
): MastraError {
  return createVersionLabelError('VERSION_LABEL_CONFLICT', {
    entityId: input.entityId,
    label: input.label,
    expectedRevisionToken: input.expectedRevisionToken,
    currentRevisionToken: current?.revisionToken,
    currentVersionId: current?.versionId,
  });
}

export function isVersionLabelError(error: unknown, code?: VersionLabelErrorCode): error is MastraError {
  return error instanceof MastraError && (code === undefined || error.id === code);
}

/** Validate a label exactly as supplied. No trimming or case normalization is performed. */
export function validateVersionLabel(label: string, options: { allowReserved?: boolean } = {}): string {
  if (typeof label !== 'string' || !VERSION_LABEL_PATTERN.test(label)) {
    throw createVersionLabelError('INVALID_VERSION_LABEL', {
      label: typeof label === 'string' ? label : String(label),
    });
  }
  if (!options.allowReserved && RESERVED_VERSION_LABELS.has(label)) {
    throw createVersionLabelError('RESERVED_VERSION_LABEL', { label });
  }
  return label;
}

/** Enforce that every runtime mutation carries an explicit CAS precondition. */
export function validateVersionLabelRevisionToken(
  expectedRevisionToken: unknown,
  options: { allowNull: boolean },
): asserts expectedRevisionToken is string | null {
  if (options.allowNull && expectedRevisionToken === null) return;
  if (typeof expectedRevisionToken === 'string' && expectedRevisionToken.length > 0) return;
  throw createVersionLabelError('VERSION_LABEL_CONFLICT', {
    expectedRevisionToken:
      expectedRevisionToken === undefined
        ? 'undefined'
        : expectedRevisionToken === null
          ? null
          : String(expectedRevisionToken),
  });
}

/** Normalize and validate the common deterministic label-list pagination contract. */
export function normalizeVersionLabelPagination(input: { page?: number; perPage?: number | false }): {
  page: number;
  perPage: number;
  responsePerPage: number | false;
  offset: number;
} {
  const page = input.page ?? 0;
  if (!Number.isSafeInteger(page) || page < 0) {
    throw new RangeError('page must be a non-negative safe integer');
  }

  const requestedPerPage = input.perPage;
  if (
    requestedPerPage !== undefined &&
    requestedPerPage !== false &&
    (!Number.isSafeInteger(requestedPerPage) || requestedPerPage < 0)
  ) {
    throw new RangeError('perPage must be false or a non-negative safe integer');
  }

  const perPage = requestedPerPage === false ? Number.MAX_SAFE_INTEGER : (requestedPerPage ?? 50);
  const offset = requestedPerPage === false ? 0 : page * perPage;
  if (!Number.isSafeInteger(offset)) {
    throw new RangeError('page value too large');
  }

  return {
    page,
    perPage,
    responsePerPage: requestedPerPage === false ? false : perPage,
    offset,
  };
}
