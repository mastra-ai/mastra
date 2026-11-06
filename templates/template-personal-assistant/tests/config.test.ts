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
    { ASSISTANT_TIMEZONE: 'secret/invalid-zone' },
    { ASSISTANT_RUNTIME: 'hosted' },
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
    loadConfig({ OPENAI_API_KEY: 'example-key', MASTRA_PROJECT_ID: '', MASTRA_PLATFORM_ACCESS_TOKEN: '' }).connect,
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
    { id: 'source-id', payload: { mimeType: 'text/plain', filename: 'attachment.txt', body: { data: 'dGV4dA' } } },
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
        { mimeType: 'text/plain', body: { data: Buffer.alloc(secondSize, 98).toString('base64url') } },
      ],
    },
  });
  assert.equal(Buffer.byteLength(normalizeMail(multipart(32766)).text), 65536);
  const over = normalizeMail(multipart(32768));
  assert.equal(over.truncated, true);
  assert.ok(Buffer.byteLength(over.text) <= 65536);
});
