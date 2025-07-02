import { Mastra } from '@mastra/core';
import { Agent } from '@mastra/core/agent';
import type { MastraVoice } from '@mastra/core/voice';
import { CompositeVoice } from '@mastra/core/voice';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getSpeakersHandler, generateSpeechHandler, transcribeSpeechHandler } from './voice';

vi.mock('@mastra/core/voice');

function createAgentWithVoice({
  name,
  model,
  voice,
  instructions,
}: {
  name?: string;
  model?: string;
  voice?: MastraVoice;
  instructions?: string | (() => string);
} = {}) {
  return new Agent({
    name: name ?? 'test-agent',
    instructions: instructions ?? 'You are a helpful assistant',
    model: model ?? ('openai' as any),
    voice,
  });
}

describe('Voice Handlers', () => {
  const mockVoice = new CompositeVoice({});

  const mockAgent = createAgentWithVoice({ voice: mockVoice });

  let mastra: Mastra;

  beforeEach(() => {
    vi.clearAllMocks();
    mastra = new Mastra({
      logger: false,
      agents: {
        'test-agent': mockAgent,
      },
    });
  });

  describe('getSpeakersHandler', () => {
    it('should throw error when agentId is not provided', async () => {
      await expect(getSpeakersHandler({ mastra })).rejects.toThrow('Agent ID is required');
    });

    it('should throw error when agent is not found', async () => {
      await expect(getSpeakersHandler({ mastra, agentId: 'non-existent' })).rejects.toThrow(
        'Agent with name non-existent not found',
      );
    });

    it('should throw error when agent does not have voice capabilities', async () => {
      const agentWithoutVoice = createAgentWithVoice();
      await expect(
        getSpeakersHandler({
          mastra: new Mastra({ logger: false, agents: { 'test-agent': agentWithoutVoice } }),
          agentId: 'test-agent',
        }),
      ).rejects.toThrow('No voice provider configured');
    });

    it('should get speakers successfully', async () => {
      const mockSpeakers = [{ voiceId: '1', name: 'Speaker 1' }];
      const agent = createAgentWithVoice({ voice: new CompositeVoice({}) });

      vi.spyOn(agent, 'getVoice').mockReturnValue({
        getSpeakers: vi.fn().mockResolvedValue(mockSpeakers),
      } as any);

      const result = await getSpeakersHandler({
        mastra: new Mastra({ logger: false, agents: { 'test-agent': agent } }),
        agentId: 'test-agent',
      });

      expect(result).toEqual(mockSpeakers);
    });
  });

  describe('generateSpeechHandler', () => {
    it('should throw error when agentId is not provided', async () => {
      await expect(
        generateSpeechHandler({
          mastra,
          body: {
            text: 'test',
            speakerId: '1',
          },
        }),
      ).rejects.toThrow('Agent ID is required');
    });

    it('should throw error when text or speakerId is not provided', async () => {
      await expect(
        generateSpeechHandler({
          mastra,
          agentId: 'test-agent',
          body: {
            text: 'test',
          },
        }),
      ).rejects.toThrow('Failed to generate speech');
    });

    it('should throw error when agent is not found', async () => {
      await expect(
        generateSpeechHandler({
          mastra,
          agentId: 'non-existent',
          body: {
            text: 'test',
            speakerId: '1',
          },
        }),
      ).rejects.toThrow('Agent with name non-existent not found');
    });

    it('should throw error when agent does not have voice capabilities', async () => {
      const agentWithoutVoice = createAgentWithVoice({ voice: undefined });

      await expect(
        generateSpeechHandler({
          mastra: new Mastra({ logger: false, agents: { 'test-agent': agentWithoutVoice } }),
          agentId: 'test-agent',
          body: {
            text: 'test',
            speakerId: '1',
          },
        }),
      ).rejects.toThrow('No voice provider configured');
    });

    it('should throw error when speech generation fails', async () => {
      const mockSpeakers = [{ voiceId: '1', name: 'Speaker 1' }];
      const agent = createAgentWithVoice({
        voice: new CompositeVoice({
          speakProvider: { getSpeakers: () => Promise.resolve(mockSpeakers) } as any,
        }),
      });

      await expect(
        generateSpeechHandler({
          mastra: new Mastra({ logger: false, agents: { 'test-agent': agent } }),
          agentId: 'test-agent',
          body: {
            text: 'test',
            speakerId: '1',
          },
        }),
      ).rejects.toThrow('Failed to generate speech');
    });

    it('should generate speech successfully', async () => {
      const mockAudioStream = {
        [Symbol.asyncIterator]: async function* () {
          yield Buffer.from('test audio data');
        },
      };

      const agent = createAgentWithVoice({ voice: new CompositeVoice({}) });

      vi.spyOn(agent, 'getVoice').mockReturnValue({
        speak: vi.fn().mockResolvedValue(mockAudioStream),
      } as any);

      const audioStream = await generateSpeechHandler({
        mastra: new Mastra({ logger: false, agents: { 'test-agent': agent } }),
        agentId: 'test-agent',
        body: {
          text: 'test',
          speakerId: '1',
        },
      });

      expect(audioStream).toBeDefined();
      expect(audioStream[Symbol.asyncIterator]).toBeDefined();
    });

    it('should generate speech successfully with dynamic instructions', async () => {
      const mockAudioStream = {
        [Symbol.asyncIterator]: async function* () {
          yield Buffer.from('test audio data');
        },
      };

      const agent = createAgentWithVoice({
        voice: new CompositeVoice({}),
        instructions: () => 'You are a dynamic assistant',
      });

      vi.spyOn(agent, 'getVoice').mockReturnValue({
        speak: vi.fn().mockResolvedValue(mockAudioStream),
      } as any);

      const audioStream = await generateSpeechHandler({
        mastra: new Mastra({ logger: false, agents: { 'test-agent': agent } }),
        agentId: 'test-agent',
        body: {
          text: 'test',
          speakerId: '1',
        },
      });

      expect(audioStream).toBeDefined();
      expect(audioStream[Symbol.asyncIterator]).toBeDefined();
    });
  });

  describe('transcribeSpeechHandler', () => {
    it('should throw error when agentId is not provided', async () => {
      await expect(
        transcribeSpeechHandler({
          mastra,
          body: {
            audioData: Buffer.from('test'),
          },
        }),
      ).rejects.toThrow('Agent ID is required');
    });

    it('should throw error when audioData is not provided', async () => {
      await expect(
        transcribeSpeechHandler({
          mastra,
          agentId: 'test-agent',
          body: {},
        }),
      ).rejects.toThrow('Audio data is required');
    });

    it('should throw error when agent is not found', async () => {
      await expect(
        transcribeSpeechHandler({
          mastra,
          agentId: 'non-existent',
          body: {
            audioData: Buffer.from('test'),
          },
        }),
      ).rejects.toThrow('Agent with name non-existent not found');
    });

    it('should throw error when agent does not have voice capabilities', async () => {
      const agentWithoutVoice = createAgentWithVoice({ voice: undefined });

      await expect(
        transcribeSpeechHandler({
          mastra: new Mastra({ logger: false, agents: { 'test-agent': agentWithoutVoice } }),
          agentId: 'test-agent',
          body: {
            audioData: Buffer.from('test'),
          },
        }),
      ).rejects.toThrow('No voice provider configured');
    });

    it('should transcribe speech successfully', async () => {
      const mockText = 'transcribed text';
      const mockListen = vi.fn().mockResolvedValue(mockText);

      vi.spyOn(mockAgent, 'getVoice').mockReturnValue({
        listen: mockListen,
      } as any);

      const result = await transcribeSpeechHandler({
        mastra,
        agentId: 'test-agent',
        body: {
          audioData: Buffer.from('test'),
          options: { language: 'en' },
        },
      });

      expect(result).toEqual({ text: mockText });
      expect(mockListen).toHaveBeenCalled();
    });
  });
});
