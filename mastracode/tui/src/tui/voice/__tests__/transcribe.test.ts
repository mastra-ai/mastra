import { afterEach, describe, expect, it, vi } from 'vitest';

import { createTranscriber, VoiceCredentialError } from '../transcribe.js';

describe('createTranscriber', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('asks for the provider key by its env var name before calling any provider', () => {
    vi.stubEnv('MISTRAL_API_KEY', '');

    const attempt = () => createTranscriber({ provider: 'mistral' });

    expect(attempt).toThrow(VoiceCredentialError);
    expect(attempt).toThrow(/MISTRAL_API_KEY/);
  });
});
