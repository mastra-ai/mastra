import { describe, expect, it, vi, beforeEach } from 'vitest';

import { SpeechifyVoice } from './index';

const { streamMock, listMock, clientOptions } = vi.hoisted(() => ({
  streamMock: vi.fn(),
  listMock: vi.fn(),
  clientOptions: [] as unknown[],
}));

vi.mock('@speechify/api', () => ({
  SpeechifyClient: class {
    audio = { stream: streamMock };
    voices = { list: listMock };
    constructor(options: unknown) {
      clientOptions.push(options);
    }
  },
}));

async function drain(stream: NodeJS.ReadableStream): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

const audioResponse = () => ({
  stream: () =>
    new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array([1, 2, 3]));
        controller.close();
      },
    }),
});

const requestBody = () => (streamMock.mock.calls[0]?.[0] as { body: Record<string, unknown> }).body;
const requestAccept = () => (streamMock.mock.calls[0]?.[0] as { Accept: string }).Accept;

beforeEach(() => {
  streamMock.mockReset();
  listMock.mockReset();
  clientOptions.length = 0;
  streamMock.mockResolvedValue(audioResponse());
});

describe('SpeechifyVoice model support', () => {
  it('defaults to simba-3.5 with the harper_32 voice', async () => {
    const voice = new SpeechifyVoice({ speechModel: { apiKey: 'test-key' } });
    const audio = await drain(await voice.speak('Hello'));

    expect([...audio]).toEqual([1, 2, 3]);
    expect(requestBody()).toEqual({ input: 'Hello', model: 'simba-3.5', voice_id: 'harper_32' });
    expect(requestAccept()).toBe('audio/mpeg');
  });

  it('passes the constructor model to the API', async () => {
    const voice = new SpeechifyVoice({ speechModel: { name: 'simba-3.2', apiKey: 'test-key' } });
    await drain(await voice.speak('Hello'));

    expect(requestBody()).toMatchObject({ model: 'simba-3.2', voice_id: 'harper_32' });
  });

  it('lets a per-request model override the constructor model', async () => {
    const voice = new SpeechifyVoice({ speechModel: { name: 'simba-3.2', apiKey: 'test-key' } });
    await drain(await voice.speak('Hello', { model: 'simba-3.0' }));

    expect(requestBody()).toMatchObject({ model: 'simba-3.0' });
  });

  it('keeps george as the default voice for the legacy models', async () => {
    const voice = new SpeechifyVoice({ speechModel: { name: 'simba-english', apiKey: 'test-key' } });
    await drain(await voice.speak('Hello'));

    expect(requestBody()).toMatchObject({ model: 'simba-english', voice_id: 'george' });
  });

  it('changes the default voice when overriding the model for a request', async () => {
    const voice = new SpeechifyVoice({ speechModel: { name: 'simba-english', apiKey: 'test-key' } });
    await drain(await voice.speak('Hello', { model: 'simba-3.5' }));

    expect(requestBody()).toMatchObject({ model: 'simba-3.5', voice_id: 'harper_32' });
  });

  it('preserves the constructor speaker when overriding the model', async () => {
    const voice = new SpeechifyVoice({
      speechModel: { name: 'simba-english', apiKey: 'test-key' },
      speaker: 'wyatt_32',
    });
    await drain(await voice.speak('Hello', { model: 'simba-3.5' }));

    expect(requestBody()).toMatchObject({ model: 'simba-3.5', voice_id: 'wyatt_32' });
  });

  it('keeps an explicit speaker over the model-based default', async () => {
    const voice = new SpeechifyVoice({ speechModel: { apiKey: 'test-key' }, speaker: 'wyatt_32' });
    await drain(await voice.speak('Hello', { speaker: 'cristiane' }));

    expect(requestBody()).toMatchObject({ voice_id: 'cristiane' });
  });

  it('passes language, output format and synthesis options through', async () => {
    const voice = new SpeechifyVoice({ speechModel: { apiKey: 'test-key' } });
    await drain(
      await voice.speak('Olá', {
        language: 'pt-BR',
        audioFormat: 'ogg',
        outputFormat: 'ogg_24000',
        options: { loudness_normalization: true },
      }),
    );

    expect(requestAccept()).toBe('audio/ogg');
    expect(requestBody()).toEqual({
      input: 'Olá',
      model: 'simba-3.5',
      voice_id: 'harper_32',
      language: 'pt-BR',
      output_format: 'ogg_24000',
      options: { loudness_normalization: true },
    });
  });

  it('reads text from a stream input', async () => {
    const { Readable } = await import('node:stream');
    const voice = new SpeechifyVoice({ speechModel: { apiKey: 'test-key' } });
    await drain(await voice.speak(Readable.from(['Hello ', 'stream'])));

    expect(requestBody()).toMatchObject({ input: 'Hello stream' });
  });

  it('identifies itself to Speechify as the mastra integration', () => {
    new SpeechifyVoice({ speechModel: { apiKey: 'test-key' } });

    expect(clientOptions[0]).toMatchObject({ token: 'test-key', headers: { 'Speechify-Caller': 'mastra' } });
  });

  it('throws without an API key', () => {
    vi.stubEnv('SPEECHIFY_API_KEY', '');
    expect(() => new SpeechifyVoice()).toThrow('SPEECHIFY_API_KEY is not set');
    vi.unstubAllEnvs();
  });
});

describe('SpeechifyVoice speakers', () => {
  it('lists the live catalog with the models that render each voice', async () => {
    listMock.mockResolvedValue(
      (async function* () {
        yield {
          id: 'harper_32',
          display_name: 'Harper',
          locale: 'en-US',
          gender: 'female',
          models: [
            { name: 'simba-3.5', languages: [] },
            { name: 'simba-3.2', languages: [] },
          ],
          type: 'shared',
        };
        yield {
          id: 'cristiane',
          display_name: 'Cristiane',
          locale: 'pt-BR',
          gender: 'female',
          models: [{ name: 'simba-3.5', languages: [] }],
          type: 'shared',
        };
      })(),
    );
    const voice = new SpeechifyVoice({ speechModel: { apiKey: 'test-key' } });

    expect(await voice.getSpeakers()).toEqual([
      { voiceId: 'harper_32', name: 'Harper', language: 'en-US', gender: 'female', models: ['simba-3.5', 'simba-3.2'] },
      { voiceId: 'cristiane', name: 'Cristiane', language: 'pt-BR', gender: 'female', models: ['simba-3.5'] },
    ]);
    expect(listMock).toHaveBeenCalledOnce();
  });
});
