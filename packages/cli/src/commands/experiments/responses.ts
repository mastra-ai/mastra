import { ApiCliError } from '../api/errors.js';

export type PlatformExperimentResponseKind =
  | 'dataset-list'
  | 'dataset-version-list'
  | 'scorer-list'
  | 'scorer-version-list'
  | 'admission'
  | 'experiment-list'
  | 'experiment-detail'
  | 'experiment-results';

interface ValidationContext {
  method: 'GET' | 'POST';
  path: string;
  status: number;
}

interface Pagination {
  page: number;
  perPage: number;
  total: number;
  hasMore: boolean;
}

interface ExperimentListItem {
  experimentId: string;
  jobId: string;
  attempt: number;
  status: string;
  provenance: Record<string, unknown>;
  run?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  studioUrl: string;
}

export interface PlatformExperimentResponseByKind {
  'dataset-list': { datasets: Array<Record<string, unknown>>; pagination: Pagination };
  'dataset-version-list': { versions: Array<Record<string, unknown>>; pagination: Pagination };
  'scorer-list': { scorers: Array<Record<string, unknown>>; pagination: Pagination };
  'scorer-version-list': { versions: Array<Record<string, unknown>>; pagination: Pagination };
  admission: Record<string, unknown>;
  'experiment-list': { experiments: ExperimentListItem[]; page: number; perPage: number; hasMore: boolean };
  'experiment-detail': ExperimentListItem & { capability: Record<string, unknown> };
  'experiment-results': Record<string, unknown>;
}

const lifecycleStatuses = [
  'queued',
  'starting',
  'running',
  'completed',
  'completed-with-errors',
  'failed',
  'cancelled',
  'timed-out',
] as const;

export function parsePlatformExperimentResponse<K extends PlatformExperimentResponseKind>(
  kind: K,
  value: unknown,
  context: ValidationContext,
): PlatformExperimentResponseByKind[K] {
  try {
    switch (kind) {
      case 'dataset-list':
        validateDatasetList(value);
        break;
      case 'dataset-version-list':
        validateDatasetVersionList(value);
        break;
      case 'scorer-list':
        validateScorerList(value);
        break;
      case 'scorer-version-list':
        validateScorerVersionList(value);
        break;
      case 'admission':
        validateAdmission(value);
        break;
      case 'experiment-list':
        validateExperimentList(value);
        break;
      case 'experiment-detail':
        validateExperimentDetail(value);
        break;
      case 'experiment-results':
        validateExperimentResults(value);
        break;
    }
    return value as PlatformExperimentResponseByKind[K];
  } catch (error) {
    if (!(error instanceof ResponseValidationError)) throw error;
    throw new ApiCliError(
      'PLATFORM_INVALID_RESPONSE',
      `Platform returned an invalid response for ${context.method} ${context.path}: ${error.message}`,
      {
        method: context.method,
        path: context.path,
        status: context.status,
        validation: error.message,
      },
    );
  }
}

function validateDatasetList(value: unknown): void {
  const response = record(value, 'response', ['datasets', 'pagination']);
  array(response.datasets, 'response.datasets').forEach((dataset, index) => {
    const item = record(dataset, `response.datasets[${index}]`, ['datasetId', 'name', 'description']);
    nonEmptyString(item.datasetId, `response.datasets[${index}].datasetId`);
    nonEmptyString(item.name, `response.datasets[${index}].name`);
    optionalString(item.description, `response.datasets[${index}].description`);
  });
  validatePagination(response.pagination, 'response.pagination');
}

function validateDatasetVersionList(value: unknown): void {
  const response = record(value, 'response', ['versions', 'pagination']);
  array(response.versions, 'response.versions').forEach((version, index) => {
    const path = `response.versions[${index}]`;
    const item = record(version, path, [
      'datasetId',
      'datasetVersionId',
      'version',
      'itemCount',
      'digest',
      'canonicalizationVersion',
    ]);
    nonEmptyString(item.datasetId, `${path}.datasetId`);
    nonEmptyString(item.datasetVersionId, `${path}.datasetVersionId`);
    positiveInteger(item.version, `${path}.version`);
    nonnegativeInteger(item.itemCount, `${path}.itemCount`);
    stringMatching(item.digest, `${path}.digest`, /^[a-f0-9]{64}$/, 'a 64-character lowercase hex digest');
    literal(item.canonicalizationVersion, `${path}.canonicalizationVersion`, '1');
  });
  validatePagination(response.pagination, 'response.pagination');
}

function validateScorerList(value: unknown): void {
  const response = record(value, 'response', ['scorers', 'pagination']);
  array(response.scorers, 'response.scorers').forEach((scorer, index) => {
    const path = `response.scorers[${index}]`;
    const item = record(scorer, path, ['definitionId', 'name', 'description']);
    nonEmptyString(item.definitionId, `${path}.definitionId`);
    nonEmptyString(item.name, `${path}.name`);
    optionalString(item.description, `${path}.description`);
  });
  validatePagination(response.pagination, 'response.pagination');
}

function validateScorerVersionList(value: unknown): void {
  const response = record(value, 'response', ['versions', 'pagination']);
  array(response.versions, 'response.versions').forEach((version, index) => {
    const path = `response.versions[${index}]`;
    const item = record(version, path, ['definitionId', 'versionId', 'versionNumber', 'name', 'description']);
    nonEmptyString(item.definitionId, `${path}.definitionId`);
    nonEmptyString(item.versionId, `${path}.versionId`);
    positiveInteger(item.versionNumber, `${path}.versionNumber`);
    nonEmptyString(item.name, `${path}.name`);
    optionalString(item.description, `${path}.description`);
  });
  validatePagination(response.pagination, 'response.pagination');
}

function validateAdmission(value: unknown): void {
  const response = record(value, 'response', [
    'experimentId',
    'jobId',
    'status',
    'datasetVersion',
    'datasetDigest',
    'hostedAssets',
    'studioUrl',
  ]);
  nonEmptyString(response.experimentId, 'response.experimentId');
  nonEmptyString(response.jobId, 'response.jobId');
  enumValue(response.status, 'response.status', [
    'queued',
    'running',
    'succeeded',
    'failed',
    'resuming',
    'resumed',
    'resume_failed',
  ] as const);
  positiveInteger(response.datasetVersion, 'response.datasetVersion');
  stringMatching(
    response.datasetDigest,
    'response.datasetDigest',
    /^[a-f0-9]{64}$/,
    'a 64-character lowercase hex digest',
  );
  if (response.hostedAssets !== undefined) validateHostedAssets(response.hostedAssets, 'response.hostedAssets');
  url(response.studioUrl, 'response.studioUrl');
}

function validateExperimentList(value: unknown): void {
  const response = record(value, 'response', ['experiments', 'page', 'perPage', 'hasMore']);
  array(response.experiments, 'response.experiments').forEach((item, index) =>
    validateExperimentListItem(item, `response.experiments[${index}]`),
  );
  nonnegativeInteger(response.page, 'response.page');
  positiveInteger(response.perPage, 'response.perPage');
  boolean(response.hasMore, 'response.hasMore');
}

function validateExperimentDetail(value: unknown): void {
  const response = validateExperimentListItem(value, 'response', ['capability']);
  const capability = record(response.capability, 'response.capability', ['state', 'reason']);
  enumValue(capability.state, 'response.capability.state', [
    'disabled',
    'building',
    'available',
    'enabled_unavailable',
    'source_unavailable',
  ] as const);
  optionalString(capability.reason, 'response.capability.reason');
}

function validateExperimentResults(value: unknown): void {
  const response = record(value, 'response', [
    'experimentId',
    'attempt',
    'status',
    'totalItems',
    'datasetItemCount',
    'items',
    'page',
    'perPage',
    'hasMore',
    'studioUrl',
  ]);
  nonEmptyString(response.experimentId, 'response.experimentId');
  nonnegativeInteger(response.attempt, 'response.attempt');
  enumValue(response.status, 'response.status', lifecycleStatuses);
  nonnegativeInteger(response.totalItems, 'response.totalItems');
  nonnegativeInteger(response.datasetItemCount, 'response.datasetItemCount');
  array(response.items, 'response.items').forEach((item, index) => validateExperimentResultItem(item, index));
  nonnegativeInteger(response.page, 'response.page');
  positiveInteger(response.perPage, 'response.perPage');
  boolean(response.hasMore, 'response.hasMore');
  url(response.studioUrl, 'response.studioUrl');
}

function validateExperimentListItem(value: unknown, path: string, extraKeys: string[] = []): Record<string, unknown> {
  const response = record(value, path, [
    'experimentId',
    'jobId',
    'attempt',
    'status',
    'provenance',
    'run',
    'createdAt',
    'updatedAt',
    'studioUrl',
    ...extraKeys,
  ]);
  nonEmptyString(response.experimentId, `${path}.experimentId`);
  nonEmptyString(response.jobId, `${path}.jobId`);
  nonnegativeInteger(response.attempt, `${path}.attempt`);
  enumValue(response.status, `${path}.status`, lifecycleStatuses);
  validateProvenance(response.provenance, `${path}.provenance`);
  if (response.run !== undefined) validateRunSummary(response.run, `${path}.run`);
  isoDateTime(response.createdAt, `${path}.createdAt`);
  isoDateTime(response.updatedAt, `${path}.updatedAt`);
  url(response.studioUrl, `${path}.studioUrl`);
  return response;
}

function validateProvenance(value: unknown, path: string): void {
  const provenance = record(value, path, [
    'environmentId',
    'environmentDeployId',
    'buildId',
    'gitSha',
    'mastraVersion',
    'nodeVersion',
    'serverArtifactId',
    'serverArtifactDigest',
    'workerArtifactId',
    'workerArtifactDigest',
    'targetType',
    'targetId',
    'datasetId',
    'datasetVersion',
    'datasetItemCount',
    'datasetDigest',
    'hostedAssets',
    'requestedAt',
  ]);
  for (const key of [
    'environmentId',
    'environmentDeployId',
    'buildId',
    'gitSha',
    'targetType',
    'targetId',
    'datasetId',
    'datasetDigest',
  ]) {
    nonEmptyString(provenance[key], `${path}.${key}`);
  }
  for (const key of [
    'mastraVersion',
    'nodeVersion',
    'serverArtifactId',
    'serverArtifactDigest',
    'workerArtifactId',
    'workerArtifactDigest',
  ]) {
    optionalNonEmptyString(provenance[key], `${path}.${key}`);
  }
  positiveInteger(provenance.datasetVersion, `${path}.datasetVersion`);
  nonnegativeInteger(provenance.datasetItemCount, `${path}.datasetItemCount`);
  if (provenance.hostedAssets !== undefined) validateHostedAssets(provenance.hostedAssets, `${path}.hostedAssets`);
  if (provenance.requestedAt !== undefined) isoDateTime(provenance.requestedAt, `${path}.requestedAt`);
}

function validateHostedAssets(value: unknown, path: string): void {
  const assets = record(value, path, ['datasetVersionId', 'scorers', 'provenance']);
  nonEmptyString(assets.datasetVersionId, `${path}.datasetVersionId`);
  const scorerKeys = array(assets.scorers, `${path}.scorers`).map((scorer, index) => {
    const scorerPath = `${path}.scorers[${index}]`;
    const pin = record(scorer, scorerPath, ['definitionId', 'versionId', 'versionNumber']);
    nonEmptyString(pin.definitionId, `${scorerPath}.definitionId`);
    nonEmptyString(pin.versionId, `${scorerPath}.versionId`);
    positiveInteger(pin.versionNumber, `${scorerPath}.versionNumber`);
    return `${pin.definitionId}\u0000${pin.versionId}`;
  });
  if (new Set(scorerKeys).size !== scorerKeys.length) invalid(`${path}.scorers must contain unique scorer references`);
  if (assets.provenance !== undefined) {
    const provenance = record(assets.provenance, `${path}.provenance`, [
      'investigationResultId',
      'candidateId',
      'candidateKey',
    ]);
    const present = ['investigationResultId', 'candidateId', 'candidateKey'].filter(
      key => provenance[key] !== undefined,
    );
    if (present.length === 0) invalid(`${path}.provenance must contain at least one provenance field`);
    present.forEach(key => nonEmptyString(provenance[key], `${path}.provenance.${key}`));
  }
}

function validateRunSummary(value: unknown, path: string): void {
  const run = record(value, path, [
    'status',
    'totalItems',
    'succeededCount',
    'failedCount',
    'skippedCount',
    'persistenceFailureCount',
    'completedWithErrors',
    'startedAt',
    'completedAt',
    'error',
  ]);
  enumValue(run.status, `${path}.status`, [
    'running',
    'completed',
    'completed-with-errors',
    'failed',
    'cancelled',
    'timed-out',
  ] as const);
  if (run.totalItems !== undefined) nonnegativeInteger(run.totalItems, `${path}.totalItems`);
  for (const key of ['succeededCount', 'failedCount', 'skippedCount', 'persistenceFailureCount']) {
    nonnegativeInteger(run[key], `${path}.${key}`);
  }
  if (run.completedWithErrors !== undefined) boolean(run.completedWithErrors, `${path}.completedWithErrors`);
  if (run.startedAt !== undefined) isoDateTime(run.startedAt, `${path}.startedAt`);
  if (run.completedAt !== undefined) isoDateTime(run.completedAt, `${path}.completedAt`);
}

function validateExperimentResultItem(value: unknown, index: number): void {
  const path = `response.items[${index}]`;
  const item = record(value, path, [
    'itemId',
    'itemIndex',
    'itemVersion',
    'status',
    'input',
    'output',
    'groundTruth',
    'error',
    'persistenceError',
    'scores',
    'toolMockReport',
    'retryCount',
    'sequence',
    'traceId',
    'startedAt',
    'completedAt',
  ]);
  nonEmptyString(item.itemId, `${path}.itemId`);
  nonnegativeInteger(item.itemIndex, `${path}.itemIndex`);
  if (item.itemVersion !== undefined) nonnegativeInteger(item.itemVersion, `${path}.itemVersion`);
  enumValue(item.status, `${path}.status`, ['succeeded', 'failed'] as const);
  nonnegativeInteger(item.retryCount, `${path}.retryCount`);
  nonnegativeInteger(item.sequence, `${path}.sequence`);
  optionalNonEmptyString(item.traceId, `${path}.traceId`);
  if (item.startedAt !== undefined) isoDateTime(item.startedAt, `${path}.startedAt`);
  if (item.completedAt !== undefined) isoDateTime(item.completedAt, `${path}.completedAt`);
}

function validatePagination(value: unknown, path: string): void {
  const pagination = record(value, path, ['page', 'perPage', 'total', 'hasMore']);
  positiveInteger(pagination.page, `${path}.page`);
  positiveInteger(pagination.perPage, `${path}.perPage`);
  if ((pagination.perPage as number) > 100) invalid(`${path}.perPage must be at most 100`);
  nonnegativeInteger(pagination.total, `${path}.total`);
  boolean(pagination.hasMore, `${path}.hasMore`);
}

function record(value: unknown, path: string, allowedKeys: string[]): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) invalid(`${path} must be an object`);
  const result = value as Record<string, unknown>;
  const extra = Object.keys(result).find(key => !allowedKeys.includes(key));
  if (extra) invalid(`${path} contains unrecognized field ${extra}`);
  return result;
}

function array(value: unknown, path: string): unknown[] {
  if (!Array.isArray(value)) invalid(`${path} must be an array`);
  return value;
}

function nonEmptyString(value: unknown, path: string): asserts value is string {
  if (typeof value !== 'string' || value.length === 0) invalid(`${path} must be a non-empty string`);
}

function optionalString(value: unknown, path: string): void {
  if (value !== undefined && typeof value !== 'string') invalid(`${path} must be a string`);
}

function optionalNonEmptyString(value: unknown, path: string): void {
  if (value !== undefined) nonEmptyString(value, path);
}

function positiveInteger(value: unknown, path: string): asserts value is number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value <= 0)
    invalid(`${path} must be a positive integer`);
}

function nonnegativeInteger(value: unknown, path: string): asserts value is number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0)
    invalid(`${path} must be a nonnegative integer`);
}

function boolean(value: unknown, path: string): asserts value is boolean {
  if (typeof value !== 'boolean') invalid(`${path} must be a boolean`);
}

function literal(value: unknown, path: string, expected: string): void {
  if (value !== expected) invalid(`${path} must be ${JSON.stringify(expected)}`);
}

function enumValue<const T extends readonly string[]>(
  value: unknown,
  path: string,
  values: T,
): asserts value is T[number] {
  if (typeof value !== 'string' || !values.includes(value)) invalid(`${path} must be one of ${values.join(', ')}`);
}

function stringMatching(value: unknown, path: string, pattern: RegExp, description: string): void {
  if (typeof value !== 'string' || !pattern.test(value)) invalid(`${path} must be ${description}`);
}

function isoDateTime(value: unknown, path: string): void {
  if (
    typeof value !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/.test(value) ||
    Number.isNaN(Date.parse(value))
  ) {
    invalid(`${path} must be an ISO datetime`);
  }
}

function url(value: unknown, path: string): void {
  if (typeof value !== 'string') invalid(`${path} must be a URL`);
  try {
    new URL(value);
  } catch {
    invalid(`${path} must be a URL`);
  }
}

class ResponseValidationError extends Error {}

function invalid(message: string): never {
  throw new ResponseValidationError(message);
}
