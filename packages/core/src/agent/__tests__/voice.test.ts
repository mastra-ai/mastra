import { PassThrough } from 'stream';
import { openai } from '@ai-sdk/openai-v5';
import { beforeEach, describe, expect, it } from 'vitest';
import { CompositeVoice } from '../../voice/composite-voice';
import { MastraVoice } from '../../voice/voice';
import { Agent } from '../agent';

describe('voice capabilities', () => {
  class MockVoice extends MastraVoice {
    async speak(): Promise<NodeJS.ReadableStream> {
      const stream = new PassThrough();
      stream.end('mock audio');
      return stream;
    }

    async listen(): Promise<string> {
      return 'mock transcription';
    }

    async getSpeakers() {
      return [{ voiceId: 'mock-voice' }];
    }
  }

  let voiceAgent: Agent;
  beforeEach(() => {
    voiceAgent = new Agent({
      id: 'voice-agent',
      name: 'Voice Agent',
      instructions: 'You are an agent with voice capabilities',
      model: openai('gpt-4o-mini'),
      voice: new CompositeVoice({
        output: new MockVoice({
          speaker: 'mock-voice',
        }),
        input: new MockVoice({
          speaker: 'mock-voice',
        }),
      }),
    });
  });

  describe('getSpeakers', () => {
    it('should list available voices', async () => {
      const speakers = await voiceAgent.voice?.getSpeakers();
      expect(speakers).toEqual([{ voiceId: 'mock-voice' }]);
    });
  });

  describe('speak', () => {
    it('should generate audio stream from text', async () => {
      const audioStream = await voiceAgent.voice?.speak('Hello World', {
        speaker: 'mock-voice',
      });

      if (!audioStream) {
        expect(audioStream).toBeDefined();
        return;
      }

      const chunks: Buffer[] = [];
      for await (const chunk of audioStream) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }
      const audioBuffer = Buffer.concat(chunks);

      expect(audioBuffer.toString()).toBe('mock audio');
    });

    it('should work with different parameters', async () => {
      const audioStream = await voiceAgent.voice?.speak('Test with parameters', {
        speaker: 'mock-voice',
        speed: 0.5,
      });

      if (!audioStream) {
        expect(audioStream).toBeDefined();
        return;
      }

      const chunks: Buffer[] = [];
      for await (const chunk of audioStream) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }
      const audioBuffer = Buffer.concat(chunks);

      expect(audioBuffer.toString()).toBe('mock audio');
    });
  });

  describe('listen', () => {
    it('should transcribe audio', async () => {
      const audioStream = new PassThrough();
      audioStream.end('test audio data');

      const text = await voiceAgent.voice?.listen(audioStream);
      expect(text).toBe('mock transcription');
    });

    it('should accept options', async () => {
      const audioStream = new PassThrough();
      audioStream.end('test audio data');

      const text = await voiceAgent.voice?.listen(audioStream, {
        language: 'en',
      });
      expect(text).toBe('mock transcription');
    });
  });

  describe('error handling', () => {
    it('should throw error when no voice provider is configured', async () => {
      const agentWithoutVoice = new Agent({
        id: 'no-voice-agent',
        name: 'No Voice Agent',
        instructions: 'You are an agent without voice capabilities',
        model: openai('gpt-4o-mini'),
      });

      await expect(agentWithoutVoice.voice.getSpeakers()).rejects.toThrow('No voice provider configured');
      await expect(agentWithoutVoice.voice.speak('Test')).rejects.toThrow('No voice provider configured');
      await expect(agentWithoutVoice.voice.listen(new PassThrough())).rejects.toThrow('No voice provider configured');
    });
  });
});
