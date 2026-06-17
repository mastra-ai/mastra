import { execFileSync, execSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { McE2eScenario } from './types.js';

const REASONING_SENTINEL = 'CEREBRAS_REASONING_SHOULD_BE_STRIPPED';
const ASSISTANT_TEXT = 'Cerebras compatible assistant answer remains.';
const USER_PROMPT = 'Continue the Cerebras-compatible seeded conversation.';

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
  return JSON.stringify(
    requests.map(request => (request && typeof request === 'object' && 'body' in request ? request.body : undefined)),
  );
}

export const providerHistoryCompatScenario: McE2eScenario = {
  name: 'provider-history-compat',
  description: 'Verify ProviderHistoryCompat strips Cerebras-incompatible reasoning before AIMock provider requests.',
  testName: 'strips incompatible reasoning history from a real TUI provider request',
  useOpenAIModel: true,
  aimockFixture: 'provider-history-compat.json',
  env() {
    return {
      MASTRACODE_MODEL_ID: 'cerebras/gpt-5.4-mini',
      CEREBRAS_API_KEY: 'mc-e2e-cerebras-key',
    };
  },
  prepare({ dbPath, mastracodeDir, projectDir }) {
    mkdirSync(projectDir, { recursive: true });
    const now = new Date('2026-06-07T19:45:00.000Z');
    const resourceId = detectResourceId(mastracodeDir);
    const threadId = 'thread-mc-e2e-provider-history';
    const title = 'E2E provider history compatibility fixture';
    const userContent = JSON.stringify({
      format: 2,
      parts: [{ type: 'text', text: 'Seeded question before provider-history retry.' }],
    });
    const assistantContent = JSON.stringify({
      format: 2,
      parts: [
        {
          type: 'reasoning',
          text: REASONING_SENTINEL,
          providerMetadata: { openai: { itemId: 'rs-e2e-provider-history' } },
        },
        { type: 'text', text: ASSISTANT_TEXT },
      ],
    });
    const sql = `
insert into mastra_threads (id, resourceId, title, metadata, createdAt, updatedAt)
values (${quoteSql(threadId)}, ${quoteSql(resourceId)}, ${quoteSql(title)}, ${quoteSql(JSON.stringify({ projectPath: projectDir }))}, ${quoteSql(now.toISOString())}, ${quoteSql(now.toISOString())});
insert into mastra_messages (id, thread_id, content, role, type, createdAt, resourceId)
values
  ('msg-mc-e2e-provider-history-user', ${quoteSql(threadId)}, ${quoteSql(userContent)}, 'user', 'v2', ${quoteSql(now.toISOString())}, ${quoteSql(resourceId)}),
  ('msg-mc-e2e-provider-history-assistant', ${quoteSql(threadId)}, ${quoteSql(assistantContent)}, 'assistant', 'v2', ${quoteSql(new Date(now.getTime() + 1000).toISOString())}, ${quoteSql(resourceId)});
`;
    execFileSync('sqlite3', [dbPath], { input: sql });

  },
  inProcessApp({ appDataDir, env, startMastraCodeApp }) {
    const settingsPath = join(appDataDir, 'settings.json');
    const settings = JSON.parse(readFileSync(settingsPath, 'utf8')) as {
      customProviders?: unknown;
      models?: { modeDefaults?: Record<string, string> };
    };
    settings.models ??= {};
    settings.models.modeDefaults = {
      build: 'cerebras/gpt-5.4-mini',
      plan: 'cerebras/gpt-5.4-mini',
      fast: 'cerebras/gpt-5.4-mini',
    };
    settings.customProviders = [
      {
        name: 'cerebras',
        url: env.OPENAI_BASE_URL,
        apiKey: env.OPENAI_API_KEY,
        models: ['gpt-5.4-mini'],
      },
    ];
    writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
    return startMastraCodeApp({
      config: {
        disableHooks: true,
        disableMcp: true,
        unixSocketPubSub: false,
      },
    });
  },
  async run({ terminal, runtime }) {
    runtime.startLiveOutput(terminal);
    await runtime.waitForScreenText(/Resource ID:/i, terminal);

    terminal.submit('/threads');
    await runtime.waitForScreenText(/E2E provider history compatibility fixture/i, terminal);
    terminal.write('provider history');
    await runtime.waitForScreenText(/E2E provider history compatibility fixture/i, terminal);
    terminal.write('\r');
    await runtime.waitForScreenText(/Switched to: E2E provider history compatibility fixture/i, terminal);
    await runtime.waitForScreenText(new RegExp(ASSISTANT_TEXT), terminal);

    terminal.submit(USER_PROMPT);
    await runtime.waitForScreenText(/MC provider history compatibility response/i, terminal);

    terminal.keyCtrlC();
    runtime.printScreen('after Ctrl-C', terminal);
  },
  verifyAimockRequests(requests) {
    const body = stringifyRequests(requests);
    if (!body.includes(USER_PROMPT)) {
      throw new Error(`Expected provider request to include current prompt. Requests: ${body}`);
    }
    if (body.includes(REASONING_SENTINEL)) {
      throw new Error(`Expected ProviderHistoryCompat to strip Cerebras reasoning sentinel. Requests: ${body}`);
    }
  },
};
