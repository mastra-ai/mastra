import { describe, it, expect } from 'vitest';
import { PassThrough } from 'stream';
import { createReadStream, writeFile } from 'fs';
import { join } from 'path';

import { AzureVoice } from './index';
import type { VoiceId } from './voices';

describe('AzureVoice', () => {
  const subscriptionKey = process.env.AZURE_API_KEY ?? 'fake-key';
  const region = process.env.AZURE_REGION ?? 'eastus';

  describe('getSpeakers', () => {
    it('should return a list of available voices', async () => {
      const azureVoice = new AzureVoice({
        speechModel: { apiKey: subscriptionKey, region },
      });

      const voices = await azureVoice.getSpeakers();

      expect(Array.isArray(voices)).toBe(true);
      expect(voices.length).toBeGreaterThan(0);
      expect(voices[0]).toHaveProperty('voiceId');
    });
  });

  describe('speak', () => {
    it('should generate audio from text (TTS)', async () => {
      const azureVoice = new AzureVoice({
        speechModel: { apiKey: subscriptionKey, region },
      });

      const text = 'Hello from Azure TTS!';
      const audioStream = await azureVoice.speak(text);

      const chunks: Buffer[] = [];
      for await (const chunk of audioStream) {
        chunks.push(chunk as Buffer);
      }
      const audioBuffer = Buffer.concat(chunks);
      expect(audioBuffer.length).toBeGreaterThan(0);

      // write it to a file for manual verification
      const outputPath = join(__dirname, '../test-outputs', 'test-azure-tts.wav');
      await writeFile(outputPath, audioBuffer, (err) => {
        if (err) throw err;
      });
    });

    it('should reject with error if credentials are invalid', async () => {
      const azureVoice = new AzureVoice({
        speechModel: { apiKey: 'INVALID', region },
      });

      await expect(azureVoice.speak('Hello test')).rejects.toThrowError();
    });

    it('should reject with error if input text is empty', async () => {
      const azureVoice = new AzureVoice({
        speechModel: { apiKey: subscriptionKey, region },
      });

      await expect(azureVoice.speak('')).rejects.toThrow('Input text is empty');
    });
  });

  describe('listen', () => {
    it('should transcribe audio (STT)', async () => {
      const azureVoice = new AzureVoice({
        listeningModel: { apiKey: subscriptionKey, region },
      });
  
      // Provide an actual audio file. This must be a short WAV or MP3 that Azure can handle
      const filePath = join(__dirname, 'test-data', 'hello.wav');
      const readable = createReadStream(filePath);
  
      const transcript = await azureVoice.listen(readable, { filetype: 'wav' });
      expect(typeof transcript).toBe('string');
      expect(transcript.length).toBeGreaterThan(0);
    });
  });

  describe('AzureVoice Error Handling', () => {
    it('should throw an error if no API key is provided', async () => {
      expect(() => {
        new AzureVoice({
          speechModel: { region: 'eastus' },
          listeningModel: { region: 'eastus' },
        });
      }).toThrowError('No Azure API key provided');
    });
  });
});
