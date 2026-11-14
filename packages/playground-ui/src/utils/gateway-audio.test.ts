import { afterEach, expect, it, vi } from 'vitest';

import { transcribeGatewayAudio } from './gateway-audio';

afterEach(() => vi.unstubAllGlobals());

it('shows the Gateway transcription validation message to the caller', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => Response.json({ error: 'Unsupported audio format' }, { status: 400 })),
  );

  await expect(
    transcribeGatewayAudio(
      'https://studio.example/api',
      'assemblyai/universal-3-5-pro',
      new Blob(['audio'], { type: 'audio/ogg' }),
      'ogg',
    ),
  ).rejects.toMatchObject({ message: 'Unsupported audio format' });
});

it('keeps an HTML proxy failure out of the dictation notice', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response('<html>Bad gateway</html>', { status: 502 })),
  );

  await expect(
    transcribeGatewayAudio(
      'https://studio.example/api',
      'assemblyai/universal-3-5-pro',
      new Blob(['audio'], { type: 'audio/ogg' }),
      'ogg',
    ),
  ).rejects.toMatchObject({ message: 'Could not transcribe audio.' });
});
