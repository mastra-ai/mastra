import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loadConfig } from '../src/mastra/config';
import { createAssistant } from '../src/mastra/assistant';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

test('local configuration requires only an OpenAI key and applies bounded defaults', () => {
  const config = loadConfig({ OPENAI_API_KEY: 'example-key' });
  assert.equal(config.ownerId, 'local-owner');
  assert.equal(config.model, 'openai/gpt-6-luna');
  assert.equal(config.maxSteps, 20);
  assert.equal(config.modelSettings, undefined);
  assert.equal(config.modelMaxRetries, undefined);
  assert.deepEqual(
    loadConfig({
      OPENAI_API_KEY: 'example-key',
      ASSISTANT_MAX_OUTPUT_TOKENS: '512',
      ASSISTANT_MODEL_MAX_RETRIES: '0',
    }).modelSettings,
    { maxOutputTokens: 512 },
  );
  assert.equal(loadConfig({ OPENAI_API_KEY: 'example-key', ASSISTANT_MODEL_MAX_RETRIES: '0' }).modelMaxRetries, 0);
  assert.equal(config.judgeModel, 'openai/gpt-6-luna');
  assert.equal(config.maxGoalEvaluations, 5);
  assert.equal(config.timezone, undefined);
  assert.equal('OPENAI_API_KEY' in config, false);
  assert.equal(loadConfig({ OPENAI_API_KEY: 'example-key', ASSISTANT_MAX_STEPS: '1' }).maxSteps, 1);
});

test('unavailable local storage identifies the setting without exposing its value', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'personal-assistant-config-'));
  const blocked = join(directory, 'private-directory-value');
  try {
    await writeFile(blocked, 'not a directory');
    assert.throws(
      () => createAssistant(loadConfig({ OPENAI_API_KEY: 'example-key', ASSISTANT_DATA_DIR: blocked })),
      error => {
        assert.ok(error instanceof Error);
        assert.match(error.message, /ASSISTANT_DATA_DIR/);
        assert.doesNotMatch(error.message, /private-directory-value|example-key/);
        return true;
      },
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('invalid settings identify their names without echoing credentials or supplied values', () => {
  const invalid = [
    { OPENAI_API_KEY: '' },
    { ASSISTANT_OWNER_ID: 'invalid owner secret' },
    { ASSISTANT_MODEL: 'anthropic/example-secret' },
    { ASSISTANT_JUDGE_MODEL: 'anthropic/example-secret' },
    { ASSISTANT_MAX_GOAL_EVALUATIONS: '21' },
    { ASSISTANT_MAX_GOAL_EVALUATIONS: '0' },
    { ASSISTANT_MAX_GOAL_EVALUATIONS: '1.5' },
    { ASSISTANT_MAX_STEPS: '21' },
    { ASSISTANT_MAX_STEPS: '1.5' },
    { ASSISTANT_MAX_STEPS: '0' },
    { ASSISTANT_MAX_OUTPUT_TOKENS: '0' },
    { ASSISTANT_MAX_OUTPUT_TOKENS: '32769' },
    { ASSISTANT_MAX_OUTPUT_TOKENS: '1.5' },
    { ASSISTANT_MODEL_MAX_RETRIES: '-1' },
    { ASSISTANT_MODEL_MAX_RETRIES: '6' },
    { ASSISTANT_MODEL_MAX_RETRIES: '1.5' },
    { ASSISTANT_TIMEZONE: 'secret/invalid-zone' },
    { ASSISTANT_RUNTIME: 'unknown' },
  ];
  for (const settings of invalid) {
    const name = Object.keys(settings)[0]!;
    assert.throws(
      () => loadConfig({ OPENAI_API_KEY: 'example-private-key', ...settings }),
      error => {
        assert.ok(error instanceof Error);
        assert.match(error.message, new RegExp(name));
        assert.doesNotMatch(error.message, /example-private-key|invalid owner secret|example-secret|invalid-zone/);
        return true;
      },
    );
  }
});

test('Connect configuration rejects partial credentials and exact-key policy never guesses reads', async () => {
  const { requiresApproval } = await import('../src/mastra/connect');
  assert.equal(requiresApproval('google_mail_get_message'), false);
  for (const key of [
    'get_safe_record',
    'google_docs_list_revisions',
    'google_mail_get_message_extra',
    'google_mail_get_Message',
    'google_docs_create_document',
  ])
    assert.equal(requiresApproval(key), true, key);
  for (const env of [
    { MASTRA_PROJECT_ID: 'example-project' },
    { MASTRA_PLATFORM_ACCESS_TOKEN: 'private-token' },
    { MASTRA_PLATFORM_SECRET_KEY: 'private-token' },
    { ASSISTANT_CONNECT_PROVIDERS: '["*"]' },
    { ASSISTANT_CONNECT_TOOLS: '["google_docs_*"]' },
    { ASSISTANT_OWNER_ID: '' },
  ])
    assert.throws(
      () => loadConfig({ OPENAI_API_KEY: 'example-key', ...env }),
      error => {
        assert.ok(error instanceof Error);
        assert.doesNotMatch(error.message, /private-token/);
        return true;
      },
    );
  const config = loadConfig({
    OPENAI_API_KEY: 'example-key',
    MASTRA_PROJECT_ID: 'example-project',
    MASTRA_PLATFORM_SECRET_KEY: 'private-token',
  });
  assert.ok(config.connect);
  assert.doesNotMatch(JSON.stringify(config), /private-token/);
  assert.equal(
    loadConfig({
      OPENAI_API_KEY: 'example-key',
      MASTRA_PROJECT_ID: '',
      MASTRA_PLATFORM_ACCESS_TOKEN: '',
    }).connect,
    undefined,
  );
});

test('bounded MIME decoding rejects malformed oversized and unsupported source content', async () => {
  const { normalizeMail } = await import('../src/mastra/connect');
  const message = (data: string, mimeType = 'text/plain') => ({
    id: 'source-id',
    payload: { mimeType, body: { data } },
  });
  const text = 'Full UTF-8 body: café and a recovery requirement.';
  assert.deepEqual(normalizeMail(message(Buffer.from(text).toString('base64url'))), {
    sourceMessageId: 'source-id',
    text,
    status: 'complete',
    truncated: false,
    issues: [],
  });
  for (const data of ['***', 'A', 'dA=', '=', Buffer.from([0xff]).toString('base64url')]) {
    const result = normalizeMail(message(data));
    assert.equal(result.sourceMessageId, 'source-id');
    assert.equal(result.text, '');
    assert.match(JSON.stringify(result.issues), /Malformed/);
  }
  assert.equal(normalizeMail(message('dA==')).text, 't');
  const large = normalizeMail(message(Buffer.alloc(65537, 97).toString('base64url')));
  assert.equal(large.truncated, true);
  assert.equal(large.text, '');
  assert.match(JSON.stringify(large.issues), /limit/);
  for (const source of [
    message('PGh0bWw-', 'text/html'),
    { id: 'source-id', snippet: 'Incomplete snippet' },
    {
      id: 'source-id',
      payload: { mimeType: 'text/plain', filename: 'attachment.txt', body: { data: 'dGV4dA' } },
    },
  ]) {
    const result = normalizeMail(source);
    assert.equal(result.sourceMessageId, 'source-id');
    assert.equal(result.text, '');
    assert.match(JSON.stringify(result.issues), /No supported full/);
  }
  const nested = {
    id: 'source-id',
    payload: { mimeType: 'multipart/mixed', parts: Array.from({ length: 65 }, () => ({})) },
  };
  assert.equal(normalizeMail(nested).truncated, true);
  const multipart = (secondSize: number) => ({
    id: 'source-id',
    payload: {
      mimeType: 'multipart/mixed',
      parts: [
        { mimeType: 'text/plain', body: { data: Buffer.alloc(32768, 97).toString('base64url') } },
        {
          mimeType: 'text/plain',
          body: { data: Buffer.alloc(secondSize, 98).toString('base64url') },
        },
      ],
    },
  });
  assert.equal(Buffer.byteLength(normalizeMail(multipart(32766)).text), 65536);
  const over = normalizeMail(multipart(32768));
  assert.equal(over.truncated, true);
  assert.ok(Buffer.byteLength(over.text) <= 65536);
});

test('schedule timing preserves explicit timezone dates and rejects calendar or DST shifts', async () => {
  const { scheduleTiming } = await import('../src/mastra/schedules');
  const { computeNextFireAt } = await import('@mastra/core/workflows');
  const year = new Date().getUTCFullYear() + 2;
  const gapDay = 8 + ((7 - new Date(Date.UTC(year, 2, 1)).getUTCDay()) % 7);
  const repeatDay = 1 + ((7 - new Date(Date.UTC(year, 10, 1)).getUTCDay()) % 7);
  const gap = `${year}-03-${String(gapDay).padStart(2, '0')}T02:30:00-05:00`;
  const local = `${year}-11-${String(repeatDay).padStart(2, '0')}T01:30:00`;
  for (const input of [
    { kind: 'once', date: `${year}-02-30T10:00:00Z`, timezone: 'UTC' },
    { kind: 'once', date: `${year}-01-10T10:00:00`, timezone: 'UTC' },
    { kind: 'once', date: gap, timezone: 'America/New_York' },
    { kind: 'once', date: `${year}-01-10T10:00:00+01:00`, timezone: 'UTC' },
    { kind: 'once', date: '2020-01-01T10:00:00Z', timezone: 'UTC' },
    { kind: 'cron', cron: '* * * * *', timezone: '+01:00' },
    { kind: 'cron', cron: '* * * * *', timezone: 'Invalid/Zone' },
    { kind: 'cron', cron: 'invalid cron', timezone: 'UTC' },
    { kind: 'cron', cron: '0 0 9 1 1 * 2020', timezone: 'UTC' },
  ])
    assert.equal(scheduleTiming.safeParse(input).success, false, JSON.stringify(input));
  const date = `${year}-01-10T10:15:00-03:00`;
  const once = scheduleTiming.parse({ kind: 'once', date, timezone: 'America/Sao_Paulo' });
  assert.equal(once.timezone, 'America/Sao_Paulo');
  assert.equal(computeNextFireAt(once.cron, { timezone: once.timezone }), Date.parse(date));
  assert.throws(
    () => computeNextFireAt(once.cron, { timezone: once.timezone, after: Date.parse(date) }),
    'A one-time cadence must exhaust after its chosen instant.',
  );
  let representableChoices = 0;
  for (const offset of ['-04:00', '-05:00']) {
    const date = `${local}${offset}`;
    const chosen = scheduleTiming.safeParse({ kind: 'once', date, timezone: 'America/New_York' });
    if (chosen.success) {
      representableChoices++;
      assert.equal(chosen.data.timezone, 'America/New_York');
      assert.equal(
        computeNextFireAt(chosen.data.cron, { timezone: chosen.data.timezone }),
        Date.parse(date),
        'An explicit repeated-hour choice cannot shift to the other offset.',
      );
      assert.throws(() =>
        computeNextFireAt(chosen.data.cron, {
          timezone: chosen.data.timezone,
          after: Date.parse(date),
        }),
      );
    } else assert.match(JSON.stringify(chosen.error.issues), /offset choice/);
  }
  assert.ok(representableChoices >= 1, 'Native scheduling must support at least one explicit repeated-hour choice.');
});

test('hosted configuration refuses local fallback insecure storage and ambiguous Studio identity', () => {
  const hosted = {
    OPENAI_API_KEY: 'example-key',
    ASSISTANT_RUNTIME: 'hosted',
    TURSO_DATABASE_URL: 'libsql://assistant-example.turso.io',
    TURSO_AUTH_TOKEN: 'example-private-database-token',
    ASSISTANT_API_TOKEN: 'example-private-owner-token-at-least-32-characters',
    MASTRA_PLATFORM_STUDIO_AUTH: 'disabled',
  };
  assert.equal(loadConfig(hosted).runtime.mode, 'hosted');
  assert.equal(loadConfig({ OPENAI_API_KEY: 'example-key', NODE_ENV: 'production' }).runtime.mode, 'local');
  for (const name of ['MASTRA_DEPLOYMENT_ID', 'MASTRA_CLOUD_API_ENDPOINT', 'MASTRA_PLATFORM_PROJECT_ID']) {
    assert.throws(() => loadConfig({ OPENAI_API_KEY: 'example-key', [name]: 'example' }), /ASSISTANT_RUNTIME/);
    assert.equal(loadConfig({ ...hosted, [name]: 'example' }).runtime.mode, 'hosted');
  }
  for (const override of [
    { TURSO_DATABASE_URL: '' },
    { TURSO_DATABASE_URL: 'file:assistant.db' },
    { TURSO_DATABASE_URL: 'http://assistant-example.turso.io' },
    { TURSO_DATABASE_URL: 'libsql://127.0.0.1' },
    { TURSO_DATABASE_URL: 'libsql://assistant-example.turso.io?tls=0' },
    { TURSO_DATABASE_URL: 'libsql://private-user:private-password@assistant-example.turso.io' },
    { TURSO_DATABASE_URL: 'libsql://assistant-example.turso.io.attacker.example' },
    { TURSO_AUTH_TOKEN: '' },
    { ASSISTANT_API_TOKEN: '' },
    { ASSISTANT_API_TOKEN: 'short' },
    { MASTRA_PLATFORM_STUDIO_AUTH: '' },
    { MASTRA_PLATFORM_STUDIO_AUTH: 'enabled' },
    { ASSISTANT_PLATFORM_TRACING: 'true' },
  ])
    assert.throws(
      () => loadConfig({ ...hosted, ...override }),
      error => {
        assert.ok(error instanceof Error);
        assert.doesNotMatch(error.message, /private-database-token|private-owner-token|private-password/);
        return true;
      },
    );
  for (const override of [
    { TURSO_DATABASE_URL: hosted.TURSO_DATABASE_URL },
    { TURSO_AUTH_TOKEN: hosted.TURSO_AUTH_TOKEN },
    { ASSISTANT_API_TOKEN: hosted.ASSISTANT_API_TOKEN },
    { ASSISTANT_PLATFORM_TRACING: 'true' },
  ])
    assert.throws(() => loadConfig({ OPENAI_API_KEY: 'example-key', ...override }), /ASSISTANT_RUNTIME/);
});
