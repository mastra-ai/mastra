import { createServer } from 'node:http';
import type { Server } from 'node:http';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { resolveSTTModel } from '../stt-registry.js';
import { createSTTTranscriber } from '../transcribe.js';

// A real socket rather than MSW, whose interceptor drops the multipart body when the OpenAI SDK retries.
async function overloadedProvider(): Promise<{ server: Server; baseURL: string; attempts: () => number }> {
  let attempts = 0;
  const server = createServer((request, response) => {
    attempts += 1;
    request.resume().on('end', () => {
      response.writeHead(503, { 'content-type': 'application/json' });
      response.end(JSON.stringify({ error: { message: 'overloaded' } }));
    });
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (address === null || typeof address === 'string') throw new Error('Expected a TCP address');
  return { server, baseURL: `http://127.0.0.1:${address.port}/v1`, attempts: () => attempts };
}

let provider: Server | undefined;

afterEach(() => {
  provider?.close();
  vi.unstubAllEnvs();
});

describe('createSTTTranscriber against a failing OpenAI endpoint', () => {
  it('retries once, then reports the failure', async () => {
    const overloaded = await overloadedProvider();
    provider = overloaded.server;
    vi.stubEnv('OPENAI_API_KEY', '');
    vi.stubEnv('OPENAI_BASE_URL', overloaded.baseURL);

    const transcriber = await createSTTTranscriber(resolveSTTModel('openai', 'whisper-1'), 'given-key');

    await expect(transcriber.transcribe(Buffer.from('fake-wav'), 'wav')).rejects.toThrow('overloaded');
    expect(overloaded.attempts()).toBe(2);
  });
});
