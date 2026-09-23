import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const directory = await mkdtemp(join(tmpdir(), 'mastra-kyc-build-'));
const cliEntry = fileURLToPath(import.meta.resolve('mastra'));
const environment = {
  ...process.env,
  APP_ENV: 'test',
  DEMO_DATA_ROOT: directory,
  LIBSQL_DOMAIN_URL: `file:${join(directory, 'kyc.db')}`,
  LIBSQL_MASTRA_URL: `file:${join(directory, 'mastra.db')}`,
  DUCKDB_URL: join(directory, 'analytics.duckdb'),
  DOCUMENT_STORAGE_PATH: join(directory, 'documents'),
  DOCUMENT_EXTRACTION_PROVIDER: 'fixture',
  DOCUMENT_EXTRACTION_MODEL: 'fixture',
  KYC_AGENT_MODEL: 'fixture',
  IDENTITY_VERIFICATION_PROVIDER: 'local-identity',
  ADDRESS_VERIFICATION_PROVIDER: 'local-address',
  SANCTIONS_SCREENING_PROVIDER: 'fixture-sanctions',
  PEP_SCREENING_PROVIDER: 'fixture-pep',
  RISK_ASSESSMENT_PROVIDER: 'rule-based',
  RISK_ASSESSMENT_MODEL: 'fixture',
  KYC_EXTERNAL_PII_PROVIDER_ALLOWLIST: '',
  MASTRA_TELEMETRY_DISABLED: '1',
  npm_config_ignore_scripts: 'true',
  npm_config_audit: 'false',
  npm_config_fund: 'false',
  npm_config_update_notifier: 'false',
};

const child = spawn(process.execPath, [cliEntry, 'build'], {
  cwd: process.cwd(),
  env: environment,
  stdio: 'inherit',
});

const forwardSignal = (signal: NodeJS.Signals): void => {
  if (!child.killed) child.kill(signal);
};

process.once('SIGINT', () => forwardSignal('SIGINT'));
process.once('SIGTERM', () => forwardSignal('SIGTERM'));

try {
  const result = await new Promise<{ code: number | null; signal: NodeJS.Signals | null }>((resolve, reject) => {
    child.once('error', reject);
    child.once('exit', (code, signal) => resolve({ code, signal }));
  });
  if (result.signal !== null) process.kill(process.pid, result.signal);
  if (result.code !== 0) throw new Error(`Mastra build exited with code ${String(result.code)}`);
} finally {
  await rm(directory, { recursive: true, force: true });
}
