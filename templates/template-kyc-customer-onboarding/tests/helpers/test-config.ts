import { join } from 'node:path';

import { loadConfig, type AppConfig } from '../../src/config/load-config.js';

export const createTestConfig = (
  directory: string,
  profile: 'demo-default' | 'demo-strict' = 'demo-default',
): AppConfig =>
  loadConfig({
    APP_ENV: profile === 'demo-strict' ? 'demo-strict' : 'test',
    HOST: '127.0.0.1',
    PORT: '4111',
    PORTAL_ORIGIN: 'http://127.0.0.1:5173',
    DEMO_DATA_ROOT: directory,
    LIBSQL_DOMAIN_URL: `file:${join(directory, 'kyc.db')}`,
    LIBSQL_MASTRA_URL: `file:${join(directory, 'mastra.db')}`,
    DUCKDB_URL: join(directory, 'analytics.duckdb'),
    DOCUMENT_STORAGE_PATH: join(directory, 'documents'),
    KYC_DEFAULT_TENANT_ID: 'demo',
    KYC_DEFAULT_JURISDICTION: 'US',
    KYC_DEFAULT_POLICY_PROFILE: profile,
    KYC_PII_MODE: profile,
    KYC_LOCALE: 'en-US',
    KYC_EXTERNAL_PII_PROVIDER_ALLOWLIST: '',
    DOCUMENT_EXTRACTION_PROVIDER: 'fixture',
    DOCUMENT_EXTRACTION_MODEL: 'fixture',
    KYC_AGENT_MODEL: 'fixture',
    IDENTITY_VERIFICATION_PROVIDER: 'local-identity',
    ADDRESS_VERIFICATION_PROVIDER: 'local-address',
    SANCTIONS_SCREENING_PROVIDER: 'fixture-sanctions',
    PEP_SCREENING_PROVIDER: 'fixture-pep',
    DOCUMENT_STORAGE_PROVIDER: 'local-filesystem',
    NOTIFICATION_PROVIDER: 'local-inbox',
    WEBHOOK_PUBLISHER: 'capture',
    PROVISIONING_PROVIDER: 'simulated',
    RISK_POLICY_PROVIDER: `${profile}@1.1.0`,
    RISK_ASSESSMENT_PROVIDER: 'rule-based',
    RISK_ASSESSMENT_MODEL: 'fixture',
    PROVIDER_TIMEOUT_MS: '10000',
    PROVIDER_MAX_ATTEMPTS: '3',
    PROVIDER_RETRY_BASE_DELAY_MS: '100',
  });
