import { z } from 'zod';

import { optionalSecret as secretSchema, configurationError } from './validation.js';

const optionalSecret = secretSchema();
const providerFlag = z
  .enum(['true', 'false'])
  .default('false')
  .transform(value => value === 'true');
const csv = z.string().default('');
const incidentStatusKeys = [
  'received',
  'investigating',
  'awaiting_approval',
  'approved',
  'rejected',
  'containing',
  'contained',
  'failed',
  'closed',
] as const;
const integrationEnvironmentSchema = z.object({
  RUNTIME_MODE: z.enum(['local', 'staging', 'production']).default('local'),
  WEBHOOKS_ENABLED: providerFlag,
  WORKOS_API_KEY: optionalSecret,
  WORKOS_PROVIDER_ENABLED: providerFlag,
  WORKOS_WEBHOOK_SECRET: optionalSecret,
  WORKOS_WEBHOOK_PREVIOUS_SECRET: optionalSecret,
  WORKOS_ORGANIZATION_ID: z.string().trim().default(''),
  WORKOS_ALLOWED_USER_IDS: csv,
  WORKOS_ALLOWED_ROLE_SLUGS: csv,
  DEVICE_TRUST_PROVIDER_ENABLED: providerFlag,
  DEVICE_TRUST_ALERT_SOURCE: z
    .string()
    .trim()
    .regex(/^[a-z0-9][a-z0-9._-]{0,63}$/u)
    .default('first-party-device-trust'),
  IPINFO_PROVIDER_ENABLED: providerFlag,
  IPINFO_TOKEN: optionalSecret,
  GEOIP_CACHE_HMAC_KEY: optionalSecret,
  GEOIP_CACHE_HMAC_KEY_VERSION: z.string().trim().optional(),
  GEOIP_CACHE_HMAC_PREVIOUS_KEY: optionalSecret,
  GEOIP_CACHE_HMAC_PREVIOUS_KEY_VERSION: z.string().trim().optional(),
  IPINFO_TIMEOUT_MS: z.coerce.number().int().min(100).max(10_000).default(1_500),
  LINEAR_PROVIDER_ENABLED: providerFlag,
  LINEAR_API_KEY: optionalSecret,
  LINEAR_WORKSPACE_ID: z.string().trim().default(''),
  LINEAR_TEAM_ID: z.string().trim().default(''),
  LINEAR_PROJECT_ID: z.string().trim().default(''),
  LINEAR_SEVERITY_LABEL_IDS_JSON: z.string().trim().default(''),
  LINEAR_STATUS_STATE_IDS_JSON: z.string().trim().default(''),
  LINEAR_SEVERITY_LABEL_NAMES_JSON: z.string().trim().default(''),
  LINEAR_STATUS_STATE_NAMES_JSON: z.string().trim().default(''),
  LINEAR_INTERNAL_BASE_URL: z.string().trim().default(''),
});

export type IntegrationConfig = Readonly<{
  mode: 'local' | 'staging' | 'production';
  workos: Readonly<{
    enabled: boolean;
    apiKey?: string;
    webhookSecret?: string;
    previousWebhookSecret?: string;
    organizationId?: string;
    allowedUserIds: ReadonlySet<string>;
    allowedRoleSlugs: ReadonlySet<string>;
  }>;
  deviceTrust: Readonly<{
    enabled: boolean;
    alertSource: string;
  }>;
  ipinfo: Readonly<{
    enabled: boolean;
    token?: string;
    /** Canonical, decoded HMAC key material. Never log or persist this. */
    cacheHmacKey?: Uint8Array;
    /** Stable label persisted beside entries written with the current key. */
    cacheHmacKeyVersion?: string;
    /** Optional prior key used only for cache read-through during rotation. */
    previousCacheHmacKey?: Uint8Array;
    /** Required exactly when the previous key is configured. */
    previousCacheHmacKeyVersion?: string;
    timeoutMs: number;
    cacheTtlSeconds: 86400;
    evidenceRetentionDays: 30;
    confidence: 0.7;
  }>;
  linear: Readonly<{
    enabled: boolean;
    apiKey?: string;
    workspaceId?: string;
    teamId?: string;
    projectId?: string;
    severityLabelIds?: Readonly<Partial<Record<'low' | 'medium' | 'high' | 'critical', string>>>;
    statusStateIds?: Readonly<Record<string, string>>;
    severityLabelNames?: Readonly<Record<string, string>>;
    statusStateNames?: Readonly<Record<string, string>>;
    internalBaseUrl?: string;
  }>;
}>;

export function hasEnabledIntegration(config: IntegrationConfig): boolean {
  return config.workos.enabled || config.deviceTrust.enabled || config.ipinfo.enabled || config.linear.enabled;
}

function isPlaceholder(value: string): boolean {
  return value.length === 0 || /<[^>]+>/u.test(value);
}

/** Provider credentials are never accepted as short placeholder-like values. */
function hasMinimumSecretLength(value: string | undefined, minimumLength = 16): boolean {
  return typeof value === 'string' && value.trim() === value && value.length >= minimumLength;
}

function readCsv(value: string, name: string): ReadonlySet<string> {
  const entries = value
    .split(',')
    .map(item => item.trim())
    .filter(Boolean);
  if (entries.some(isPlaceholder) || new Set(entries).size !== entries.length) throw new Error(`Invalid ${name}.`);
  return new Set(entries);
}

function parseIdMap(value: string, name: string, exactKeys?: readonly string[]) {
  if (isPlaceholder(value)) throw new Error(`Invalid ${name}.`);
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    throw new Error(`Invalid ${name}.`);
  }
  const result = z
    .record(
      z.string(),
      z
        .string()
        .min(1)
        .refine(id => !isPlaceholder(id)),
    )
    .safeParse(parsed);
  if (!result.success) throw new Error(`Invalid ${name}.`);
  const record = result.data;
  if (
    exactKeys &&
    (Object.keys(record).length !== exactKeys.length || exactKeys.some(key => !Object.hasOwn(record, key)))
  ) {
    throw new Error(`Invalid ${name}.`);
  }
  return Object.freeze(record);
}

/**
 * Cache keys are deliberately encoded rather than accepted as arbitrary text:
 * this makes an accidental short password or an unmarked encoding fail at
 * process start.  The prefix also keeps a hex key from being mistaken for
 * base64 during a rotation.
 */
function readGeoIpCacheHmacKey(value: string | undefined, name: string) {
  if (!value || isPlaceholder(value)) throw new Error(`Invalid ${name}.`);
  const match = /^(hex|base64):(.+)$/u.exec(value);
  if (!match) throw new Error(`Invalid ${name}.`);
  const encoding = match[1] as 'hex' | 'base64';
  const encoded = match[2] as string;
  if (
    (encoding === 'hex' && (!/^[0-9a-fA-F]+$/u.test(encoded) || encoded.length % 2 !== 0)) ||
    (encoding === 'base64' && (!/^[A-Za-z0-9+/]*={0,2}$/u.test(encoded) || encoded.length % 4 !== 0))
  )
    throw new Error(`Invalid ${name}.`);
  const decoded = Buffer.from(encoded, encoding);
  // Reject non-canonical base64 (for example, silently ignored whitespace).
  if (
    decoded.length < 32 ||
    (encoding === 'hex'
      ? decoded.toString('hex').toLowerCase() !== encoded.toLowerCase()
      : decoded.toString('base64') !== encoded)
  )
    throw new Error(`Invalid ${name}.`);
  return new Uint8Array(decoded);
}

function readGeoIpCacheHmacKeyVersion(value: string | undefined, name: string): string {
  if (!value || isPlaceholder(value) || !/^[a-z][a-z0-9._-]{0,63}$/u.test(value)) throw new Error(`Invalid ${name}.`);
  return value;
}

export function readIntegrationConfig(environment: NodeJS.ProcessEnv = process.env): IntegrationConfig {
  const parsed = integrationEnvironmentSchema.safeParse(environment);
  if (!parsed.success) throw configurationError('integration', parsed.error);
  const value = parsed.data;
  const workosUsers = value.WORKOS_PROVIDER_ENABLED
    ? readCsv(value.WORKOS_ALLOWED_USER_IDS, 'WORKOS_ALLOWED_USER_IDS')
    : new Set<string>();
  const workosRoles = value.WORKOS_PROVIDER_ENABLED
    ? readCsv(value.WORKOS_ALLOWED_ROLE_SLUGS, 'WORKOS_ALLOWED_ROLE_SLUGS')
    : new Set<string>();
  if (value.WORKOS_PROVIDER_ENABLED) {
    const invalidWorkosSettings = [
      ...(!value.WEBHOOKS_ENABLED ? ['WEBHOOKS_ENABLED=true'] : []),
      ...(!hasMinimumSecretLength(value.WORKOS_API_KEY) ? ['WORKOS_API_KEY'] : []),
      ...(!hasMinimumSecretLength(value.WORKOS_WEBHOOK_SECRET) ? ['WORKOS_WEBHOOK_SECRET'] : []),
      ...(isPlaceholder(value.WORKOS_ORGANIZATION_ID) ? ['WORKOS_ORGANIZATION_ID'] : []),
      ...(workosRoles.size === 0 ? ['WORKOS_ALLOWED_ROLE_SLUGS'] : []),
      ...(value.WORKOS_WEBHOOK_PREVIOUS_SECRET && value.WORKOS_WEBHOOK_SECRET === value.WORKOS_WEBHOOK_PREVIOUS_SECRET
        ? ['WORKOS_WEBHOOK_PREVIOUS_SECRET must differ from the current secret']
        : []),
    ];
    if (invalidWorkosSettings.length > 0)
      throw new Error(
        `WorkOS provider configuration is incomplete. Missing or invalid: ${invalidWorkosSettings.join(', ')}.`,
      );
  }
  if (value.DEVICE_TRUST_PROVIDER_ENABLED && !value.WEBHOOKS_ENABLED)
    throw new Error('Device trust provider requires WEBHOOKS_ENABLED=true.');
  if (
    value.IPINFO_PROVIDER_ENABLED &&
    // IPinfo currently issues 14-character API tokens. Do not apply the
    // generic 16-character provider heuristic to a valid vendor credential.
    (!hasMinimumSecretLength(value.IPINFO_TOKEN, 14) ||
      !value.GEOIP_CACHE_HMAC_KEY ||
      !value.GEOIP_CACHE_HMAC_KEY_VERSION)
  )
    throw new Error(
      'IPinfo provider configuration is incomplete. Check IPINFO_TOKEN and the current/previous GEOIP_CACHE_HMAC_KEY and GEOIP_CACHE_HMAC_KEY_VERSION pairs.',
    );
  const cacheHmacKey = value.IPINFO_PROVIDER_ENABLED
    ? readGeoIpCacheHmacKey(value.GEOIP_CACHE_HMAC_KEY, 'GEOIP_CACHE_HMAC_KEY')
    : undefined;
  const cacheHmacKeyVersion = value.IPINFO_PROVIDER_ENABLED
    ? readGeoIpCacheHmacKeyVersion(value.GEOIP_CACHE_HMAC_KEY_VERSION, 'GEOIP_CACHE_HMAC_KEY_VERSION')
    : undefined;
  if (
    value.IPINFO_PROVIDER_ENABLED &&
    Boolean(value.GEOIP_CACHE_HMAC_PREVIOUS_KEY) !== Boolean(value.GEOIP_CACHE_HMAC_PREVIOUS_KEY_VERSION)
  )
    throw new Error(
      'IPinfo provider configuration is incomplete. Check IPINFO_TOKEN and the current/previous GEOIP_CACHE_HMAC_KEY and GEOIP_CACHE_HMAC_KEY_VERSION pairs.',
    );
  const previousCacheHmacKey =
    value.IPINFO_PROVIDER_ENABLED && value.GEOIP_CACHE_HMAC_PREVIOUS_KEY
      ? readGeoIpCacheHmacKey(value.GEOIP_CACHE_HMAC_PREVIOUS_KEY, 'GEOIP_CACHE_HMAC_PREVIOUS_KEY')
      : undefined;
  const previousCacheHmacKeyVersion =
    value.IPINFO_PROVIDER_ENABLED && value.GEOIP_CACHE_HMAC_PREVIOUS_KEY_VERSION
      ? readGeoIpCacheHmacKeyVersion(
          value.GEOIP_CACHE_HMAC_PREVIOUS_KEY_VERSION,
          'GEOIP_CACHE_HMAC_PREVIOUS_KEY_VERSION',
        )
      : undefined;
  if (
    value.IPINFO_PROVIDER_ENABLED &&
    previousCacheHmacKey &&
    cacheHmacKey &&
    (Buffer.from(previousCacheHmacKey).equals(Buffer.from(cacheHmacKey)) ||
      previousCacheHmacKeyVersion === cacheHmacKeyVersion)
  )
    throw new Error(
      'IPinfo provider configuration is incomplete. Check IPINFO_TOKEN and the current/previous GEOIP_CACHE_HMAC_KEY and GEOIP_CACHE_HMAC_KEY_VERSION pairs.',
    );
  const severityLabelNames =
    value.LINEAR_PROVIDER_ENABLED && value.LINEAR_SEVERITY_LABEL_NAMES_JSON
      ? parseNameMap(value.LINEAR_SEVERITY_LABEL_NAMES_JSON, 'LINEAR_SEVERITY_LABEL_NAMES_JSON', [
          'low',
          'medium',
          'high',
          'critical',
        ])
      : undefined;
  const statusStateNames =
    value.LINEAR_PROVIDER_ENABLED && value.LINEAR_STATUS_STATE_NAMES_JSON
      ? parseNameMap(value.LINEAR_STATUS_STATE_NAMES_JSON, 'LINEAR_STATUS_STATE_NAMES_JSON', incidentStatusKeys)
      : undefined;
  const severityLabelIds =
    value.LINEAR_PROVIDER_ENABLED && value.LINEAR_SEVERITY_LABEL_IDS_JSON
      ? parseIdMap(value.LINEAR_SEVERITY_LABEL_IDS_JSON, 'LINEAR_SEVERITY_LABEL_IDS_JSON', [
          'low',
          'medium',
          'high',
          'critical',
        ])
      : undefined;
  const statusStateIds =
    value.LINEAR_PROVIDER_ENABLED && value.LINEAR_STATUS_STATE_IDS_JSON
      ? parseIdMap(value.LINEAR_STATUS_STATE_IDS_JSON, 'LINEAR_STATUS_STATE_IDS_JSON', incidentStatusKeys)
      : undefined;
  if (
    value.LINEAR_PROVIDER_ENABLED &&
    (!hasMinimumSecretLength(value.LINEAR_API_KEY) ||
      isPlaceholder(value.LINEAR_WORKSPACE_ID) ||
      isPlaceholder(value.LINEAR_TEAM_ID) ||
      isPlaceholder(value.LINEAR_INTERNAL_BASE_URL))
  )
    throw new Error(
      'Linear provider configuration is incomplete. Check LINEAR_API_KEY, LINEAR_WORKSPACE_ID, LINEAR_TEAM_ID and LINEAR_INTERNAL_BASE_URL.',
    );
  if (value.LINEAR_PROVIDER_ENABLED) {
    let url: URL;
    try {
      url = new URL(value.LINEAR_INTERNAL_BASE_URL);
    } catch {
      throw new Error('LINEAR_INTERNAL_BASE_URL must be an HTTPS base URL.');
    }
    if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash)
      throw new Error('LINEAR_INTERNAL_BASE_URL must be an allowlisted HTTPS base URL.');
  }
  return Object.freeze({
    mode: value.RUNTIME_MODE,
    workos: Object.freeze({
      enabled: value.WORKOS_PROVIDER_ENABLED,
      ...(value.WORKOS_API_KEY ? { apiKey: value.WORKOS_API_KEY } : {}),
      ...(value.WORKOS_WEBHOOK_SECRET ? { webhookSecret: value.WORKOS_WEBHOOK_SECRET } : {}),
      ...(value.WORKOS_WEBHOOK_PREVIOUS_SECRET ? { previousWebhookSecret: value.WORKOS_WEBHOOK_PREVIOUS_SECRET } : {}),
      ...(!isPlaceholder(value.WORKOS_ORGANIZATION_ID) ? { organizationId: value.WORKOS_ORGANIZATION_ID } : {}),
      allowedUserIds: workosUsers,
      allowedRoleSlugs: workosRoles,
    }),
    deviceTrust: Object.freeze({
      enabled: value.DEVICE_TRUST_PROVIDER_ENABLED,
      alertSource: value.DEVICE_TRUST_ALERT_SOURCE,
    }),
    ipinfo: Object.freeze({
      enabled: value.IPINFO_PROVIDER_ENABLED,
      ...(value.IPINFO_TOKEN ? { token: value.IPINFO_TOKEN } : {}),
      ...(cacheHmacKey ? { cacheHmacKey } : {}),
      ...(cacheHmacKeyVersion ? { cacheHmacKeyVersion } : {}),
      ...(previousCacheHmacKey ? { previousCacheHmacKey } : {}),
      ...(previousCacheHmacKeyVersion ? { previousCacheHmacKeyVersion } : {}),
      timeoutMs: value.IPINFO_TIMEOUT_MS,
      cacheTtlSeconds: 86400,
      evidenceRetentionDays: 30,
      confidence: 0.7,
    }),
    linear: Object.freeze({
      enabled: value.LINEAR_PROVIDER_ENABLED,
      ...(value.LINEAR_API_KEY ? { apiKey: value.LINEAR_API_KEY } : {}),
      ...(!isPlaceholder(value.LINEAR_WORKSPACE_ID) ? { workspaceId: value.LINEAR_WORKSPACE_ID } : {}),
      ...(!isPlaceholder(value.LINEAR_TEAM_ID) ? { teamId: value.LINEAR_TEAM_ID } : {}),
      ...(!isPlaceholder(value.LINEAR_PROJECT_ID) ? { projectId: value.LINEAR_PROJECT_ID } : {}),
      ...(severityLabelIds ? { severityLabelIds } : {}),
      ...(statusStateIds ? { statusStateIds } : {}),
      ...(severityLabelNames ? { severityLabelNames } : {}),
      ...(statusStateNames ? { statusStateNames } : {}),
      ...(!isPlaceholder(value.LINEAR_INTERNAL_BASE_URL) ? { internalBaseUrl: value.LINEAR_INTERNAL_BASE_URL } : {}),
    }),
  });
}

function parseNameMap(value: string, name: string, keys: readonly string[]) {
  const entries = Object.entries(parseIdMap(value, name));
  if (entries.some(([key, label]) => !keys.includes(key) || !label.trim())) throw new Error(`Invalid ${name}.`);
  return Object.freeze(Object.fromEntries(entries.map(([key, label]) => [key, label.trim()])));
}
