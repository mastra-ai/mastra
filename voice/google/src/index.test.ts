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
