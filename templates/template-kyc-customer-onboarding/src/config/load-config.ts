import { resolve } from 'node:path';

import { z } from 'zod';

import { appConfigSchema, type AppConfig } from './app-config.schema.js';
import { environmentSchema, type Environment } from './env.schema.js';
import { deepFreeze } from '../domain/immutable.js';

const projectRoot = resolve(import.meta.dirname, '../..');

const resolveFileUrl = (url: string): string => `file:${resolve(projectRoot, url.slice('file:'.length))}`;

export type { AppConfig } from './app-config.schema.js';

const environmentKeys = new Set(Object.keys(environmentSchema.shape));
const projectScalarKeys = new Set(['HOST', 'PORT']);
const projectPrefixes = [
  'APP_',
  'PORTAL_',
  'LIBSQL_',
  'DUCKDB_',
  'KYC_',
  'DOCUMENT_',
  'OPENAI_',
  'IDENTITY_',
  'ADDRESS_',
  'SANCTIONS_',
  'PEP_',
  'NOTIFICATION_',
  'WEBHOOK_',
  'PROVISIONING_',
  'PROVIDER_',
  'RISK_',
];

const rejectUnknownProjectKeys = (source: NodeJS.ProcessEnv): void => {
  const unknown = Object.keys(source).filter(
    key =>
      (projectScalarKeys.has(key) || projectPrefixes.some(prefix => key.startsWith(prefix))) &&
      !environmentKeys.has(key),
  );
  if (unknown.length > 0) {
    throw new Error(`Unknown project configuration keys: ${unknown.sort().join(', ')}`);
  }
};

const selectEnvironment = (source: NodeJS.ProcessEnv): Record<keyof Environment, string | undefined> => ({
  APP_ENV: source.APP_ENV,
  HOST: source.HOST,
  PORT: source.PORT,
  PORTAL_ORIGIN: source.PORTAL_ORIGIN,
  OPENAPI_PATH: source.OPENAPI_PATH,
  DEMO_DATA_ROOT: source.DEMO_DATA_ROOT,
  LIBSQL_DOMAIN_URL: source.LIBSQL_DOMAIN_URL,
  LIBSQL_MASTRA_URL: source.LIBSQL_MASTRA_URL,
  DUCKDB_URL: source.DUCKDB_URL,
  DOCUMENT_STORAGE_PATH: source.DOCUMENT_STORAGE_PATH,
  KYC_DEFAULT_TENANT_ID: source.KYC_DEFAULT_TENANT_ID,
  KYC_DEFAULT_JURISDICTION: source.KYC_DEFAULT_JURISDICTION,
  KYC_DEFAULT_POLICY_PROFILE: source.KYC_DEFAULT_POLICY_PROFILE,
  KYC_PII_MODE: source.KYC_PII_MODE,
  KYC_LOCALE: source.KYC_LOCALE,
  KYC_EXTERNAL_PII_PROVIDER_ALLOWLIST: source.KYC_EXTERNAL_PII_PROVIDER_ALLOWLIST,
  KYC_CUSTOMER_WEBHOOK_CURRENT_SECRET: source.KYC_CUSTOMER_WEBHOOK_CURRENT_SECRET,
  KYC_CUSTOMER_WEBHOOK_PREVIOUS_SECRET: source.KYC_CUSTOMER_WEBHOOK_PREVIOUS_SECRET,
  KYC_COMPLIANCE_REVIEWER_WEBHOOK_CURRENT_SECRET: source.KYC_COMPLIANCE_REVIEWER_WEBHOOK_CURRENT_SECRET,
  KYC_COMPLIANCE_REVIEWER_WEBHOOK_PREVIOUS_SECRET: source.KYC_COMPLIANCE_REVIEWER_WEBHOOK_PREVIOUS_SECRET,
  KYC_COMPLIANCE_SENIOR_WEBHOOK_CURRENT_SECRET: source.KYC_COMPLIANCE_SENIOR_WEBHOOK_CURRENT_SECRET,
  KYC_COMPLIANCE_SENIOR_WEBHOOK_PREVIOUS_SECRET: source.KYC_COMPLIANCE_SENIOR_WEBHOOK_PREVIOUS_SECRET,
  KYC_OUTBOUND_WEBHOOK_CURRENT_SECRET: source.KYC_OUTBOUND_WEBHOOK_CURRENT_SECRET,
  KYC_OUTBOUND_WEBHOOK_PREVIOUS_SECRET: source.KYC_OUTBOUND_WEBHOOK_PREVIOUS_SECRET,
  KYC_OUTBOUND_WEBHOOK_URL: source.KYC_OUTBOUND_WEBHOOK_URL,
  DOCUMENT_EXTRACTION_PROVIDER: source.DOCUMENT_EXTRACTION_PROVIDER,
  DOCUMENT_EXTRACTION_MODEL: source.DOCUMENT_EXTRACTION_MODEL,
  OPENAI_EXTRACTION_INPUT_USD_PER_MILLION: source.OPENAI_EXTRACTION_INPUT_USD_PER_MILLION,
  OPENAI_EXTRACTION_OUTPUT_USD_PER_MILLION: source.OPENAI_EXTRACTION_OUTPUT_USD_PER_MILLION,
  OPENAI_EXTRACTION_PRICE_VERSION: source.OPENAI_EXTRACTION_PRICE_VERSION,
  KYC_AGENT_MODEL: source.KYC_AGENT_MODEL,
  OPENAI_API_KEY: source.OPENAI_API_KEY,
  OPENSANCTIONS_API_KEY: source.OPENSANCTIONS_API_KEY,
  IDENTITY_VERIFICATION_PROVIDER: source.IDENTITY_VERIFICATION_PROVIDER,
  ADDRESS_VERIFICATION_PROVIDER: source.ADDRESS_VERIFICATION_PROVIDER,
  SANCTIONS_SCREENING_PROVIDER: source.SANCTIONS_SCREENING_PROVIDER,
  PEP_SCREENING_PROVIDER: source.PEP_SCREENING_PROVIDER,
  DOCUMENT_STORAGE_PROVIDER: source.DOCUMENT_STORAGE_PROVIDER,
  NOTIFICATION_PROVIDER: source.NOTIFICATION_PROVIDER,
  WEBHOOK_PUBLISHER: source.WEBHOOK_PUBLISHER,
  PROVISIONING_PROVIDER: source.PROVISIONING_PROVIDER,
  RISK_POLICY_PROVIDER: source.RISK_POLICY_PROVIDER,
  RISK_ASSESSMENT_PROVIDER: source.RISK_ASSESSMENT_PROVIDER,
  RISK_ASSESSMENT_MODEL: source.RISK_ASSESSMENT_MODEL,
  PROVIDER_TIMEOUT_MS: source.PROVIDER_TIMEOUT_MS,
  PROVIDER_MAX_ATTEMPTS: source.PROVIDER_MAX_ATTEMPTS,
  PROVIDER_RETRY_BASE_DELAY_MS: source.PROVIDER_RETRY_BASE_DELAY_MS,
});

export const loadConfig = (source: NodeJS.ProcessEnv = process.env): AppConfig => {
  rejectUnknownProjectKeys(source);
  const selectedEnvironment = selectEnvironment(source);
  const isStrict = (selectedEnvironment.APP_ENV ?? 'demo-default') === 'demo-strict';
  const environment = environmentSchema.parse({
    ...selectedEnvironment,
    ...(isStrict && selectedEnvironment.KYC_DEFAULT_POLICY_PROFILE === undefined
      ? { KYC_DEFAULT_POLICY_PROFILE: 'demo-strict' }
      : {}),
    ...(isStrict && selectedEnvironment.KYC_PII_MODE === undefined ? { KYC_PII_MODE: 'demo-strict' } : {}),
    ...(isStrict && selectedEnvironment.RISK_POLICY_PROVIDER === undefined
      ? { RISK_POLICY_PROVIDER: 'demo-strict@1.1.0' }
      : {}),
  });

  return deepFreeze(
    appConfigSchema.parse({
      environment: environment.APP_ENV,
      server: {
        host: environment.HOST,
        port: environment.PORT,
        portalOrigin: environment.PORTAL_ORIGIN,
        openapiPath: environment.OPENAPI_PATH,
      },
      storage: {
        demoDataRoot: resolve(projectRoot, environment.DEMO_DATA_ROOT),
        operationalUrl: resolveFileUrl(environment.LIBSQL_DOMAIN_URL),
        mastraUrl: resolveFileUrl(environment.LIBSQL_MASTRA_URL),
        analyticsPath: resolve(projectRoot, environment.DUCKDB_URL),
        documentPath: resolve(projectRoot, environment.DOCUMENT_STORAGE_PATH),
      },
      tenant: { defaultTenantId: environment.KYC_DEFAULT_TENANT_ID },
      jurisdiction: {
        defaultJurisdiction: environment.KYC_DEFAULT_JURISDICTION,
        defaultPolicyProfile: environment.KYC_DEFAULT_POLICY_PROFILE,
      },
      pii: {
        mode: environment.KYC_PII_MODE,
        externalProviderAllowlist: environment.KYC_EXTERNAL_PII_PROVIDER_ALLOWLIST.split(',')
          .map(value => value.trim())
          .filter(value => value.length > 0),
      },
      locale: environment.KYC_LOCALE,
      providers: {
        documentExtraction: environment.DOCUMENT_EXTRACTION_PROVIDER,
        identityVerification: environment.IDENTITY_VERIFICATION_PROVIDER,
        addressVerification: environment.ADDRESS_VERIFICATION_PROVIDER,
        sanctionsScreening: environment.SANCTIONS_SCREENING_PROVIDER,
        pepScreening: environment.PEP_SCREENING_PROVIDER,
        documentStorage: environment.DOCUMENT_STORAGE_PROVIDER,
        notification: environment.NOTIFICATION_PROVIDER,
        webhookPublisher: environment.WEBHOOK_PUBLISHER,
        provisioning: environment.PROVISIONING_PROVIDER,
        riskPolicy: environment.RISK_POLICY_PROVIDER,
        riskAssessment: environment.RISK_ASSESSMENT_PROVIDER,
      },
      model: {
        documentExtraction: environment.DOCUMENT_EXTRACTION_MODEL,
        agent: environment.KYC_AGENT_MODEL,
        riskAssessment: environment.RISK_ASSESSMENT_MODEL,
      },
      pricing: {
        openAiExtraction: {
          inputUsdPerMillion: environment.OPENAI_EXTRACTION_INPUT_USD_PER_MILLION,
          outputUsdPerMillion: environment.OPENAI_EXTRACTION_OUTPUT_USD_PER_MILLION,
          version: environment.OPENAI_EXTRACTION_PRICE_VERSION,
        },
      },
      credentials: {
        openAiApiKeyConfigured: environment.OPENAI_API_KEY !== undefined,
        openSanctionsApiKeyConfigured: environment.OPENSANCTIONS_API_KEY !== undefined,
        customerWebhookSecretConfigured: environment.KYC_CUSTOMER_WEBHOOK_CURRENT_SECRET !== undefined,
        complianceReviewerWebhookSecretConfigured:
          environment.KYC_COMPLIANCE_REVIEWER_WEBHOOK_CURRENT_SECRET !== undefined,
        complianceSeniorWebhookSecretConfigured: environment.KYC_COMPLIANCE_SENIOR_WEBHOOK_CURRENT_SECRET !== undefined,
        outboundWebhookSecretConfigured: environment.KYC_OUTBOUND_WEBHOOK_CURRENT_SECRET !== undefined,
        ...(environment.KYC_OUTBOUND_WEBHOOK_URL === undefined
          ? {}
          : { outboundWebhookUrl: environment.KYC_OUTBOUND_WEBHOOK_URL }),
      },
      retry: {
        timeoutMs: environment.PROVIDER_TIMEOUT_MS,
        maxAttempts: environment.PROVIDER_MAX_ATTEMPTS,
        baseDelayMs: environment.PROVIDER_RETRY_BASE_DELAY_MS,
      },
    }),
  );
};

export type RuntimeSecrets = Readonly<{
  openSanctionsApiKey?: string;
  customerWebhookCurrentSecret?: string;
  customerWebhookPreviousSecret?: string;
  complianceReviewerWebhookCurrentSecret?: string;
  complianceReviewerWebhookPreviousSecret?: string;
  complianceSeniorWebhookCurrentSecret?: string;
  complianceSeniorWebhookPreviousSecret?: string;
  outboundWebhookCurrentSecret?: string;
  outboundWebhookPreviousSecret?: string;
  outboundWebhookUrl?: string;
}>;
export type RuntimeSecretResolver = () => RuntimeSecrets;

export const loadRuntimeSecrets = (source: NodeJS.ProcessEnv = process.env): RuntimeSecrets =>
  Object.freeze({
    ...(source.OPENSANCTIONS_API_KEY === undefined || source.OPENSANCTIONS_API_KEY === ''
      ? {}
      : { openSanctionsApiKey: z.string().min(1).parse(source.OPENSANCTIONS_API_KEY) }),
    ...(source.KYC_CUSTOMER_WEBHOOK_CURRENT_SECRET
      ? {
          customerWebhookCurrentSecret: z.string().min(32).parse(source.KYC_CUSTOMER_WEBHOOK_CURRENT_SECRET),
        }
      : {}),
    ...(source.KYC_CUSTOMER_WEBHOOK_PREVIOUS_SECRET
      ? {
          customerWebhookPreviousSecret: z.string().min(32).parse(source.KYC_CUSTOMER_WEBHOOK_PREVIOUS_SECRET),
        }
      : {}),
    ...(source.KYC_COMPLIANCE_REVIEWER_WEBHOOK_CURRENT_SECRET
      ? {
          complianceReviewerWebhookCurrentSecret: z
            .string()
            .min(32)
            .parse(source.KYC_COMPLIANCE_REVIEWER_WEBHOOK_CURRENT_SECRET),
        }
      : {}),
    ...(source.KYC_COMPLIANCE_REVIEWER_WEBHOOK_PREVIOUS_SECRET
      ? {
          complianceReviewerWebhookPreviousSecret: z
            .string()
            .min(32)
            .parse(source.KYC_COMPLIANCE_REVIEWER_WEBHOOK_PREVIOUS_SECRET),
        }
      : {}),
    ...(source.KYC_COMPLIANCE_SENIOR_WEBHOOK_CURRENT_SECRET
      ? {
          complianceSeniorWebhookCurrentSecret: z
            .string()
            .min(32)
            .parse(source.KYC_COMPLIANCE_SENIOR_WEBHOOK_CURRENT_SECRET),
        }
      : {}),
    ...(source.KYC_COMPLIANCE_SENIOR_WEBHOOK_PREVIOUS_SECRET
      ? {
          complianceSeniorWebhookPreviousSecret: z
            .string()
            .min(32)
            .parse(source.KYC_COMPLIANCE_SENIOR_WEBHOOK_PREVIOUS_SECRET),
        }
      : {}),
    ...(source.KYC_OUTBOUND_WEBHOOK_CURRENT_SECRET
      ? {
          outboundWebhookCurrentSecret: z.string().min(32).parse(source.KYC_OUTBOUND_WEBHOOK_CURRENT_SECRET),
        }
      : {}),
    ...(source.KYC_OUTBOUND_WEBHOOK_PREVIOUS_SECRET
      ? {
          outboundWebhookPreviousSecret: z.string().min(32).parse(source.KYC_OUTBOUND_WEBHOOK_PREVIOUS_SECRET),
        }
      : {}),
    ...(source.KYC_OUTBOUND_WEBHOOK_URL ? { outboundWebhookUrl: z.url().parse(source.KYC_OUTBOUND_WEBHOOK_URL) } : {}),
  });
