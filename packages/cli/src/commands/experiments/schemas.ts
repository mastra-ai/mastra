import { ApiCliError } from '../api/errors.js';

export interface PlatformExperimentRunInput {
  experimentId: string;
  environmentId: string;
  datasetId: string;
  datasetVersion?: number;
  datasetVersionId?: string;
  target: { type: 'agent' | 'workflow'; id: string };
  scorers: Array<{ id: string; version: string }>;
  hostedScorers?: Array<{ definitionId: string; versionId: string }>;
  provenance?: { investigationResultId?: string; candidateId?: string; candidateKey?: string };
  limits: { concurrency: number; timeoutMs: number };
  policies: { allowedToolIds: string[]; allowedNetworkHosts: string[] };
  secretReferences: Array<{ name: string; reference: string }>;
  requestedAt: string;
  idempotencyKey: string;
  workerBuildRowId?: string;
}

export function parsePlatformExperimentRunInput(value: unknown): PlatformExperimentRunInput {
  const input = requireRecord(value, 'input');
  requireExactKeys(input, [
    'experimentId',
    'environmentId',
    'datasetId',
    'datasetVersion',
    'datasetVersionId',
    'target',
    'scorers',
    'hostedScorers',
    'provenance',
    'limits',
    'policies',
    'secretReferences',
    'requestedAt',
    'idempotencyKey',
    'workerBuildRowId',
  ]);

  const target = requireRecord(input.target, 'target');
  requireExactKeys(target, ['type', 'id']);
  const targetType = requireString(target.type, 'target.type');
  if (targetType !== 'agent' && targetType !== 'workflow') fail('target.type must be "agent" or "workflow"');

  const scorers = requireArray(input.scorers, 'scorers').map((value, index) => {
    const scorer = requireRecord(value, `scorers[${index}]`);
    requireExactKeys(scorer, ['id', 'version']);
    return {
      id: requireString(scorer.id, `scorers[${index}].id`),
      version: requireString(scorer.version, `scorers[${index}].version`),
    };
  });

  const hostedScorers =
    input.hostedScorers === undefined
      ? undefined
      : requireArray(input.hostedScorers, 'hostedScorers').map((value, index) => {
          const scorer = requireRecord(value, `hostedScorers[${index}]`);
          requireExactKeys(scorer, ['definitionId', 'versionId']);
          return {
            definitionId: requireString(scorer.definitionId, `hostedScorers[${index}].definitionId`),
            versionId: requireString(scorer.versionId, `hostedScorers[${index}].versionId`),
          };
        });
  if (hostedScorers?.length === 0) fail('hostedScorers must contain at least one scorer');

  const provenance = input.provenance === undefined ? undefined : parseProvenance(input.provenance);
  const limits = requireRecord(input.limits, 'limits');
  requireExactKeys(limits, ['concurrency', 'timeoutMs']);
  const policies = requireRecord(input.policies, 'policies');
  requireExactKeys(policies, ['allowedToolIds', 'allowedNetworkHosts']);

  const parsed: PlatformExperimentRunInput = {
    experimentId: requireString(input.experimentId, 'experimentId'),
    environmentId: requireString(input.environmentId, 'environmentId'),
    datasetId: requireString(input.datasetId, 'datasetId'),
    target: { type: targetType, id: requireString(target.id, 'target.id') },
    scorers,
    limits: {
      concurrency: requirePositiveInteger(limits.concurrency, 'limits.concurrency'),
      timeoutMs: requirePositiveInteger(limits.timeoutMs, 'limits.timeoutMs'),
    },
    policies: {
      allowedToolIds: requireStringArray(policies.allowedToolIds, 'policies.allowedToolIds'),
      allowedNetworkHosts: requireStringArray(policies.allowedNetworkHosts, 'policies.allowedNetworkHosts'),
    },
    secretReferences: requireArray(input.secretReferences, 'secretReferences').map((value, index) => {
      const reference = requireRecord(value, `secretReferences[${index}]`);
      requireExactKeys(reference, ['name', 'reference']);
      return {
        name: requireString(reference.name, `secretReferences[${index}].name`),
        reference: requireString(reference.reference, `secretReferences[${index}].reference`),
      };
    }),
    requestedAt: requireDateTime(input.requestedAt, 'requestedAt'),
    idempotencyKey: requireString(input.idempotencyKey, 'idempotencyKey'),
  };

  if (input.datasetVersion !== undefined)
    parsed.datasetVersion = requirePositiveInteger(input.datasetVersion, 'datasetVersion');
  if (input.datasetVersionId !== undefined)
    parsed.datasetVersionId = requireString(input.datasetVersionId, 'datasetVersionId');
  if (hostedScorers) parsed.hostedScorers = hostedScorers;
  if (provenance) parsed.provenance = provenance;
  if (input.workerBuildRowId !== undefined)
    parsed.workerBuildRowId = requireUuid(input.workerBuildRowId, 'workerBuildRowId');

  if (parsed.hostedScorers && !parsed.datasetVersionId) fail('hostedScorers requires datasetVersionId');
  if (parsed.datasetVersionId && parsed.datasetVersion !== undefined)
    fail('datasetVersion cannot be combined with datasetVersionId');
  if (parsed.hostedScorers && parsed.scorers.length > 0)
    fail('hostedScorers cannot be combined with worker registry scorers');
  if (parsed.provenance && !parsed.datasetVersionId) fail('provenance requires hosted asset references');
  if (parsed.hostedScorers) {
    const keys = parsed.hostedScorers.map(scorer => `${scorer.definitionId}\u0000${scorer.versionId}`);
    if (new Set(keys).size !== keys.length) fail('Hosted scorer references must be unique');
  }

  return parsed;
}

function parseProvenance(value: unknown): NonNullable<PlatformExperimentRunInput['provenance']> {
  const provenance = requireRecord(value, 'provenance');
  requireExactKeys(provenance, ['investigationResultId', 'candidateId', 'candidateKey']);
  const parsed: NonNullable<PlatformExperimentRunInput['provenance']> = {};
  if (provenance.investigationResultId !== undefined)
    parsed.investigationResultId = requireString(provenance.investigationResultId, 'provenance.investigationResultId');
  if (provenance.candidateId !== undefined)
    parsed.candidateId = requireString(provenance.candidateId, 'provenance.candidateId');
  if (provenance.candidateKey !== undefined)
    parsed.candidateKey = requireString(provenance.candidateKey, 'provenance.candidateKey');
  if (Object.keys(parsed).length === 0) fail('At least one provenance field is required');
  return parsed;
}

function requireRecord(value: unknown, path: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(`${path} must be an object`);
  return value as Record<string, unknown>;
}

function requireExactKeys(value: Record<string, unknown>, allowed: string[]): void {
  const extra = Object.keys(value).find(key => !allowed.includes(key));
  if (extra) fail(`Unrecognized field: ${extra}`);
}

function requireArray(value: unknown, path: string): unknown[] {
  if (!Array.isArray(value)) fail(`${path} must be an array`);
  return value;
}

function requireString(value: unknown, path: string): string {
  if (typeof value !== 'string' || value.length === 0) fail(`${path} must be a non-empty string`);
  return value;
}

function requireStringArray(value: unknown, path: string): string[] {
  return requireArray(value, path).map((item, index) => requireString(item, `${path}[${index}]`));
}

function requirePositiveInteger(value: unknown, path: string): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value <= 0) fail(`${path} must be a positive integer`);
  return value;
}

function requireDateTime(value: unknown, path: string): string {
  const dateTime = requireString(value, path);
  if (Number.isNaN(Date.parse(dateTime))) fail(`${path} must be an ISO datetime`);
  return dateTime;
}

function requireUuid(value: unknown, path: string): string {
  const uuid = requireString(value, path);
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(uuid))
    fail(`${path} must be a UUID`);
  return uuid;
}

function fail(message: string): never {
  throw new ApiCliError('INVALID_JSON', `Invalid Platform experiment input: ${message}`);
}
