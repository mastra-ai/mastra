import { z } from 'zod';

import { configurationDefaults } from './defaults.js';

const fileUrlSchema = z.string().regex(/^file:.+/, 'must be a file: URL');
const localPathSchema = z.string().min(1);
const optionalSecretSchema = z.preprocess(value => (value === '' ? undefined : value), z.string().min(1).optional());

export const environmentSchema = z
  .object({
    APP_ENV: z.enum(['test', 'demo-default', 'demo-strict', 'live']).default(configurationDefaults.environment),
    HOST: z.string().min(1).default('127.0.0.1'),
    PORT: z.coerce.number().int().min(1).max(65_535).default(4111),
    PORTAL_ORIGIN: z.url().default('http://127.0.0.1:5173'),
    OPENAPI_PATH: z
      .string()
      .regex(/^\/(?!api\/v1\/mastra(?:\/|$))[a-z0-9/_-]+\.json$/u)
      .default(configurationDefaults.openapiPath),
    DEMO_DATA_ROOT: localPathSchema.default('./data'),
    LIBSQL_DOMAIN_URL: fileUrlSchema.default('file:./data/kyc.db'),
    LIBSQL_MASTRA_URL: fileUrlSchema.default('file:./data/mastra.db'),
    DUCKDB_URL: localPathSchema.default('./data/analytics.duckdb'),
    DOCUMENT_STORAGE_PATH: localPathSchema.default('./data/documents'),
    KYC_DEFAULT_TENANT_ID: z.string().min(1).default(configurationDefaults.tenantId),
    KYC_DEFAULT_JURISDICTION: z.literal('US').default(configurationDefaults.jurisdiction),
    KYC_DEFAULT_POLICY_PROFILE: z.enum(['demo-default', 'demo-strict']).default(configurationDefaults.policyProfile),
    KYC_PII_MODE: z.enum(['demo-default', 'demo-strict']).default(configurationDefaults.piiMode),
    KYC_LOCALE: z.string().min(2).max(35).default(configurationDefaults.locale),
    KYC_EXTERNAL_PII_PROVIDER_ALLOWLIST: z.string().default(''),
    KYC_CUSTOMER_WEBHOOK_CURRENT_SECRET: optionalSecretSchema,
    KYC_CUSTOMER_WEBHOOK_PREVIOUS_SECRET: optionalSecretSchema,
    KYC_COMPLIANCE_REVIEWER_WEBHOOK_CURRENT_SECRET: optionalSecretSchema,
    KYC_COMPLIANCE_REVIEWER_WEBHOOK_PREVIOUS_SECRET: optionalSecretSchema,
    KYC_COMPLIANCE_SENIOR_WEBHOOK_CURRENT_SECRET: optionalSecretSchema,
    KYC_COMPLIANCE_SENIOR_WEBHOOK_PREVIOUS_SECRET: optionalSecretSchema,
    KYC_OUTBOUND_WEBHOOK_CURRENT_SECRET: optionalSecretSchema,
    KYC_OUTBOUND_WEBHOOK_PREVIOUS_SECRET: optionalSecretSchema,
    KYC_OUTBOUND_WEBHOOK_URL: z.preprocess(value => (value === '' ? undefined : value), z.url().optional()),
    DOCUMENT_EXTRACTION_PROVIDER: z.string().min(1).default(configurationDefaults.documentExtractionProvider),
    DOCUMENT_EXTRACTION_MODEL: z.string().min(1).default(configurationDefaults.documentExtractionModel),
    OPENAI_EXTRACTION_INPUT_USD_PER_MILLION: z.coerce
      .number()
      .nonnegative()
      .max(1_000)
      .default(configurationDefaults.openAiExtractionInputUsdPerMillion),
    OPENAI_EXTRACTION_OUTPUT_USD_PER_MILLION: z.coerce
      .number()
      .nonnegative()
      .max(1_000)
      .default(configurationDefaults.openAiExtractionOutputUsdPerMillion),
    OPENAI_EXTRACTION_PRICE_VERSION: z
      .string()
      .regex(/^[a-z0-9][a-z0-9._-]{0,99}$/u)
      .default(configurationDefaults.openAiExtractionPriceVersion),
    KYC_AGENT_MODEL: z.string().min(1).default(configurationDefaults.kycAgentModel),
    OPENAI_API_KEY: optionalSecretSchema,
    OPENSANCTIONS_API_KEY: optionalSecretSchema,
    IDENTITY_VERIFICATION_PROVIDER: z.string().min(1).default(configurationDefaults.identityVerificationProvider),
    ADDRESS_VERIFICATION_PROVIDER: z.string().min(1).default(configurationDefaults.addressVerificationProvider),
    SANCTIONS_SCREENING_PROVIDER: z.string().min(1).default(configurationDefaults.sanctionsScreeningProvider),
    PEP_SCREENING_PROVIDER: z.string().min(1).default(configurationDefaults.pepScreeningProvider),
    DOCUMENT_STORAGE_PROVIDER: z.string().min(1).default(configurationDefaults.documentStorageProvider),
    NOTIFICATION_PROVIDER: z.string().min(1).default(configurationDefaults.notificationProvider),
    WEBHOOK_PUBLISHER: z.string().min(1).default(configurationDefaults.webhookPublisher),
    PROVISIONING_PROVIDER: z.string().min(1).default(configurationDefaults.provisioningProvider),
    RISK_POLICY_PROVIDER: z.string().min(1).default(configurationDefaults.riskPolicyProvider),
    RISK_ASSESSMENT_PROVIDER: z
      .enum(['rule-based', 'structured-llm'])
      .default(configurationDefaults.riskAssessmentProvider),
    RISK_ASSESSMENT_MODEL: z.string().min(1).default(configurationDefaults.riskAssessmentModel),
    PROVIDER_TIMEOUT_MS: z.coerce.number().int().min(100).max(120_000).default(configurationDefaults.providerTimeoutMs),
    PROVIDER_MAX_ATTEMPTS: z.coerce.number().int().min(1).max(5).default(configurationDefaults.providerMaxAttempts),
    PROVIDER_RETRY_BASE_DELAY_MS: z.coerce
      .number()
      .int()
      .min(10)
      .max(10_000)
      .default(configurationDefaults.providerRetryBaseDelayMs),
  })
  .strict()
  .superRefine((value, context) => {
    const reviewerConfigured = value.KYC_COMPLIANCE_REVIEWER_WEBHOOK_CURRENT_SECRET !== undefined;
    const seniorConfigured = value.KYC_COMPLIANCE_SENIOR_WEBHOOK_CURRENT_SECRET !== undefined;
    if (reviewerConfigured !== seniorConfigured) {
      context.addIssue({
        code: 'custom',
        path: ['KYC_COMPLIANCE_SENIOR_WEBHOOK_CURRENT_SECRET'],
        message: 'reviewer and senior compliance webhook current secrets must be configured together',
      });
    }
  });

export type Environment = z.infer<typeof environmentSchema>;
