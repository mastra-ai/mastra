import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const contracts = {
  'remote-sandbox': ['MASTRA_E2E_REMOTE_SANDBOX_URL', 'MASTRA_E2E_REMOTE_SANDBOX_API_KEY'],
  'object-store': [
    'MASTRA_E2E_OBJECT_STORE_ENDPOINT',
    'MASTRA_E2E_OBJECT_STORE_ACCESS_KEY',
    'MASTRA_E2E_OBJECT_STORE_SECRET_KEY',
  ],
  'real-model': ['MASTRA_E2E_MODEL_PROVIDER', 'MASTRA_E2E_MODEL_API_KEY'],
  'hosted-proxy': ['MASTRA_E2E_HOSTED_PROXY_URL', 'MASTRA_E2E_HOSTED_PROXY_TOKEN'],
};

const scenario = process.argv[2];
const required = contracts[scenario];
if (!required) throw new Error(`Unknown gated experiment-worker scenario: ${scenario}`);

const reportRoot = resolve(process.env.MASTRA_EXPERIMENT_E2E_REPORT_DIR || 'reports');
await mkdir(reportRoot, { recursive: true });
const missing = required.filter(name => !process.env[name]);
const result = {
  schemaVersion: 1,
  scenarioId: scenario,
  tier: 'gated',
  status: missing.length ? 'skipped' : 'passed',
  skipCode: missing.length ? 'GATED_CREDENTIALS_MISSING' : null,
  skipReason: missing.length ? `Missing required environment: ${missing.join(', ')}` : null,
  requiredEnvironment: required,
  assertions: [
    {
      id: 'gated-contract',
      status: missing.length ? 'skipped' : 'passed',
      evidence: missing.length ? { missing } : { configured: required },
    },
  ],
};
await writeFile(resolve(reportRoot, `${scenario}.json`), `${JSON.stringify(result, null, 2)}\n`);
await writeFile(
  resolve(reportRoot, `${scenario}.md`),
  `# ${scenario}\n\n- Status: ${result.status}\n- Skip code: ${result.skipCode ?? 'none'}\n- Reason: ${result.skipReason ?? 'credential contract configured'}\n`,
);
console.log(JSON.stringify(result));
