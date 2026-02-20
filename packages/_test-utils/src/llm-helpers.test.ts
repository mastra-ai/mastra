/**
 * Unit tests for LLM recording helper functions.
 * These tests don't require API keys or network access.
 */

import { getLLMTestMode, hasLLMRecording, listLLMRecordings, getLLMRecordingsDir } from '@internal/llm-recorder';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getModelRecordingName, isV5PlusModel, setupDummyApiKeys, hasApiKey } from './llm-helpers';

/**
 * Restore process.env to a snapshot without replacing the native proxy object.
 * Removes keys that weren't in the snapshot and resets existing keys.
 */
function restoreEnv(snapshot: Record<string, string | undefined>): void {
  // Remove keys not in the snapshot
  for (const key of Object.keys(process.env)) {
    if (!(key in snapshot)) {
      delete process.env[key];
    }
  }
  // Restore keys from the snapshot
  for (const [key, value] of Object.entries(snapshot)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
}

describe('getLLMTestMode', () => {
  const originalEnv = { ...process.env };
  const originalArgv = [...process.argv];

  beforeEach(() => {
    // Clear relevant env vars before each test
    delete process.env.LLM_TEST_MODE;
    delete process.env.RECORD_LLM;
    delete process.env.CI;
    delete process.env.UPDATE_RECORDINGS;
    // Reset argv to remove any flags
    process.argv = originalArgv.filter(a => a !== '--update-recordings' && a !== '-U');
  });

  afterEach(() => {
    // Restore original env and argv
    restoreEnv(originalEnv);
    process.argv = [...originalArgv];
  });

  it('returns "auto" by default', () => {
    expect(getLLMTestMode()).toBe('auto');
  });

  it('returns "update" when UPDATE_RECORDINGS=true', () => {
    process.env.UPDATE_RECORDINGS = 'true';
    expect(getLLMTestMode()).toBe('update');
  });

  it('returns "update" when --update-recordings flag is present', () => {
    process.argv.push('--update-recordings');
    expect(getLLMTestMode()).toBe('update');
  });

  it('returns "update" when -U flag is present', () => {
    process.argv.push('-U');
    expect(getLLMTestMode()).toBe('update');
  });

  it('returns "replay" when LLM_TEST_MODE=replay', () => {
    process.env.LLM_TEST_MODE = 'replay';
    expect(getLLMTestMode()).toBe('replay');
  });

  it('returns "record" when LLM_TEST_MODE=record', () => {
    process.env.LLM_TEST_MODE = 'record';
    expect(getLLMTestMode()).toBe('record');
  });

  it('returns "live" when LLM_TEST_MODE=live', () => {
    process.env.LLM_TEST_MODE = 'live';
    expect(getLLMTestMode()).toBe('live');
  });

  it('returns "auto" when LLM_TEST_MODE=auto', () => {
    process.env.LLM_TEST_MODE = 'auto';
    expect(getLLMTestMode()).toBe('auto');
  });

  it('is case-insensitive', () => {
    process.env.LLM_TEST_MODE = 'REPLAY';
    expect(getLLMTestMode()).toBe('replay');

    process.env.LLM_TEST_MODE = 'Record';
    expect(getLLMTestMode()).toBe('record');
  });

  it('returns "record" when RECORD_LLM=true (legacy)', () => {
    process.env.RECORD_LLM = 'true';
    expect(getLLMTestMode()).toBe('record');
  });

  it('UPDATE_RECORDINGS takes priority over LLM_TEST_MODE', () => {
    process.env.UPDATE_RECORDINGS = 'true';
    process.env.LLM_TEST_MODE = 'live';
    expect(getLLMTestMode()).toBe('update');
  });

  it('--update-recordings flag takes priority over LLM_TEST_MODE', () => {
    process.argv.push('--update-recordings');
    process.env.LLM_TEST_MODE = 'live';
    expect(getLLMTestMode()).toBe('update');
  });

  it('LLM_TEST_MODE takes priority over RECORD_LLM', () => {
    process.env.LLM_TEST_MODE = 'live';
    process.env.RECORD_LLM = 'true';
    expect(getLLMTestMode()).toBe('live');
  });
});

describe('Recording file helpers', () => {
  it('getLLMRecordingsDir returns a path', () => {
    const dir = getLLMRecordingsDir();
    expect(dir).toBeDefined();
    expect(typeof dir).toBe('string');
    expect(dir).toContain('__recordings__');
  });

  it('hasLLMRecording returns false for non-existent recording', () => {
    expect(hasLLMRecording('definitely-does-not-exist-12345')).toBe(false);
  });

  it('listLLMRecordings returns an array', () => {
    const recordings = listLLMRecordings();
    expect(Array.isArray(recordings)).toBe(true);
  });

  it('hasLLMRecording returns true for existing recording', () => {
    const recordings = listLLMRecordings();
    if (recordings.length > 0) {
      expect(hasLLMRecording(recordings[0]!)).toBe(true);
    }
  });
});

describe('getModelRecordingName', () => {
  it('converts string model with slash to dashes', () => {
    expect(getModelRecordingName('openai/gpt-4o-mini')).toBe('openai-gpt-4o-mini');
  });

  it('removes special characters', () => {
    expect(getModelRecordingName('openai/gpt-4o@latest')).toBe('openai-gpt-4olatest');
  });

  it('handles model with modelId property', () => {
    expect(getModelRecordingName({ modelId: 'gpt-4o' })).toBe('gpt-4o');
  });

  it('handles model with specificationVersion', () => {
    expect(getModelRecordingName({ specificationVersion: 'v2' })).toBe('sdk-v2');
    expect(getModelRecordingName({ specificationVersion: 'v3' })).toBe('sdk-v3');
  });

  it('returns unknown-model for unrecognized config', () => {
    expect(getModelRecordingName({ foo: 'bar' })).toBe('unknown-model');
  });
});

describe('isV5PlusModel', () => {
  it('returns true for string models', () => {
    expect(isV5PlusModel('openai/gpt-4o')).toBe(true);
  });

  it('returns true for v2 specificationVersion', () => {
    expect(isV5PlusModel({ specificationVersion: 'v2' })).toBe(true);
  });

  it('returns true for v3 specificationVersion', () => {
    expect(isV5PlusModel({ specificationVersion: 'v3' })).toBe(true);
  });

  it('returns false for v1 specificationVersion', () => {
    expect(isV5PlusModel({ specificationVersion: 'v1' })).toBe(false);
  });

  it('returns false for models without specificationVersion', () => {
    expect(isV5PlusModel({ modelId: 'gpt-4o' })).toBe(false);
  });
});

describe('setupDummyApiKeys', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    delete process.env.OPENAI_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.GOOGLE_API_KEY;
    delete process.env.OPENROUTER_API_KEY;
  });

  afterEach(() => {
    restoreEnv(originalEnv);
  });

  it('does nothing in live mode', () => {
    setupDummyApiKeys('live');
    expect(process.env.OPENAI_API_KEY).toBeUndefined();
  });

  it('does nothing in record mode', () => {
    setupDummyApiKeys('record');
    expect(process.env.OPENAI_API_KEY).toBeUndefined();
  });

  it('does nothing in update mode', () => {
    setupDummyApiKeys('update');
    expect(process.env.OPENAI_API_KEY).toBeUndefined();
  });

  it('sets all dummy keys in replay mode by default', () => {
    setupDummyApiKeys('replay');
    expect(process.env.OPENAI_API_KEY).toBe('sk-dummy-for-replay-mode');
    expect(process.env.ANTHROPIC_API_KEY).toBe('sk-ant-dummy-for-replay-mode');
    expect(process.env.GOOGLE_API_KEY).toBe('dummy-google-key-for-replay-mode');
    expect(process.env.OPENROUTER_API_KEY).toBe('sk-or-dummy-for-replay-mode');
  });

  it('sets all dummy keys in auto mode by default', () => {
    setupDummyApiKeys('auto');
    expect(process.env.OPENAI_API_KEY).toBe('sk-dummy-for-replay-mode');
    expect(process.env.ANTHROPIC_API_KEY).toBe('sk-ant-dummy-for-replay-mode');
    expect(process.env.GOOGLE_API_KEY).toBe('dummy-google-key-for-replay-mode');
    expect(process.env.OPENROUTER_API_KEY).toBe('sk-or-dummy-for-replay-mode');
  });

  it('only sets specified providers in replay mode', () => {
    setupDummyApiKeys('replay', ['openai']);
    expect(process.env.OPENAI_API_KEY).toBe('sk-dummy-for-replay-mode');
    expect(process.env.ANTHROPIC_API_KEY).toBeUndefined();
  });

  it('does not overwrite existing keys', () => {
    process.env.OPENAI_API_KEY = 'sk-real-key';
    setupDummyApiKeys('replay');
    expect(process.env.OPENAI_API_KEY).toBe('sk-real-key');
  });
});

describe('hasApiKey', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    delete process.env.OPENAI_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
  });

  afterEach(() => {
    restoreEnv(originalEnv);
  });

  it('returns false when key is not set', () => {
    expect(hasApiKey('openai')).toBe(false);
  });

  it('returns true when key is set', () => {
    process.env.OPENAI_API_KEY = 'sk-test';
    expect(hasApiKey('openai')).toBe(true);
  });

  it('checks correct env var for each provider', () => {
    process.env.ANTHROPIC_API_KEY = 'sk-ant-test';
    expect(hasApiKey('anthropic')).toBe(true);
    expect(hasApiKey('openai')).toBe(false);
  });
});
