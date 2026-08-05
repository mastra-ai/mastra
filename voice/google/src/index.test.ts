import { createWriteStream, mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { describe, expect, it, beforeAll, vi, beforeEach, afterEach } from 'vitest';

import { GoogleVoice } from './index';

// Mock the Google Cloud clients for unit tests
vi.mock('@google-cloud/speech', () => ({
  SpeechClient: vi.fn().mockImplementation(() => ({
    recognize: vi.fn().mockResolvedValue([{ results: [{ alternatives: [{ transcript: 'test' }] }] }]),
  })),
  v2: {
    SpeechClient: vi.fn().mockImplementation(() => ({
      recognize: vi.fn().mockResolvedValue([{ results: [{ alternatives: [{ transcript: 'test v2' }] }] }]),
    })),
  },
}));

vi.mock('@google-cloud/text-to-speech', () => ({
  TextToSpeechClient: vi.fn().mockImplementation(() => ({
    synthesizeSpeech: vi.fn().mockResolvedValue([{ audioContent: Buffer.from('mock audio') }]),
    listVoices: vi.fn().mockResolvedValue([{ voices: [{ name: 'en-US-Test', languageCodes: ['en-US'] }] }]),
  })),
}));

describe('GoogleVoice Unit Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    // Restore environment variables
    delete process.env.GOOGLE_CLOUD_PROJECT;
    delete process.env.GOOGLE_CLOUD_LOCATION;
  });

  describe('Initialization', () => {
    it('should initialize with default configuration', () => {
      const voice = new GoogleVoice();
      expect(voice).toBeInstanceOf(GoogleVoice);
      expect(voice.isUsingVertexAI()).toBe(false);
    });

    it('should initialize with API key authentication', () => {
      const voice = new GoogleVoice({
        speechModel: { apiKey: 'test-api-key' },
      });
      expect(voice).toBeInstanceOf(GoogleVoice);
      expect(voice.isUsingVertexAI()).toBe(false);
    });

    it('should initialize with Vertex AI configuration', () => {
      const voice = new GoogleVoice({
        vertexAI: true,
        project: 'test-project',
        location: 'us-central1',
      });
      expect(voice).toBeInstanceOf(GoogleVoice);
      expect(voice.isUsingVertexAI()).toBe(true);
      expect(voice.getProject()).toBe('test-project');
      expect(voice.getLocation()).toBe('us-central1');
    });

    it('should use environment variables for Vertex AI configuration', () => {
      process.env.GOOGLE_CLOUD_PROJECT = 'env-project';
      process.env.GOOGLE_CLOUD_LOCATION = 'europe-west1';

      const voice = new GoogleVoice({
        vertexAI: true,
      });

      expect(voice.isUsingVertexAI()).toBe(true);
      expect(voice.getProject()).toBe('env-project');
      expect(voice.getLocation()).toBe('europe-west1');
    });

    it('should default location to us-central1 when not specified', () => {
      const voice = new GoogleVoice({
        vertexAI: true,
        project: 'test-project',
      });

      expect(voice.getLocation()).toBe('us-central1');
    });

    it('should throw error when Vertex AI is enabled without project', () => {
      expect(() => {
        new GoogleVoice({
          vertexAI: true,
        });
      }).toThrow('Google Cloud project ID is required when using Vertex AI');
    });

    it('should initialize with service account key file', () => {
      const voice = new GoogleVoice({
        vertexAI: true,
        project: 'test-project',
        speechModel: {
          keyFilename: '/path/to/service-account.json',
        },
      });
      expect(voice).toBeInstanceOf(GoogleVoice);
      expect(voice.isUsingVertexAI()).toBe(true);
    });

    it('should initialize with in-memory credentials', () => {
      const voice = new GoogleVoice({
        vertexAI: true,
        project: 'test-project',
        speechModel: {
          credentials: {
            client_email: 'test@project.iam.gserviceaccount.com',
            private_key: '-----BEGIN PRIVATE KEY-----\ntest\n-----END PRIVATE KEY-----',
          },
        },
      });
      expect(voice).toBeInstanceOf(GoogleVoice);
      expect(voice.isUsingVertexAI()).toBe(true);
    });

    it('should prefer constructor project over environment variable', () => {
      process.env.GOOGLE_CLOUD_PROJECT = 'env-project';

      const voice = new GoogleVoice({
        vertexAI: true,
        project: 'constructor-project',
      });

      expect(voice.getProject()).toBe('constructor-project');
    });
  });

  describe('Speaker configuration', () => {
    it('should use default speaker when not specified', () => {
      const voice = new GoogleVoice();
      expect(voice.speaker).toBe('en-US-Casual-K');
    });

    it('should use custom speaker when specified', () => {
      const voice = new GoogleVoice({
        speaker: 'en-US-Studio-O',
      });
      expect(voice.speaker).toBe('en-US-Studio-O');
    });
  });

  describe('speak', () => {
    it('should build a text-only request by default', async () => {
      const voice = new GoogleVoice();
      const mockSynthesize = vi.fn().mockResolvedValue([{ audioContent: Buffer.from('audio') }]);
      (voice as any).ttsClient = { synthesizeSpeech: mockSynthesize };

      await voice.speak('Hello');
      expect(mockSynthesize).toHaveBeenCalledWith(
        expect.objectContaining({
          input: { text: 'Hello' },
          voice: expect.objectContaining({ name: 'en-US-Casual-K', languageCode: 'en-US' }),
          audioConfig: { audioEncoding: 'LINEAR16' },
        }),
      );
    });

    it('should pass SSML via options.input', async () => {
      const voice = new GoogleVoice();
      const mockSynthesize = vi.fn().mockResolvedValue([{ audioContent: Buffer.from('audio') }]);
      (voice as any).ttsClient = { synthesizeSpeech: mockSynthesize };

      const ssml = '<speak>Hello <break time="200ms"/> world</speak>';
      await voice.speak('ignored', { input: { ssml } });
      const call = mockSynthesize.mock.calls[0][0];
      expect(call.input.ssml).toBe(ssml);
      expect(call.input.text).toBeUndefined();
    });

    it('should populate text from positional input when options.input has no text/ssml/markup', async () => {
      const voice = new GoogleVoice();
      const mockSynthesize = vi.fn().mockResolvedValue([{ audioContent: Buffer.from('audio') }]);
      (voice as any).ttsClient = { synthesizeSpeech: mockSynthesize };

      await voice.speak('Hello world', {
        input: { customPronunciations: { pronunciations: [] } },
      });
      const call = mockSynthesize.mock.calls[0][0];
      expect(call.input.text).toBe('Hello world');
      expect(call.input.customPronunciations).toEqual({ pronunciations: [] });
    });

    it('should merge caller voice fields on top of defaults', async () => {
      const voice = new GoogleVoice({ speaker: 'en-US-Studio-O' });
      const mockSynthesize = vi.fn().mockResolvedValue([{ audioContent: Buffer.from('audio') }]);
      (voice as any).ttsClient = { synthesizeSpeech: mockSynthesize };

      await voice.speak('Hi', {
        voice: { modelName: 'gemini-2.5-flash-tts' },
      });
      const call = mockSynthesize.mock.calls[0][0];
      expect(call.voice.modelName).toBe('gemini-2.5-flash-tts');
      expect(call.voice.name).toBe('en-US-Studio-O');
      expect(call.voice.languageCode).toBe('en-US');
    });

    it('should derive languageCode from non-en-US default speaker', async () => {
      const voice = new GoogleVoice({ speaker: 'cmn-CN-Standard-A' });
      const mockSynthesize = vi.fn().mockResolvedValue([{ audioContent: Buffer.from('audio') }]);
      (voice as any).ttsClient = { synthesizeSpeech: mockSynthesize };

      await voice.speak('Hi', {
        voice: { modelName: 'gemini-2.5-flash-tts' },
      });
      const call = mockSynthesize.mock.calls[0][0];
      expect(call.voice.name).toBe('cmn-CN-Standard-A');
      expect(call.voice.languageCode).toBe('cmn-CN');
      expect(call.voice.modelName).toBe('gemini-2.5-flash-tts');
    });

    it('should allow caller voice fields to override defaults', async () => {
      const voice = new GoogleVoice({ speaker: 'en-US-Studio-O' });
      const mockSynthesize = vi.fn().mockResolvedValue([{ audioContent: Buffer.from('audio') }]);
      (voice as any).ttsClient = { synthesizeSpeech: mockSynthesize };

      await voice.speak('Hi', {
        voice: { name: 'custom-voice', languageCode: 'fr-FR' },
      });
      const call = mockSynthesize.mock.calls[0][0];
      expect(call.voice.name).toBe('custom-voice');
      expect(call.voice.languageCode).toBe('fr-FR');
    });

    it('should pass custom audioConfig', async () => {
      const voice = new GoogleVoice();
      const mockSynthesize = vi.fn().mockResolvedValue([{ audioContent: Buffer.from('audio') }]);
      (voice as any).ttsClient = { synthesizeSpeech: mockSynthesize };

      await voice.speak('Hi', { audioConfig: { audioEncoding: 'MP3' } });
      const call = mockSynthesize.mock.calls[0][0];
      expect(call.audioConfig).toEqual({ audioEncoding: 'MP3' });
    });

    it('should not inject text when input uses multiSpeakerMarkup', async () => {
      const voice = new GoogleVoice();
      const mockSynthesize = vi.fn().mockResolvedValue([{ audioContent: Buffer.from('audio') }]);
      (voice as any).ttsClient = { synthesizeSpeech: mockSynthesize };

      const multiSpeakerMarkup = { turns: [{ speaker: 'R', text: 'Hi' }] };
      await voice.speak('ignored', { input: { multiSpeakerMarkup } });
      const call = mockSynthesize.mock.calls[0][0];
      expect(call.input.multiSpeakerMarkup).toEqual(multiSpeakerMarkup);
      expect(call.input.text).toBeUndefined();
    });

    it('should not mutate caller input object', async () => {
      const voice = new GoogleVoice();
      const mockSynthesize = vi.fn().mockResolvedValue([{ audioContent: Buffer.from('audio') }]);
      (voice as any).ttsClient = { synthesizeSpeech: mockSynthesize };

      const callerInput = { customPronunciations: { pronunciations: [] } };
      await voice.speak('Hi', { input: callerInput });
      expect(callerInput).toEqual({ customPronunciations: { pronunciations: [] } });
    });

    it('should handle stream input with rich options', async () => {
      const voice = new GoogleVoice();
      const mockSynthesize = vi.fn().mockResolvedValue([{ audioContent: Buffer.from('audio') }]);
      (voice as any).ttsClient = { synthesizeSpeech: mockSynthesize };

      const textStream = Readable.from(['Hello', ' stream']);
      await voice.speak(textStream, {
        input: { customPronunciations: { pronunciations: [] } },
        voice: { modelName: 'gemini-2.5-flash-tts' },
      });
      const call = mockSynthesize.mock.calls[0][0];
      expect(call.input.text).toBe('Hello stream');
      expect(call.voice.modelName).toBe('gemini-2.5-flash-tts');
    });
  });

  describe('listen v1 (default)', () => {
    it('should call v1 recognize by default', async () => {
      const voice = new GoogleVoice();
      const mockRecognize = vi.fn().mockResolvedValue([{ results: [{ alternatives: [{ transcript: 'hello' }] }] }]);
      (voice as any).speechClient = { recognize: mockRecognize };

      const audioStream = Readable.from([Buffer.from('fake audio')]);
      const result = await voice.listen(audioStream);
      expect(result).toBe('hello');
      expect(mockRecognize).toHaveBeenCalledWith(
        expect.objectContaining({
          config: expect.objectContaining({ encoding: 'LINEAR16', languageCode: 'en-US' }),
          audio: expect.objectContaining({ content: expect.any(String) }),
        }),
      );
    });

    it('should pass custom v1 config', async () => {
      const voice = new GoogleVoice();
      const mockRecognize = vi.fn().mockResolvedValue([{ results: [{ alternatives: [{ transcript: 'bonjour' }] }] }]);
      (voice as any).speechClient = { recognize: mockRecognize };

      const audioStream = Readable.from([Buffer.from('fake audio')]);
      await voice.listen(audioStream, { config: { encoding: 'FLAC', languageCode: 'fr-FR' } });
      expect(mockRecognize).toHaveBeenCalledWith(
        expect.objectContaining({
          config: expect.objectContaining({ encoding: 'FLAC', languageCode: 'fr-FR' }),
        }),
      );
    });
  });

  describe('listen v2', () => {
    it('should call v2 recognize when v2: true', async () => {
      const voice = new GoogleVoice();
      const mockV1Recognize = vi.fn();
      const mockV2Recognize = vi
        .fn()
        .mockResolvedValue([{ results: [{ alternatives: [{ transcript: 'v2 hello' }] }] }]);
      (voice as any).speechClient = { recognize: mockV1Recognize };
      (voice as any).speechClientV2 = {
        recognize: mockV2Recognize,
        getProjectId: vi.fn().mockResolvedValue('test-project'),
      };

      const audioStream = Readable.from([Buffer.from('fake audio')]);
      const result = await voice.listen(audioStream, { v2: true });
      expect(result).toBe('v2 hello');
      expect(mockV2Recognize).toHaveBeenCalledWith(
        expect.objectContaining({
          recognizer: 'projects/test-project/locations/global/recognizers/_',
          config: expect.objectContaining({ autoDecodingConfig: {}, languageCodes: ['en-US'] }),
          content: expect.any(Buffer),
        }),
      );
      expect(mockV1Recognize).not.toHaveBeenCalled();
    });

    it('should use project from constructor for recognizer', async () => {
      const voice = new GoogleVoice({ vertexAI: true, project: 'my-vertex-project' });
      const mockV2Recognize = vi.fn().mockResolvedValue([{ results: [{ alternatives: [{ transcript: 'ok' }] }] }]);
      (voice as any).speechClientV2 = { recognize: mockV2Recognize };

      const audioStream = Readable.from([Buffer.from('fake audio')]);
      await voice.listen(audioStream, { v2: true });
      expect(mockV2Recognize).toHaveBeenCalledWith(
        expect.objectContaining({
          recognizer: 'projects/my-vertex-project/locations/global/recognizers/_',
        }),
      );
    });

    it('should use autoDecodingConfig by default when no decoding config specified', async () => {
      const voice = new GoogleVoice();
      const mockV2Recognize = vi.fn().mockResolvedValue([{ results: [{ alternatives: [{ transcript: 'ok' }] }] }]);
      (voice as any).speechClientV2 = {
        recognize: mockV2Recognize,
        getProjectId: vi.fn().mockResolvedValue('test-project'),
      };

      const audioStream = Readable.from([Buffer.from('fake audio')]);
      await voice.listen(audioStream, { v2: true, config: { languageCodes: ['fr-FR'] } });
      expect(mockV2Recognize).toHaveBeenCalledWith(
        expect.objectContaining({
          config: expect.objectContaining({ autoDecodingConfig: {}, languageCodes: ['fr-FR'] }),
        }),
      );
    });

    it('should default languageCodes to en-US and model to long', async () => {
      const voice = new GoogleVoice();
      const mockV2Recognize = vi.fn().mockResolvedValue([{ results: [{ alternatives: [{ transcript: 'ok' }] }] }]);
      (voice as any).speechClientV2 = {
        recognize: mockV2Recognize,
        getProjectId: vi.fn().mockResolvedValue('test-project'),
      };

      const audioStream = Readable.from([Buffer.from('fake audio')]);
      await voice.listen(audioStream, { v2: true });
      expect(mockV2Recognize).toHaveBeenCalledWith(
        expect.objectContaining({
          config: expect.objectContaining({ languageCodes: ['en-US'], model: 'long' }),
        }),
      );
    });

    it('should pass explicit decoding config without adding auto', async () => {
      const voice = new GoogleVoice();
      const mockV2Recognize = vi.fn().mockResolvedValue([{ results: [{ alternatives: [{ transcript: 'ok' }] }] }]);
      (voice as any).speechClientV2 = {
        recognize: mockV2Recognize,
        getProjectId: vi.fn().mockResolvedValue('test-project'),
      };

      const audioStream = Readable.from([Buffer.from('fake audio')]);
      await voice.listen(audioStream, {
        v2: true,
        config: { explicitDecodingConfig: { encoding: 'MP4_AAC', sampleRateHertz: 44100, audioChannelCount: 1 } },
      });
      const call = mockV2Recognize.mock.calls[0][0];
      expect(call.config.explicitDecodingConfig).toEqual({
        encoding: 'MP4_AAC',
        sampleRateHertz: 44100,
        audioChannelCount: 1,
      });
      expect(call.config.autoDecodingConfig).toBeUndefined();
    });

    it('should accept a custom recognizer path', async () => {
      const voice = new GoogleVoice();
      const mockV2Recognize = vi.fn().mockResolvedValue([{ results: [{ alternatives: [{ transcript: 'ok' }] }] }]);
      (voice as any).speechClientV2 = { recognize: mockV2Recognize };

      const audioStream = Readable.from([Buffer.from('fake audio')]);
      await voice.listen(audioStream, {
        v2: true,
        recognizer: 'projects/my-project/locations/global/recognizers/my-recognizer',
      });
      expect(mockV2Recognize).toHaveBeenCalledWith(
        expect.objectContaining({
          recognizer: 'projects/my-project/locations/global/recognizers/my-recognizer',
        }),
      );
    });

    it('should not mutate caller config object', async () => {
      const voice = new GoogleVoice();
      const mockV2Recognize = vi.fn().mockResolvedValue([{ results: [{ alternatives: [{ transcript: 'ok' }] }] }]);
      (voice as any).speechClientV2 = {
        recognize: mockV2Recognize,
        getProjectId: vi.fn().mockResolvedValue('test-project'),
      };

      const callerConfig = { languageCodes: ['ja-JP'] };
      const audioStream = Readable.from([Buffer.from('fake audio')]);
      await voice.listen(audioStream, { v2: true, config: callerConfig });
      // Caller's original object should not have autoDecodingConfig added
      expect(callerConfig).toEqual({ languageCodes: ['ja-JP'] });
    });

    it('should lazily construct v2 client', async () => {
      const voice = new GoogleVoice();
      expect((voice as any).speechClientV2).toBeUndefined();

      const mockV2Recognize = vi.fn().mockResolvedValue([{ results: [{ alternatives: [{ transcript: 'ok' }] }] }]);
      let constructed = false;
      (voice as any).getV2SpeechClient = () => {
        constructed = true;
        const mock = {
          recognize: mockV2Recognize,
          getProjectId: vi.fn().mockResolvedValue('test-project'),
        };
        (voice as any).speechClientV2 = mock;
        return mock;
      };

      const audioStream = Readable.from([Buffer.from('fake audio')]);
      await voice.listen(audioStream, { v2: true });
      expect(constructed).toBe(true);
    });
  });
});

describe('GoogleVoice Integration Tests', () => {
  let voice: GoogleVoice;
  const outputDir = join(process.cwd(), 'test-outputs');

  beforeAll(() => {
    // Reset mocks for integration tests
    vi.resetModules();
    vi.unmock('@google-cloud/speech');
    vi.unmock('@google-cloud/text-to-speech');

    // Create output directory if it doesn't exist
    try {
      mkdirSync(outputDir, { recursive: true });
    } catch (err) {
      console.error(err);
      // Ignore if directory already exists
    }

    voice = new GoogleVoice();
  });

  describe('getSpeakers', () => {
    it('should list available voices', async () => {
      const voices = await voice.getSpeakers();
      expect(voices.length).toBeGreaterThan(0);
      expect(voices[0]).toHaveProperty('voiceId');
      expect(voices[0]).toHaveProperty('languageCodes');
    }, 10000);
  });

  describe('speak', () => {
    it('should generate audio from text and save to file', async () => {
      const audioStream = await voice.speak('Hello World', {
        speaker: 'en-US-Standard-F',
      });

      return new Promise((resolve, reject) => {
        const outputPath = join(outputDir, 'speech-test.wav');
        const fileStream = createWriteStream(outputPath);
        const chunks: Buffer[] = [];

        audioStream.on('data', (chunk: Buffer) => chunks.push(chunk));
        audioStream.pipe(fileStream);

        fileStream.on('finish', () => {
          expect(chunks.length).toBeGreaterThan(0);
          resolve(undefined);
        });

        audioStream.on('error', reject);
        fileStream.on('error', reject);
      });
    }, 10000);

    it('should work with default voice', async () => {
      const audioStream = await voice.speak('Test with default voice');

      return new Promise((resolve, reject) => {
        const outputPath = join(outputDir, 'speech-test-default.wav');
        const fileStream = createWriteStream(outputPath);
        const chunks: Buffer[] = [];

        audioStream.on('data', (chunk: Buffer) => chunks.push(chunk));
        audioStream.pipe(fileStream);

        fileStream.on('finish', () => {
          expect(chunks.length).toBeGreaterThan(0);
          resolve(undefined);
        });

        audioStream.on('error', reject);
        fileStream.on('error', reject);
      });
    }, 10000);

    it('should handle stream input', async () => {
      const textStream = Readable.from(['Hello', ' from', ' stream', ' input!']);

      const audioStream = await voice.speak(textStream);

      return new Promise((resolve, reject) => {
        const outputPath = join(outputDir, 'speech-stream-input-test.wav');
        const fileStream = createWriteStream(outputPath);
        const chunks: Buffer[] = [];

        audioStream.on('data', (chunk: Buffer) => chunks.push(chunk));
        audioStream.pipe(fileStream);

        fileStream.on('finish', () => {
          expect(chunks.length).toBeGreaterThan(0);
          resolve(undefined);
        });

        audioStream.on('error', reject);
        fileStream.on('error', reject);
      });
    }, 10000);
  });

  describe('listen', () => {
    it('should transcribe audio stream to text', async () => {
      const audioStream = Readable.from(readFileSync(join(outputDir, 'speech-test.wav')));

      const result = await voice.listen(audioStream);
      console.log(result);
      expect(typeof result).toBe('string');
      expect(result).toContain('hello world');
    }, 10000);

    // it('should support streaming transcription', async () => {
    //   const audioStream = Readable.from(
    //     readFileSync(join(outputDir, 'speech-test.mp3'))
    //   );

    //   const outputStream = await voice.listen(audioStream, { stream: true });
    //   expect(outputStream).toBeInstanceOf(PassThrough);

    //   return new Promise((resolve, reject) => {
    //     const chunks: string[] = [];
    //     (outputStream as PassThrough).on('data', (chunk: string) => chunks.push(chunk));
    //     (outputStream as PassThrough).on('end', () => {
    //       expect(chunks.length).toBeGreaterThan(0);
    //       const transcription = chunks.join('');
    //       expect(transcription).toContain('hello world');
    //       resolve(undefined);
    //     });
    //     (outputStream as PassThrough).on('error', reject);
    //   });
    // });
  });
});
