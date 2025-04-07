import { Mastra } from '@mastra/core';
import { Agent } from '@mastra/core/agent';
import type { MastraVoice } from '@mastra/core/voice';
import { CompositeVoice } from '@mastra/core/voice';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getSpeakersHandler, generateSpeechHandler, transcribeSpeechHandler } from './voice';

vi.mock('@mastra/core/voice');

function createAgentWithVoice(voice?: MastraVoice) {
  return new Agent({
    name: 'test-agent',
    instructions: 'You are a helpful assistant',
    model: 'openai' as any,
    voice,
  });
}

describe('Voice Handlers', () => {
  const mockVoice = new CompositeVoice({});

  const mockAgent = createAgentWithVoice(mockVoice);

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
      ).rejects.toThrow('Agent does not have voice capabilities');
    });

    it('should get speakers successfully', async () => {
      const mockSpeakers = [{ voiceId: '1', name: 'Speaker 1' }];
      const agent = createAgentWithVoice(new CompositeVoice({}));

      agent.voice!.getSpeakers.mockResolvedValue(mockSpeakers);

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
      ).rejects.toThrow('Argument "speakerId" is required');
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
      const agentWithoutVoice = createAgentWithVoice();

      await expect(
        generateSpeechHandler({
          mastra: new Mastra({ logger: false, agents: { 'test-agent': agentWithoutVoice } }),
          agentId: 'test-agent',
          body: {
            text: 'test',
            speakerId: '1',
          },
        }),
      ).rejects.toThrow('Agent does not have voice capabilities');
    });

    it('should throw error when speech generation fails', async () => {
      const mockSpeakers = [{ voiceId: '1', name: 'Speaker 1' }];
      const agent = createAgentWithVoice(
        new CompositeVoice({
          speakProvider: { getSpeakers: () => Promise.resolve(mockSpeakers) } as any,
        }),
      );

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

      const agent = createAgentWithVoice(new CompositeVoice({}));
      agent.voice.speak.mockResolvedValue(mockAudioStream);

      const result = (await generateSpeechHandler({
        mastra: new Mastra({ logger: false, agents: { 'test-agent': agent } }),
        agentId: 'test-agent',
        body: {
          text: 'test',
          speakerId: '1',
        },
      })) as { audioData: Buffer };

      expect(result).toHaveProperty('audioData');
      expect(Buffer.isBuffer(result.audioData)).toBe(true);
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
      const agentWithoutVoice = { ...mockAgent, voice: undefined };
      vi.spyOn(mastra, 'getAgent').mockReturnValueOnce(agentWithoutVoice);
      await expect(
        transcribeSpeechHandler({
          mastra,
          agentId: 'test-agent',
          body: {
            audioData: Buffer.from('test'),
          },
        }),
      ).rejects.toThrow('Agent does not have voice capabilities');
    });

    it('should transcribe speech successfully', async () => {
      const mockText = 'transcribed text';
      mockAgent.voice.listen.mockResolvedValue(mockText);

      const result = await transcribeSpeechHandler({
        mastra,
        agentId: 'test-agent',
        body: {
          audioData: Buffer.from('test'),
          options: { language: 'en' },
        },
      });

      expect(result).toEqual({ text: mockText });
      expect(mockAgent.voice.listen).toHaveBeenCalled();
    });
  });
});
