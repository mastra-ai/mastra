import type { EvidenceFact } from '../evidence/contracts.js';
import type { EndpointEvidenceProvider, SafeProviderCall } from './evidence-provider.js';
import type { EvidenceProviderInput } from '../evidence/contracts.js';
import type { OperationalStore } from '../db/operational-store.js';
import { readDeviceTrustForIncident } from '../db/device-trust-operations.js';
import { EvidenceProviderInputSchema, EvidenceProviderResultSchema } from '../evidence/contracts.js';
import { executeLocalInspection, type LocalProviderOptions } from './local-evidence.js';

export class LocalEndpointEvidenceProvider implements EndpointEvidenceProvider {
  readonly source = 'endpoint' as const;
  readonly providerId = 'local-endpoint';
  readonly calls: SafeProviderCall[] = [];
  constructor(
    private readonly options: LocalProviderOptions & {
      openStore?: () => OperationalStore;
      verifyDeviceSignature?: (input: EvidenceProviderInput) => boolean;
    } = {},
  ) {}
  async inspect(
    input: Parameters<EndpointEvidenceProvider['inspect']>[0],
    options: Parameters<EndpointEvidenceProvider['inspect']>[1],
  ) {
    return executeLocalInspection({
      provider: this.providerId,
      providerRef: 'endpoint',
      request: input,
      signal: options.signal,
      attempt: options.attempt,
      behavior: this.options.behavior ?? 'success',
      ...(this.options.release ? { release: this.options.release } : {}),
      ...(this.options.onStart ? { onStart: this.options.onStart } : {}),
      callLog: this.calls,
      facts: async request =>
        endpointFacts(
          request,
          await isDeviceAuthorized(this.options.openStore, request),
          this.options.verifyDeviceSignature,
        ),
    });
  }
}

/**
 * Verifies the application-owned Ed25519 attestation and its tenant-scoped
 * authorization record. It never treats the alert body itself as proof.
 */
export class FirstPartyDeviceTrustEvidenceProvider implements EndpointEvidenceProvider {
  readonly source = 'endpoint' as const;
  readonly providerId = 'first-party-device-trust';
  readonly calls: SafeProviderCall[] = [];

  constructor(private readonly openStore: () => OperationalStore) {}

  async inspect(
    input: Parameters<EndpointEvidenceProvider['inspect']>[0],
    options: Parameters<EndpointEvidenceProvider['inspect']>[1],
  ) {
    const parsed = EvidenceProviderInputSchema.parse(input);
    this.calls.push({
      tenantId: parsed.tenantId,
      incidentId: parsed.incidentId,
      subjectId: parsed.subjectId,
      workflowRunId: parsed.workflowRunId,
      attempt: options.attempt,
    });
    if (options.signal.aborted)
      return EvidenceProviderResultSchema.parse({
        status: 'aborted',
        provider: this.providerId,
        error: {
          code: 'ABORTED',
          retryable: false,
          safeRef: 'provider:endpoint:aborted',
          attempt: options.attempt,
        },
      });
    if (parsed.incidentKind !== 'unknown_device_login')
      return EvidenceProviderResultSchema.parse({
        status: 'success',
        provider: this.providerId,
        facts: [booleanFact(parsed.occurredAt, 'inspection-applicable', 'endpoint.inspectionApplicable', false)],
      });
    const store = this.openStore();
    try {
      const state = await readDeviceTrustForIncident(store, parsed);
      const devicePresent = Boolean(parsed.deviceId);
      return EvidenceProviderResultSchema.parse({
        status: 'success',
        provider: this.providerId,
        facts: [
          booleanFact(
            parsed.occurredAt,
            'device-identifier-present',
            'device.identifierPresent',
            devicePresent,
            !devicePresent,
          ),
          ...(devicePresent
            ? [
                booleanFact(
                  parsed.occurredAt,
                  'device-signature-valid',
                  'device.signatureValid',
                  state?.signatureValid === true,
                ),
                booleanFact(
                  parsed.occurredAt,
                  'device-authorized',
                  'device.authorized',
                  state?.authorizedAtIncident === true,
                ),
              ]
            : []),
        ],
      });
    } finally {
      store.close();
    }
  }
}

export class DisabledEndpointEvidenceProvider implements EndpointEvidenceProvider {
  readonly source = 'endpoint' as const;
  readonly providerId = 'device-trust-disabled';

  async inspect(
    input: Parameters<EndpointEvidenceProvider['inspect']>[0],
    options: Parameters<EndpointEvidenceProvider['inspect']>[1],
  ) {
    const parsed = EvidenceProviderInputSchema.parse(input);
    if (parsed.incidentKind !== 'unknown_device_login')
      return EvidenceProviderResultSchema.parse({
        status: 'success',
        provider: this.providerId,
        facts: [booleanFact(parsed.occurredAt, 'inspection-applicable', 'endpoint.inspectionApplicable', false)],
      });
    return EvidenceProviderResultSchema.parse({
      status: 'unavailable',
      provider: this.providerId,
      error: {
        code: 'UNAVAILABLE',
        retryable: true,
        safeRef: 'provider:endpoint:not-configured',
        attempt: options.attempt,
      },
    });
  }
}

async function endpointFacts(
  input: EvidenceProviderInput,
  authorized: boolean,
  verifyDeviceSignature?: (input: EvidenceProviderInput) => boolean,
): Promise<readonly EvidenceFact[]> {
  const { occurredAt: observedAt, incidentKind, deviceId } = input;
  if (incidentKind !== 'unknown_device_login')
    return [booleanFact(observedAt, 'inspection-applicable', 'endpoint.inspectionApplicable', false)];
  const identifier = booleanFact(
    observedAt,
    'device-identifier-present',
    'device.identifierPresent',
    deviceId !== undefined,
    deviceId === undefined,
  );
  if (!deviceId) return [identifier];
  return [
    identifier,
    booleanFact(observedAt, 'device-signature-valid', 'device.signatureValid', verifyDeviceSignature?.(input) === true),
    booleanFact(observedAt, 'device-authorized', 'device.authorized', authorized),
  ];
}

async function isDeviceAuthorized(
  openStore: (() => OperationalStore) | undefined,
  input: EvidenceProviderInput,
): Promise<boolean> {
  if (!openStore || !input.deviceId) return false;
  const store = openStore();
  try {
    const result = await store.execute({
      sql: `SELECT 1 FROM authorized_devices
        WHERE tenant_id = ? AND subject_id = ? AND device_id = ?
          AND authorized_at <= ? AND (revoked_at IS NULL OR revoked_at > ?)
        LIMIT 1`,
      args: [input.tenantId, input.subjectId, input.deviceId, input.occurredAt, input.occurredAt],
    });
    return result.rows.length === 1;
  } finally {
    store.close();
  }
}

function booleanFact(
  observedAt: string,
  semanticKey: string,
  factType: string,
  value: boolean,
  incomplete = false,
): EvidenceFact {
  return {
    semanticKey,
    observedAt,
    factType,
    value,
    confidence: 1,
    confidenceProvenance: 'rule-v1',
    rawPayloadRef: `protected:endpoint:${semanticKey}`,
    sensitivity: 'confidential',
    incomplete,
  };
}
