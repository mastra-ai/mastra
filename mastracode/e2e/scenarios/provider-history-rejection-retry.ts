import { execFileSync, execSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createGlobalPatchScope } from './global-patches.js';
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

function getRequestBody(request: unknown): unknown {
  if (request && typeof request === 'object' && 'body' in request) {
    return request.body;
  }
  return undefined;
}

function stringifyRequests(requests: unknown[]): string {
  return JSON.stringify(requests.map(getRequestBody));
}

function bodyText(body: BodyInit | null | undefined): string {
  if (typeof body === 'string') return body;
  if (body instanceof Uint8Array) return new TextDecoder().decode(body);
  return body == null ? '' : String(body);
}

function requestUrl(input: RequestInfo | URL): string {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.href;
  return input.url;
}

export const providerHistoryRejectionRetryScenario: McE2eScenario = {
  name: 'provider-history-rejection-retry',
  description: 'Verify ProviderHistoryCompat omits incompatible tool-call history before provider requests in-process.',
  testName: 'sends sanitized provider history for incompatible tool-call history',
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
  },
  async inProcessApp({ appDataDir, env, startMastraCodeApp }) {
    const observationsPath = env.MC_E2E_PROVIDER_HISTORY_RETRY_OBSERVATIONS;
    if (!observationsPath) throw new Error('MC_E2E_PROVIDER_HISTORY_RETRY_OBSERVATIONS missing');

    const settingsPath = join(appDataDir, 'settings.json');
    const settings = JSON.parse(readFileSync(settingsPath, 'utf8')) as {
      customProviders?: Array<{ name: string; url: string | null; apiKey: string | null; models: string[] }>;
      models?: { modeDefaults?: Record<string, string> };
    };
    settings.models ??= {};
    settings.models.modeDefaults = {
      build: 'history-retry/reasoner',
      plan: 'history-retry/reasoner',
      fast: 'history-retry/reasoner',
    };
    settings.customProviders = [
      {
        name: 'history-retry',
        url: env.OPENAI_BASE_URL,
        apiKey: env.OPENAI_API_KEY,
        models: ['reasoner'],
      },
    ];
    writeFileSync(settingsPath, JSON.stringify(settings, null, 2));

    const patches = createGlobalPatchScope();
    const originalFetch = globalThis.fetch.bind(globalThis);
    let rejectedOnce = false;
    const observations: { rejected: boolean; rejectedHadInvalidId: boolean; forwardedBodies: unknown[] } = {
      rejected: false,
      rejectedHadInvalidId: false,
      forwardedBodies: [],
    };
    const persistObservations = () => writeFileSync(observationsPath, JSON.stringify(observations, null, 2));
    persistObservations();

    patches.setProperty(globalThis, 'fetch', async (input, init) => {
      if (requestUrl(input).includes('/chat/completions')) {
        const rawBody = bodyText(init?.body);
        if (!rejectedOnce && rawBody.includes(INVALID_TOOL_CALL_ID)) {
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
        observations.forwardedBodies.push(rawBody ? JSON.parse(rawBody) : null);
        persistObservations();
      }
      return originalFetch(input, init);
    });

    try {
      const app = await startMastraCodeApp({
        config: {
          disableHooks: true,
          disableMcp: true,
          unixSocketPubSub: false,
        },
      });
      return { stop: () => patches.stopApp(app.stop) };
    } catch (error) {
      patches.restore();
      throw error;
    }
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
    await runtime.waitForScreenText(/PROVIDER_RETRY_REJECTED=false/i, terminal);
    await runtime.waitForScreenText(/PROVIDER_RETRY_SANITIZED=false/i, terminal);

    terminal.keyCtrlC();
    runtime.printScreen('after Ctrl-C', terminal);
  },
  verifyAimockRequests(requests) {
    if (requests.length !== 1) {
      throw new Error(
        `Expected exactly one successful AIMock request after provider-history retry, received ${requests.length}`,
      );
    }
    const body = stringifyRequests(requests);
    if (!body.includes(USER_PROMPT)) {
      throw new Error(`Expected retried request to include current prompt. Requests: ${body}`);
    }
    if (body.includes(INVALID_TOOL_CALL_ID)) {
      throw new Error(`Expected retried request to omit invalid tool-call ID. Requests: ${body}`);
    }
    if (body.includes(SANITIZED_TOOL_CALL_ID)) {
      throw new Error(`Expected in-process request to omit provider-history tool-call IDs entirely. Requests: ${body}`);
    }
  },
};
