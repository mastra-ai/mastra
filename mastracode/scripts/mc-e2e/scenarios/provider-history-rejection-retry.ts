import { execFileSync, execSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { McE2eScenario } from './types.js';

const INVALID_TOOL_CALL_ID = 'call:provider.history.retry';
const SANITIZED_TOOL_CALL_ID = 'call_provider_history_retry';
const USER_PROMPT = 'Continue after provider history rejection retry.';
const RESPONSE = 'MC provider history rejection retry recovered.';

function quoteSql(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function shortHash(value: string): string {
  return createHash('sha256').update(value).digest('hex').slice(0, 12);
}

function detectResourceId(cwd: string): string {
  const rootPath = execSync('git rev-parse --show-toplevel', { cwd, encoding: 'utf8' }).trim();
  const gitUrl = execSync('git remote get-url origin', { cwd, encoding: 'utf8' }).trim();
  const normalizedGitUrl = gitUrl
    .replace(/\.git$/, '')
    .replace(/^git@([^:]+):/, 'https://$1/')
    .replace(/^ssh:\/\/git@/, 'https://')
    .toLowerCase();
  const baseName =
    gitUrl
      .split('/')
      .pop()
      ?.replace(/\.git$/, '') ||
    rootPath.split('/').pop() ||
    'project';
  return `${slugify(baseName)}-${shortHash(normalizedGitUrl)}`;
}

function stringifyRequests(requests: unknown[]): string {
  return JSON.stringify(requests.map((request: any) => request.body));
}

export const providerHistoryRejectionRetryScenario: McE2eScenario = {
  name: 'provider-history-rejection-retry',
  description: 'Verify ProviderHistoryCompat retries after a real provider rejection and sends sanitized history.',
  testName: 'recovers from a provider rejection caused by incompatible tool-call history',
  useOpenAIModel: true,
  aimockFixture: 'provider-history-rejection-retry.json',
  env({ projectDir }) {
    return {
      MASTRACODE_MODEL_ID: 'history-retry/reasoner',
      MC_E2E_PROVIDER_HISTORY_RETRY_OBSERVATIONS: join(projectDir, '.mc-e2e-provider-history-retry-observations.json'),
    };
  },
  prepare({ dbPath, mastracodeDir, projectDir }) {
    mkdirSync(projectDir, { recursive: true });
    const now = new Date('2026-06-12T08:30:00.000Z');
    const resourceId = detectResourceId(mastracodeDir);
    const threadId = 'thread-mc-e2e-provider-history-retry';
    const title = 'E2E provider history rejection retry fixture';
    const userContent = JSON.stringify({
      format: 2,
      parts: [{ type: 'text', text: 'Seeded request before provider-history rejection.' }],
    });
    const assistantContent = JSON.stringify({
      format: 2,
      parts: [
        {
          type: 'tool-invocation',
          toolInvocation: {
            toolCallId: INVALID_TOOL_CALL_ID,
            toolName: 'providerHistoryProbe',
            args: { query: 'history-retry' },
            state: 'result',
            result: 'provider history probe result',
          },
        },
        { type: 'text', text: 'Seeded assistant text with incompatible tool-call ID.' },
      ],
      toolInvocations: [
        {
          toolCallId: INVALID_TOOL_CALL_ID,
          toolName: 'providerHistoryProbe',
          args: { query: 'history-retry' },
          state: 'result',
          result: 'provider history probe result',
        },
      ],
    });
    const sql = `
insert into mastra_threads (id, resourceId, title, metadata, createdAt, updatedAt)
values (${quoteSql(threadId)}, ${quoteSql(resourceId)}, ${quoteSql(title)}, ${quoteSql(JSON.stringify({ projectPath: projectDir }))}, ${quoteSql(now.toISOString())}, ${quoteSql(now.toISOString())});
insert into mastra_messages (id, thread_id, content, role, type, createdAt, resourceId)
values
  ('msg-mc-e2e-provider-history-retry-user', ${quoteSql(threadId)}, ${quoteSql(userContent)}, 'user', 'v2', ${quoteSql(now.toISOString())}, ${quoteSql(resourceId)}),
  ('msg-mc-e2e-provider-history-retry-assistant', ${quoteSql(threadId)}, ${quoteSql(assistantContent)}, 'assistant', 'v2', ${quoteSql(new Date(now.getTime() + 1000).toISOString())}, ${quoteSql(resourceId)});
`;
    execFileSync('sqlite3', [dbPath], { input: sql });

    writeFileSync(
      join(projectDir, '.mc-e2e-provider-history-retry-entrypoint.ts'),
      `import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const mastracodeDir = ${JSON.stringify(mastracodeDir)};
const invalidToolCallId = ${JSON.stringify(INVALID_TOOL_CALL_ID)};
const observationsPath = process.env.MC_E2E_PROVIDER_HISTORY_RETRY_OBSERVATIONS;
if (!observationsPath) throw new Error('MC_E2E_PROVIDER_HISTORY_RETRY_OBSERVATIONS missing');
const originalFetch = globalThis.fetch;
let rejectedOnce = false;
const observations = { rejected: false, rejectedHadInvalidId: false, forwardedBodies: [] };

function bodyText(body) {
  if (typeof body === 'string') return body;
  if (body instanceof Uint8Array) return new TextDecoder().decode(body);
  return body == null ? '' : String(body);
}

function persistObservations() {
  writeFileSync(observationsPath, JSON.stringify(observations, null, 2));
}

persistObservations();

globalThis.fetch = async (input, init) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  if (url.includes('/chat/completions')) {
    const rawBody = bodyText(init?.body);
    if (!rejectedOnce && rawBody.includes(invalidToolCallId)) {
      rejectedOnce = true;
      observations.rejected = true;
      observations.rejectedHadInvalidId = true;
      persistObservations();
      return new Response(
        JSON.stringify({
          error: {
            message: "messages.1.content.0.tool_use.id: String should match pattern '^[a-zA-Z0-9_-]+$'",
            type: 'invalid_request_error',
          },
        }),
        { status: 400, headers: { 'content-type': 'application/json' } },
      );
    }
    observations.forwardedBodies.push(JSON.parse(rawBody));
    persistObservations();
  }
  return originalFetch(input, init);
};

const appDataDir = process.env.MASTRA_APP_DATA_DIR;
if (!appDataDir) throw new Error('MASTRA_APP_DATA_DIR missing');
const settingsPath = join(appDataDir, 'settings.json');
const settings = JSON.parse(readFileSync(settingsPath, 'utf8'));
settings.models ??= {};
settings.models.modeDefaults = {
  build: 'history-retry/reasoner',
  plan: 'history-retry/reasoner',
  fast: 'history-retry/reasoner',
};
settings.customProviders = [
  {
    name: 'history-retry',
    url: process.env.OPENAI_BASE_URL,
    apiKey: process.env.OPENAI_API_KEY,
    models: ['reasoner'],
  },
];
writeFileSync(settingsPath, JSON.stringify(settings, null, 2));

const { createMastraCode } = await import(pathToFileURL(join(mastracodeDir, 'src/index.ts')).href);
const { MastraTUI } = await import(pathToFileURL(join(mastracodeDir, 'src/tui/index.ts')).href);
const { getCurrentVersion } = await import(pathToFileURL(join(mastracodeDir, 'src/utils/update-check.ts')).href);

process.on('SIGINT', () => process.exit(0));
process.on('SIGTERM', () => process.exit(0));

const result = await createMastraCode({
  cwd: process.cwd(),
  disableMcp: true,
  disableHooks: true,
  unixSocketPubSub: false,
});

const tui = new MastraTUI({
  harness: result.harness,
  hookManager: result.hookManager,
  authStorage: result.authStorage,
  mcpManager: result.mcpManager,
  appName: 'Mastra Code',
  version: getCurrentVersion(),
  inlineQuestions: true,
});

void tui.run().catch(error => {
  process.stderr.write(String(error instanceof Error ? error.stack ?? error.message : error) + '\\n');
  process.exit(1);
});
`,
    );
  },
  entrypoint({ projectDir }) {
    return join(projectDir, '.mc-e2e-provider-history-retry-entrypoint.ts');
  },
  async run({ terminal, runtime }) {
    runtime.startLiveOutput(terminal);
    await runtime.waitForScreenText(/Resource ID:/i, terminal);

    terminal.submit('/threads');
    await runtime.waitForScreenText(/E2E provider history rejection retry fixture/i, terminal);
    terminal.write('rejection retry');
    await runtime.waitForScreenText(/E2E provider history rejection retry fixture/i, terminal);
    terminal.write('\r');
    await runtime.waitForScreenText(/Switched to: E2E provider history rejection retry fixture/i, terminal);

    terminal.submit(USER_PROMPT);
    await runtime.waitForScreenText(new RegExp(RESPONSE), terminal, 30_000);

    terminal.submit(
      `!node -e "const fs=require('fs'); const p=process.env.MC_E2E_PROVIDER_HISTORY_RETRY_OBSERVATIONS; const j=JSON.parse(fs.readFileSync(p,'utf8')); const forwarded=JSON.stringify(j.forwardedBodies); console.log('PROVIDER_RETRY_REJECTED=' + j.rejected); console.log('PROVIDER_RETRY_SANITIZED=' + (!forwarded.includes('${INVALID_TOOL_CALL_ID}') && forwarded.includes('${SANITIZED_TOOL_CALL_ID}')));"`,
    );
    await runtime.waitForScreenText(/PROVIDER_RETRY_REJECTED=true/i, terminal);
    await runtime.waitForScreenText(/PROVIDER_RETRY_SANITIZED=true/i, terminal);

    terminal.keyCtrlC();
    runtime.printScreen('after Ctrl-C', terminal);
  },
  verifyAimockRequests(requests) {
    if (requests.length !== 1) {
      throw new Error(`Expected exactly one successful AIMock request after provider-history retry, received ${requests.length}`);
    }
    const body = stringifyRequests(requests);
    if (!body.includes(USER_PROMPT)) {
      throw new Error(`Expected retried request to include current prompt. Requests: ${body}`);
    }
    if (body.includes(INVALID_TOOL_CALL_ID)) {
      throw new Error(`Expected retried request to omit invalid tool-call ID. Requests: ${body}`);
    }
    if (!body.includes(SANITIZED_TOOL_CALL_ID)) {
      throw new Error(`Expected retried request to include sanitized tool-call ID. Requests: ${body}`);
    }
  },
};
