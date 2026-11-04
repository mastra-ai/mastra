import { afterEach, describe, expect, it, vi } from 'vitest';

import { transcribeAudio, VoiceCredentialError } from '../transcribe.js';

const AUDIO = Buffer.from('fake-wav');

describe('transcribeAudio', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('asks for the provider key by its env var name before calling any provider', async () => {
    vi.stubEnv('MISTRAL_API_KEY', '');

    const attempt = transcribeAudio(AUDIO, { provider: 'mistral' });

    await expect(attempt).rejects.toBeInstanceOf(VoiceCredentialError);
    await expect(attempt).rejects.toThrow(/Set MISTRAL_API_KEY or add one with \/api-keys/);
  });
});
