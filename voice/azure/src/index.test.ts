import { describe, it, expect } from 'vitest';
import { PassThrough } from 'stream';
import { createReadStream, writeFile } from 'fs';
import { join } from 'path';

import { AzureVoice } from './AzureVoice';
import type { VoiceId } from './voices';

describe('AzureVoice', () => {
  // Provide your Azure subscription key and region for real tests,
  // or mock them if you don't want to actually hit the API in CI
  const subscriptionKey = process.env.AZURE_API_KEY ?? 'fake-key';
  const region = process.env.AZURE_REGION ?? 'eastus';

  it('should return a list of available voices', async () => {
    const azureVoice = new AzureVoice({
      speechModel: { apiKey: subscriptionKey, region },
    });

    const voices = await azureVoice.getSpeakers();
    // Basic checks
    expect(Array.isArray(voices)).toBe(true);
    expect(voices.length).toBeGreaterThan(0);

    // e.g. voices[0] might be { voiceId: "en-US-AriaNeural", language: "en", region: "US" }, etc.
    expect(voices[0]).toHaveProperty('voiceId');
  });
});
