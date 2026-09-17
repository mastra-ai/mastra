import { createHmac } from 'node:crypto';

import { z } from 'zod';

import { integer, optionalSecret, configurationError } from './config/validation.js';

const environmentSchema = z.object({
  RUNTIME_MODE: z.enum(['local', 'staging', 'production']).default('local'),
  WEBHOOKS_ENABLED: z
    .enum(['true', 'false'])
    .default('false')
    .transform(value => value === 'true'),
  ALERT_WEBHOOK_SECRET: optionalSecret(16),
  ALERT_WEBHOOK_SOURCES: z.string().default('reference-auth'),
  WEBHOOK_MAX_BODY_BYTES: integer(65_536, 1_024, 262_144),
  MASTRA_MAX_BODY_BYTES: integer(1_048_576, 65_536, 4_194_304),
  OUTBOX_POLL_INTERVAL_MS: integer(250, 25, 60_000),
  OUTBOX_BATCH_SIZE: integer(16, 1, 100),
  OUTBOX_LEASE_MS: integer(10_000, 1_000, 300_000),
  OUTBOX_MAX_ATTEMPTS: integer(5, 1, 20),
  OUTBOX_BACKOFF_BASE_MS: integer(500, 10, 60_000),
  OUTBOX_BACKOFF_CAP_MS: integer(30_000, 100, 600_000),
  OUTBOX_RECOVERY_GRACE_MS: integer(10_000, 1_000, 600_000),
  PORT: integer(3_000, 1, 65_535),
});

export type ServerConfig = Readonly<{
  mode: 'local' | 'staging' | 'production';
  webhooksEnabled: boolean;
  alertWebhookSecret?: string;
  alertWebhookSources: ReadonlySet<string>;
  webhookMaxBodyBytes: number;
  mastraMaxBodyBytes: number;
  outbox: Readonly<{
    pollIntervalMs: number;
    batchSize: number;
    leaseMs: number;
    maxAttempts: number;
    backoffBaseMs: number;
    backoffCapMs: number;
    recoveryGraceMs: number;
  }>;
  port: number;
}>;

export function readServerConfig(environment: NodeJS.ProcessEnv = process.env): ServerConfig {
  const parsed = environmentSchema.safeParse(environment);
  if (!parsed.success) throw configurationError('server', parsed.error);
  const value = parsed.data;
  if (value.WEBHOOKS_ENABLED && !value.ALERT_WEBHOOK_SECRET) {
    throw new Error('ALERT_WEBHOOK_SECRET is required when webhooks are enabled.');
  }
  const sources = new Set(
    value.ALERT_WEBHOOK_SOURCES.split(',')
      .map(source => source.trim())
      .filter(source => /^[a-z0-9][a-z0-9._-]{0,63}$/u.test(source)),
  );
  if (sources.size === 0) throw new Error('No valid alert source configured.');
  return Object.freeze({
    mode: value.RUNTIME_MODE,
    webhooksEnabled: value.WEBHOOKS_ENABLED,
    ...(value.ALERT_WEBHOOK_SECRET ? { alertWebhookSecret: value.ALERT_WEBHOOK_SECRET } : {}),
    alertWebhookSources: sources,
    webhookMaxBodyBytes: value.WEBHOOK_MAX_BODY_BYTES,
    mastraMaxBodyBytes: value.MASTRA_MAX_BODY_BYTES,
    outbox: Object.freeze({
      pollIntervalMs: value.OUTBOX_POLL_INTERVAL_MS,
      batchSize: value.OUTBOX_BATCH_SIZE,
      leaseMs: value.OUTBOX_LEASE_MS,
      maxAttempts: value.OUTBOX_MAX_ATTEMPTS,
      backoffBaseMs: value.OUTBOX_BACKOFF_BASE_MS,
      backoffCapMs: value.OUTBOX_BACKOFF_CAP_MS,
      recoveryGraceMs: value.OUTBOX_RECOVERY_GRACE_MS,
    }),
    port: value.PORT,
  });
}

export { hasEnabledIntegration, readIntegrationConfig, type IntegrationConfig } from './config/integrations.js';

const agentEnvironmentSchema = z.object({
  MASTRA_MODEL: z.string().trim().min(1).default('openai/gpt-4o-mini'),
  // WorkOS and IPinfo run concurrently inside the integrated identity branch.
  // Leave headroom beyond either provider's 1.5 s deadline for parsing and
  // persistence instead of racing equal-duration timers.
  EVIDENCE_IDENTITY_TIMEOUT_MS: integer(4_000, 100, 30_000),
  EVIDENCE_ENDPOINT_TIMEOUT_MS: integer(1_500, 100, 30_000),
  EVIDENCE_CLOUD_TIMEOUT_MS: integer(1_500, 100, 30_000),
});

export type AgentConfig = Readonly<{
  model: string;
  timeouts: Readonly<Record<'identity' | 'endpoint' | 'cloud', number>>;
}>;

export function readAgentConfig(environment: NodeJS.ProcessEnv = process.env): AgentConfig {
  const parsed = agentEnvironmentSchema.safeParse(environment);
  if (!parsed.success) throw configurationError('agent', parsed.error);
  return Object.freeze({
    model: parsed.data.MASTRA_MODEL,
    timeouts: Object.freeze({
      identity: parsed.data.EVIDENCE_IDENTITY_TIMEOUT_MS,
      endpoint: parsed.data.EVIDENCE_ENDPOINT_TIMEOUT_MS,
      cloud: parsed.data.EVIDENCE_CLOUD_TIMEOUT_MS,
    }),
  });
}

const approvalEnvironmentSchema = z.object({
  RUNTIME_MODE: z.enum(['local', 'staging', 'production']).default('local'),
  LOCAL_APPROVALS_ENABLED: z
    .enum(['true', 'false'])
    .default('false')
    .transform(value => value === 'true'),
  LOCAL_APPROVAL_SECRET: optionalSecret(32),
  APPROVAL_RESUME_SECRET: optionalSecret(32),
  DASHBOARD_CSRF_SECRET: optionalSecret(32),
  CONTAINMENT_ACTION_TIMEOUT_MS: integer(1_000, 100, 10_000),
  CONTAINMENT_RATE_LIMIT: integer(8, 1, 32),
});

export type ApprovalConfig = Readonly<{
  mode: 'local' | 'staging' | 'production';
  localApprovalsEnabled: boolean;
  localApprovalSecret?: string;
  approvalResumeSecret?: string;
  actionTimeoutMs: number;
  rateLimit: number;
}>;

export function readApprovalConfig(environment: NodeJS.ProcessEnv = process.env): ApprovalConfig {
  const parsed = approvalEnvironmentSchema.safeParse(environment);
  if (!parsed.success) throw configurationError('approval', parsed.error);
  const value = parsed.data;
  const localApprovalRoot = value.RUNTIME_MODE === 'local' ? value.DASHBOARD_CSRF_SECRET : undefined;
  const localApprovalSecret =
    value.LOCAL_APPROVAL_SECRET ?? deriveLocalApprovalSecret(localApprovalRoot, 'local-decision');
  const approvalResumeSecret =
    value.APPROVAL_RESUME_SECRET ?? deriveLocalApprovalSecret(localApprovalRoot, 'workflow-resume');
  if (value.RUNTIME_MODE !== 'local' && !approvalResumeSecret) {
    throw new Error('APPROVAL_RESUME_SECRET is required outside local mode.');
  }
  if (
    value.LOCAL_APPROVALS_ENABLED &&
    (value.RUNTIME_MODE !== 'local' || !localApprovalSecret || !approvalResumeSecret)
  ) {
    throw new Error('Local approvals require local mode and dedicated decision/resume secrets.');
  }
  return Object.freeze({
    mode: value.RUNTIME_MODE,
    localApprovalsEnabled: value.LOCAL_APPROVALS_ENABLED,
    ...(localApprovalSecret ? { localApprovalSecret } : {}),
    ...(approvalResumeSecret ? { approvalResumeSecret } : {}),
    actionTimeoutMs: value.CONTAINMENT_ACTION_TIMEOUT_MS,
    rateLimit: value.CONTAINMENT_RATE_LIMIT,
  });
}

function deriveLocalApprovalSecret(
  root: string | undefined,
  purpose: 'local-decision' | 'workflow-resume',
): string | undefined {
  if (!root) return undefined;
  return createHmac('sha256', root).update(`security-incident-triage:approval:${purpose}:v1`).digest('hex');
}

const dashboardEnvironmentSchema = z.object({
  DASHBOARD_AUTH_ENABLED: z
    .enum(['true', 'false'])
    .default('false')
    .transform(value => value === 'true'),
  WORKOS_API_KEY: optionalSecret(16),
  WORKOS_CLIENT_ID: optionalSecret(8),
  WORKOS_REDIRECT_URI: z.url().optional(),
  WORKOS_COOKIE_PASSWORD: optionalSecret(32),
  DASHBOARD_ORIGIN: z.url().default('http://localhost:3000'),
  DASHBOARD_CSRF_SECRET: optionalSecret(32),
  DASHBOARD_SESSION_MAX_AGE_SECONDS: integer(28_800, 60, 28_800),
  DASHBOARD_SSE_MAX_CONNECTIONS: integer(4, 1, 16),
  DASHBOARD_TRUSTED_PROXY: z
    .enum(['true', 'false'])
    .default('false')
    .transform(value => value === 'true'),
});

export type DashboardConfig = Readonly<{
  enabled: boolean;
  workosApiKey?: string;
  workosClientId?: string;
  workosRedirectUri?: string;
  workosCookiePassword?: string;
  dashboardOrigin: string;
  csrfSecret?: string;
  sessionMaxAgeSeconds: number;
  sseMaxConnections: number;
  trustedProxy?: boolean;
}>;

/** Dashboard authentication is opt-in so local Studio runs never contact WorkOS. */
export function readDashboardConfig(environment: NodeJS.ProcessEnv = process.env): DashboardConfig {
  const parsed = dashboardEnvironmentSchema.safeParse(environment);
  if (!parsed.success) throw configurationError('dashboard', parsed.error);
  const value = parsed.data;
  if (value.DASHBOARD_AUTH_ENABLED) {
    const missingDashboardSettings = [
      ...(!value.WORKOS_API_KEY ? ['WORKOS_API_KEY'] : []),
      ...(!value.WORKOS_CLIENT_ID ? ['WORKOS_CLIENT_ID'] : []),
      ...(!value.WORKOS_REDIRECT_URI ? ['WORKOS_REDIRECT_URI'] : []),
      ...(!value.WORKOS_COOKIE_PASSWORD ? ['WORKOS_COOKIE_PASSWORD'] : []),
      ...(!value.DASHBOARD_CSRF_SECRET ? ['DASHBOARD_CSRF_SECRET'] : []),
    ];
    if (missingDashboardSettings.length > 0)
      throw new Error(
        `WorkOS dashboard authentication is incomplete. Missing: ${missingDashboardSettings.join(', ')}.`,
      );
  }
  return Object.freeze({
    enabled: value.DASHBOARD_AUTH_ENABLED,
    ...(value.WORKOS_API_KEY ? { workosApiKey: value.WORKOS_API_KEY } : {}),
    ...(value.WORKOS_CLIENT_ID ? { workosClientId: value.WORKOS_CLIENT_ID } : {}),
    ...(value.WORKOS_REDIRECT_URI ? { workosRedirectUri: value.WORKOS_REDIRECT_URI } : {}),
    ...(value.WORKOS_COOKIE_PASSWORD ? { workosCookiePassword: value.WORKOS_COOKIE_PASSWORD } : {}),
    dashboardOrigin: new URL(value.DASHBOARD_ORIGIN).origin,
    ...(value.DASHBOARD_CSRF_SECRET ? { csrfSecret: value.DASHBOARD_CSRF_SECRET } : {}),
    sessionMaxAgeSeconds: value.DASHBOARD_SESSION_MAX_AGE_SECONDS,
    sseMaxConnections: value.DASHBOARD_SSE_MAX_CONNECTIONS,
    trustedProxy: value.DASHBOARD_TRUSTED_PROXY,
  });
}
