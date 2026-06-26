import { Readable } from 'node:stream';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { InworldVoice } from './index';

// Helper to collect a stream into a buffer
async function streamToBuffer(stream: NodeJS.ReadableStream): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as any));
  }
  return Buffer.concat(chunks);
}

// Helper to create an NDJSON streaming response body
function createNdjsonBody(audioChunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  const lines = audioChunks.map(b64 => JSON.stringify({ result: { audioContent: b64 } }) + '\n');
  let index = 0;
  return new ReadableStream({
    pull(controller) {
      if (index < lines.length) {
        controller.enqueue(encoder.encode(lines[index]!));
        index++;
      } else {
        controller.close();
      }
    },
  });
}

// Variant that omits trailing newline on the last chunk
function createNdjsonBodyNoTrailingNewline(audioChunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  const lines = audioChunks.map((b64, i) => {
    const json = JSON.stringify({ result: { audioContent: b64 } });
    return i < audioChunks.length - 1 ? json + '\n' : json; // no trailing \n on last
  });
  let index = 0;
  return new ReadableStream({
    pull(controller) {
      if (index < lines.length) {
        controller.enqueue(encoder.encode(lines[index]!));
        index++;
      } else {
        controller.close();
      }
    },
  });
}

describe('InworldVoice', () => {
  let savedApiKey: string | undefined;

  beforeEach(() => {
    vi.restoreAllMocks();
    savedApiKey = process.env.INWORLD_API_KEY;
    delete process.env.INWORLD_API_KEY;
  });

  afterEach(() => {
    if (savedApiKey !== undefined) {
      process.env.INWORLD_API_KEY = savedApiKey;
    } else {
      delete process.env.INWORLD_API_KEY;
    }
  });

  describe('constructor', () => {
    it('throws if no API key is provided', () => {
      expect(() => new InworldVoice()).toThrow('Inworld API key is required');
    });

    it('accepts API key from speechModel config', () => {
      const voice = new InworldVoice({ speechModel: { apiKey: 'test-key' } });
      expect(voice).toBeInstanceOf(InworldVoice);
    });

    it('accepts API key from env var', () => {
      process.env.INWORLD_API_KEY = 'env-key';
      const voice = new InworldVoice();
      expect(voice).toBeInstanceOf(InworldVoice);
    });

    it('uses default speaker Dennis', () => {
      const voice = new InworldVoice({ speechModel: { apiKey: 'test-key' } });
      expect(voice.speaker).toBe('Dennis');
    });

    it('accepts custom speaker', () => {
      const voice = new InworldVoice({ speechModel: { apiKey: 'test-key' }, speaker: 'Olivia' });
      expect(voice.speaker).toBe('Olivia');
    });

    it('uses speechModel.apiKey for TTS and listeningModel.apiKey for STT independently', async () => {
      const voice = new InworldVoice({
        speechModel: { apiKey: 'speech-key' },
        listeningModel: { apiKey: 'listen-key' },
      });

      const audioBase64 = Buffer.from('audio').toString('base64');
      const fetchSpy = vi
        .spyOn(globalThis, 'fetch')
        .mockResolvedValueOnce(new Response(createNdjsonBody([audioBase64]), { status: 200 }))
        .mockResolvedValueOnce(new Response(JSON.stringify({ transcription: { transcript: 'ok' } }), { status: 200 }));

      await streamToBuffer(await voice.speak('hi'));
      await voice.listen(Readable.from(Buffer.from('audio')));

      const speakAuth = (fetchSpy.mock.calls[0]![1] as RequestInit).headers as Record<string, string>;
      const listenAuth = (fetchSpy.mock.calls[1]![1] as RequestInit).headers as Record<string, string>;

      expect(speakAuth.Authorization).toBe('Basic speech-key');
      expect(listenAuth.Authorization).toBe('Basic listen-key');
    });

    it('reuses a single configured key for both services when only one is provided', async () => {
      const voice = new InworldVoice({ speechModel: { apiKey: 'only-key' } });

      const audioBase64 = Buffer.from('audio').toString('base64');
      const fetchSpy = vi
        .spyOn(globalThis, 'fetch')
        .mockResolvedValueOnce(new Response(createNdjsonBody([audioBase64]), { status: 200 }))
        .mockResolvedValueOnce(new Response(JSON.stringify({ transcription: { transcript: 'ok' } }), { status: 200 }));

      await streamToBuffer(await voice.speak('hi'));
      await voice.listen(Readable.from(Buffer.from('audio')));

      const speakAuth = (fetchSpy.mock.calls[0]![1] as RequestInit).headers as Record<string, string>;
      const listenAuth = (fetchSpy.mock.calls[1]![1] as RequestInit).headers as Record<string, string>;

      expect(speakAuth.Authorization).toBe('Basic only-key');
      expect(listenAuth.Authorization).toBe('Basic only-key');
    });
  });

  describe('getSpeakers', () => {
    it('returns voice list from Inworld API', async () => {
      const voice = new InworldVoice({ speechModel: { apiKey: 'test-key' } });

      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            voices: [
              { voiceId: 'Dennis', displayName: 'Dennis', langCode: 'en', tags: [] },
              { voiceId: 'Olivia', displayName: 'Olivia', langCode: 'en', tags: [] },
            ],
          }),
          { status: 200 },
        ),
      );

      const speakers = await voice.getSpeakers();
      expect(speakers).toHaveLength(2);
      expect(speakers[0]).toEqual({
        voiceId: 'Dennis',
        name: 'Dennis',
        language: 'en',
        description: '',
        tags: [],
        source: 'SYSTEM',
      });
    });

    it('throws on API error', async () => {
      const voice = new InworldVoice({ speechModel: { apiKey: 'test-key' } });

      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response('Unauthorized', { status: 401 }));

      await expect(voice.getSpeakers()).rejects.toThrow('Inworld list voices failed (401)');
    });
  });

  describe('getListener', () => {
    it('returns enabled when listeningModel is configured', async () => {
      const voice = new InworldVoice({ speechModel: { apiKey: 'test-key' } });
      const result = await voice.getListener();
      expect(result).toEqual({ enabled: true });
    });
  });

  describe('speak', () => {
    it('calls streaming TTS endpoint and returns progressive audio stream', async () => {
      const voice = new InworldVoice({ speechModel: { apiKey: 'test-key' } });
      const audioBase64 = Buffer.from('fake-audio-chunk-1').toString('base64');
      const audioBase64b = Buffer.from('fake-audio-chunk-2').toString('base64');

      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(createNdjsonBody([audioBase64, audioBase64b]), { status: 200 }),
      );

      const stream = await voice.speak('Hello world');
      const buffer = await streamToBuffer(stream);

      expect(buffer.toString()).toBe('fake-audio-chunk-1fake-audio-chunk-2');

      const fetchCall = vi.mocked(fetch).mock.calls[0]!;
      expect(fetchCall[0]).toBe('https://api.inworld.ai/tts/v1/voice:stream');

      const reqBody = JSON.parse(fetchCall[1]!.body as string);
      expect(reqBody.voiceId).toBe('Dennis');
      expect(reqBody.modelId).toBe('inworld-tts-2');
      expect(reqBody.audioConfig.audioEncoding).toBe('MP3');
      expect(reqBody.audioConfig.sampleRateHertz).toBe(48000);
    });

    it('uses custom speaker and options', async () => {
      const voice = new InworldVoice({ speechModel: { apiKey: 'test-key' } });
      const audioBase64 = Buffer.from('audio').toString('base64');

      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(createNdjsonBody([audioBase64]), { status: 200 }),
      );

      await voice.speak('Hello', {
        speaker: 'Olivia',
        audioEncoding: 'WAV',
        sampleRateHertz: 24000,
        speakingRate: 1.2,
        temperature: 0.8,
      });

      const reqBody = JSON.parse(vi.mocked(fetch).mock.calls[0]![1]!.body as string);
      expect(reqBody.voiceId).toBe('Olivia');
      expect(reqBody.audioConfig.audioEncoding).toBe('WAV');
      expect(reqBody.audioConfig.sampleRateHertz).toBe(24000);
      expect(reqBody.audioConfig.speakingRate).toBe(1.2);
      expect(reqBody.temperature).toBe(0.8);
    });

    it('accepts stream input', async () => {
      const voice = new InworldVoice({ speechModel: { apiKey: 'test-key' } });
      const audioBase64 = Buffer.from('audio').toString('base64');

      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(createNdjsonBody([audioBase64]), { status: 200 }),
      );

      const inputStream = Readable.from(['Hello', ' world']);
      await voice.speak(inputStream);

      const reqBody = JSON.parse(vi.mocked(fetch).mock.calls[0]![1]!.body as string);
      expect(reqBody.text).toBe('Hello world');
    });

    it('throws on API error', async () => {
      const voice = new InworldVoice({ speechModel: { apiKey: 'test-key' } });

      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response('Bad Request', { status: 400 }));

      await expect(voice.speak('Hello')).rejects.toThrow('Inworld TTS failed (400)');
    });

    it('handles NDJSON stream without trailing newline', async () => {
      const voice = new InworldVoice({ speechModel: { apiKey: 'test-key' } });
      const audioBase64a = Buffer.from('chunk-a').toString('base64');
      const audioBase64b = Buffer.from('chunk-b').toString('base64');

      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(createNdjsonBodyNoTrailingNewline([audioBase64a, audioBase64b]), { status: 200 }),
      );

      const stream = await voice.speak('Hello world');
      const buffer = await streamToBuffer(stream);

      expect(buffer.toString()).toBe('chunk-achunk-b');
    });

    it('destroys stream on malformed NDJSON frame', async () => {
      const voice = new InworldVoice({ speechModel: { apiKey: 'test-key' } });
      const encoder = new TextEncoder();

      // Stream with a valid frame followed by a malformed one
      const body = new ReadableStream<Uint8Array>({
        start(controller) {
          const valid = JSON.stringify({ result: { audioContent: Buffer.from('good').toString('base64') } });
          controller.enqueue(encoder.encode(valid + '\n'));
          controller.enqueue(encoder.encode('{not-valid-json}\n'));
          controller.close();
        },
      });

      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response(body, { status: 200 }));

      const stream = await voice.speak('Hello');

      await expect(async () => {
        for await (const _ of stream) {
          // consume
        }
      }).rejects.toThrow();
    });

    it('destroys stream on malformed trailing NDJSON frame', async () => {
      const voice = new InworldVoice({ speechModel: { apiKey: 'test-key' } });
      const encoder = new TextEncoder();

      // Stream where the last chunk has no trailing newline and is malformed
      const body = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(encoder.encode('{bad-trailing'));
          controller.close();
        },
      });

      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response(body, { status: 200 }));

      const stream = await voice.speak('Hello');

      await expect(async () => {
        for await (const _ of stream) {
          // consume
        }
      }).rejects.toThrow();
    });

    it('throws on empty input text', async () => {
      const voice = new InworldVoice({ speechModel: { apiKey: 'test-key' } });
      await expect(voice.speak('   ')).rejects.toThrow('Input text is empty');
    });

    it('uses mini model when configured', async () => {
      const voice = new InworldVoice({
        speechModel: { apiKey: 'test-key', name: 'inworld-tts-1.5-mini' },
      });
      const audioBase64 = Buffer.from('audio').toString('base64');

      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(createNdjsonBody([audioBase64]), { status: 200 }),
      );

      await voice.speak('Hello');

      const reqBody = JSON.parse(vi.mocked(fetch).mock.calls[0]![1]!.body as string);
      expect(reqBody.modelId).toBe('inworld-tts-1.5-mini');
    });

    it('uses tts-1.5-max model when explicitly configured', async () => {
      const voice = new InworldVoice({
        speechModel: { apiKey: 'test-key', name: 'inworld-tts-1.5-max' },
      });
      const audioBase64 = Buffer.from('audio').toString('base64');

      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(createNdjsonBody([audioBase64]), { status: 200 }),
      );

      await voice.speak('Hello');

      const reqBody = JSON.parse(vi.mocked(fetch).mock.calls[0]![1]!.body as string);
      expect(reqBody.modelId).toBe('inworld-tts-1.5-max');
    });

    it('forwards deliveryMode when provided', async () => {
      const voice = new InworldVoice({ speechModel: { apiKey: 'test-key' } });
      const audioBase64 = Buffer.from('audio').toString('base64');

      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(createNdjsonBody([audioBase64]), { status: 200 }),
      );

      await voice.speak('Hello', { deliveryMode: 'CREATIVE' });

      const reqBody = JSON.parse(vi.mocked(fetch).mock.calls[0]![1]!.body as string);
      expect(reqBody.deliveryMode).toBe('CREATIVE');
    });

    it('omits deliveryMode when not provided', async () => {
      const voice = new InworldVoice({ speechModel: { apiKey: 'test-key' } });
      const audioBase64 = Buffer.from('audio').toString('base64');

      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(createNdjsonBody([audioBase64]), { status: 200 }),
      );

      await voice.speak('Hello');

      const reqBody = JSON.parse(vi.mocked(fetch).mock.calls[0]![1]!.body as string);
      expect(reqBody.deliveryMode).toBeUndefined();
    });

    it('forwards per-call language when provided', async () => {
      const voice = new InworldVoice({ speechModel: { apiKey: 'test-key' } });
      const audioBase64 = Buffer.from('audio').toString('base64');

      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(createNdjsonBody([audioBase64]), { status: 200 }),
      );

      await voice.speak('Bonjour', { language: 'fr-FR' });

      const reqBody = JSON.parse(vi.mocked(fetch).mock.calls[0]![1]!.body as string);
      expect(reqBody.language).toBe('fr-FR');
    });

    it('omits language when not provided', async () => {
      const voice = new InworldVoice({ speechModel: { apiKey: 'test-key' } });
      const audioBase64 = Buffer.from('audio').toString('base64');

      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(createNdjsonBody([audioBase64]), { status: 200 }),
      );

      await voice.speak('Hello');

      const reqBody = JSON.parse(vi.mocked(fetch).mock.calls[0]![1]!.body as string);
      expect(reqBody.language).toBeUndefined();
    });

    it('still serializes temperature on tts-2 (server ignores it)', async () => {
      const voice = new InworldVoice({ speechModel: { apiKey: 'test-key' } });
      const audioBase64 = Buffer.from('audio').toString('base64');

      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(createNdjsonBody([audioBase64]), { status: 200 }),
      );

      await voice.speak('Hello', { temperature: 0.7 });

      const reqBody = JSON.parse(vi.mocked(fetch).mock.calls[0]![1]!.body as string);
      expect(reqBody.modelId).toBe('inworld-tts-2');
      expect(reqBody.temperature).toBe(0.7);
    });
  });

  describe('listen', () => {
    it('calls STT endpoint and returns transcript', async () => {
      const voice = new InworldVoice({ speechModel: { apiKey: 'test-key' } });

      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify({ transcription: { transcript: 'Hello world', isFinal: true } }), { status: 200 }),
      );

      const audioStream = Readable.from([Buffer.from('fake-audio-data')]);
      const result = await voice.listen(audioStream);
      expect(result).toBe('Hello world');

      const fetchCall = vi.mocked(fetch).mock.calls[0]!;
      expect(fetchCall[0]).toBe('https://api.inworld.ai/stt/v1/transcribe');

      const reqBody = JSON.parse(fetchCall[1]!.body as string);
      expect(reqBody.transcribeConfig.modelId).toBe('groq/whisper-large-v3');
      expect(reqBody.transcribeConfig.audioEncoding).toBe('AUTO_DETECT');
      expect(reqBody.transcribeConfig.language).toBe('en-US');
      expect(reqBody.audioData.content).toBe(Buffer.from('fake-audio-data').toString('base64'));
    });

    it('returns empty string for missing transcript', async () => {
      const voice = new InworldVoice({ speechModel: { apiKey: 'test-key' } });

      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response(JSON.stringify({}), { status: 200 }));

      const audioStream = Readable.from([Buffer.from('silence')]);
      const result = await voice.listen(audioStream);
      expect(result).toBe('');
    });

    it('uses custom STT options', async () => {
      const voice = new InworldVoice({
        speechModel: { apiKey: 'test-key' },
        listeningModel: { name: 'groq/whisper-large-v3' },
        language: 'ja-JP',
      });

      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify({ transcription: { transcript: 'こんにちは' } }), { status: 200 }),
      );

      const audioStream = Readable.from([Buffer.from('audio')]);
      const result = await voice.listen(audioStream, {
        audioEncoding: 'MP3',
        sampleRateHertz: 44100,
        language: 'ja-JP',
      });

      expect(result).toBe('こんにちは');

      const reqBody = JSON.parse(vi.mocked(fetch).mock.calls[0]![1]!.body as string);
      expect(reqBody.transcribeConfig.modelId).toBe('groq/whisper-large-v3');
      expect(reqBody.transcribeConfig.audioEncoding).toBe('MP3');
      expect(reqBody.transcribeConfig.sampleRateHertz).toBe(44100);
      expect(reqBody.transcribeConfig.language).toBe('ja-JP');
    });

    it('throws on API error', async () => {
      const voice = new InworldVoice({ speechModel: { apiKey: 'test-key' } });

      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response('Server Error', { status: 500 }));

      const audioStream = Readable.from([Buffer.from('audio')]);
      await expect(voice.listen(audioStream)).rejects.toThrow('Inworld STT failed (500)');
    });
  });
});
