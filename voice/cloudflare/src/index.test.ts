import { createReadStream } from 'fs';
import { cwd } from 'node:process';
import path from 'path';
import { describe, it, expect } from 'vitest';
import { CloudflareVoice } from './index';

describe('Cloudflare AI Voice Integration Tests', () => {
  const voice = new CloudflareVoice();
  it('should transcribe audio from fixture file', async () => {
    const fixturePath = path.join(cwd(), '__fixtures__', 'voice-test.m4a');

    const audioStream = createReadStream(fixturePath);

    const text = await voice.listen(audioStream);
    console.log(text);
    expect(text).toBeTruthy();
    expect(typeof text).toBe('string');
    expect(text.length).toBeGreaterThan(0);
  }, 15000);
});
