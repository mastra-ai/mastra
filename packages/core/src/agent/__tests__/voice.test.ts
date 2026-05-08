import { PassThrough } from 'node:stream';
import { openai } from '@ai-sdk/openai-v5';
import { beforeEach, describe, expect, it, expectTypeOf } from 'vitest';
import { CompositeVoice } from '../../voice/composite-voice';
import { MastraVoice } from '../../voice/voice';
import { Agent } from '../agent';
import type { AgentConfig } from '../types';

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

  /**
   * Type compatibility tests for GitHub Issue #12293
   * https://github.com/mastra-ai/mastra/issues/12293
   *
   * Verifies that MastraVoice implementations (like OpenAIVoice) can be
   * passed directly to Agent.voice without wrapping in CompositeVoice.
   */
  describe('type compatibility (issue #12293)', () => {
    it('AgentConfig.voice should accept MastraVoice', () => {
      type VoiceConfigType = NonNullable<AgentConfig['voice']>;
      expectTypeOf<MastraVoice>().toMatchTypeOf<VoiceConfigType>();
    });

    it('AgentConfig.voice should accept MastraVoice subclasses', () => {
      type VoiceConfigType = NonNullable<AgentConfig['voice']>;
      expectTypeOf<MockVoice>().toMatchTypeOf<VoiceConfigType>();
    });

    it('AgentConfig.voice should accept CompositeVoice', () => {
      type VoiceConfigType = NonNullable<AgentConfig['voice']>;
      expectTypeOf<CompositeVoice>().toMatchTypeOf<VoiceConfigType>();
    });

    it('should accept MastraVoice directly without CompositeVoice wrapper', () => {
      const mockVoice = new MockVoice({ speaker: 'mock-voice' });

      const agent = new Agent({
        id: 'direct-voice-agent',
        name: 'Direct Voice Agent',
        instructions: 'You are a voice assistant.',
        model: openai('gpt-4o-mini'),
        voice: mockVoice,
      });

      expect(agent.voice).toBeDefined();
    });

    it('voice methods should work when MastraVoice passed directly', async () => {
      const mockVoice = new MockVoice({ speaker: 'mock-voice' });

      const agent = new Agent({
        id: 'direct-voice-agent',
        name: 'Direct Voice Agent',
        instructions: 'You are a voice assistant.',
        model: openai('gpt-4o-mini'),
        voice: mockVoice,
      });

      const speakers = await agent.voice.getSpeakers();
      expect(speakers).toEqual([{ voiceId: 'mock-voice' }]);

      const audioStream = await agent.voice.speak('Hello');
      expect(audioStream).toBeDefined();
    });
  });
});
