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
