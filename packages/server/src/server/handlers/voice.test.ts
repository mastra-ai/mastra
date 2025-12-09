import { Agent } from '@mastra/core/agent';
import { Mastra } from '@mastra/core/mastra';
import type { MastraVoice } from '@mastra/core/voice';
import { CompositeVoice } from '@mastra/core/voice';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createTestServerContext } from './test-utils';
import { GET_SPEAKERS_ROUTE, GENERATE_SPEECH_ROUTE, TRANSCRIBE_SPEECH_ROUTE } from './voice';

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
    id: name ?? 'test-agent',
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
      await expect(
        GET_SPEAKERS_ROUTE.handler({ ...createTestServerContext({ mastra }), agentId: undefined as any }),
      ).rejects.toThrow('Agent ID is required');
    });

    it('should throw error when agent is not found', async () => {
      await expect(
        GET_SPEAKERS_ROUTE.handler({ ...createTestServerContext({ mastra }), agentId: 'non-existent' as any }),
      ).rejects.toThrow('Agent with id non-existent not found');
    });

    it('should return empty array when agent does not have voice capabilities', async () => {
      const agentWithoutVoice = createAgentWithVoice();
      const result = await GET_SPEAKERS_ROUTE.handler({
        ...createTestServerContext({
          mastra: new Mastra({ logger: false, agents: { 'test-agent': agentWithoutVoice } }),
        }),
        agentId: 'test-agent',
      });
      expect(result).toEqual([]);
    });

    it('should get speakers successfully', async () => {
      const mockSpeakers = [{ voiceId: '1', name: 'Speaker 1' }];
      const agent = createAgentWithVoice({ voice: new CompositeVoice({}) });

      vi.spyOn(agent, 'getVoice').mockReturnValue({
        getSpeakers: vi.fn().mockResolvedValue(mockSpeakers),
      } as any);

      const result = await GET_SPEAKERS_ROUTE.handler({
        ...createTestServerContext({ mastra: new Mastra({ logger: false, agents: { 'test-agent': agent } }) }),
        agentId: 'test-agent',
      });

      expect(result).toEqual(mockSpeakers);
    });
  });

  describe('generateSpeechHandler', () => {
    it('should throw error when agentId is not provided', async () => {
      await expect(
        GENERATE_SPEECH_ROUTE.handler({
          ...createTestServerContext({ mastra }),
          text: 'test',
          speakerId: '1',
          agentId: undefined as any,
        }),
      ).rejects.toThrow('Agent ID is required');
    });

    it('should throw error when text or speakerId is not provided', async () => {
      await expect(
        GENERATE_SPEECH_ROUTE.handler({
          ...createTestServerContext({ mastra }),
          agentId: 'test-agent',
          text: 'test',
        }),
      ).rejects.toThrow('Failed to generate speech');
    });

    it('should throw error when agent is not found', async () => {
      await expect(
        GENERATE_SPEECH_ROUTE.handler({
          ...createTestServerContext({ mastra }),
          agentId: 'non-existent',
          text: 'test',
          speakerId: '1',
        }),
      ).rejects.toThrow('Agent with id non-existent not found');
    });

    it('should throw error when agent does not have voice capabilities', async () => {
      const agentWithoutVoice = createAgentWithVoice({ voice: undefined });

      await expect(
        GENERATE_SPEECH_ROUTE.handler({
          ...createTestServerContext({
            mastra: new Mastra({ logger: false, agents: { 'test-agent': agentWithoutVoice } }),
          }),
          agentId: 'test-agent',
          text: 'test',
          speakerId: '1',
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
        GENERATE_SPEECH_ROUTE.handler({
          ...createTestServerContext({ mastra: new Mastra({ logger: false, agents: { 'test-agent': agent } }) }),
          agentId: 'test-agent',
          text: 'test',
          speakerId: '1',
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

      const audioStream = await GENERATE_SPEECH_ROUTE.handler({
        ...createTestServerContext({ mastra: new Mastra({ logger: false, agents: { 'test-agent': agent } }) }),
        agentId: 'test-agent',
        text: 'test',
        speakerId: '1',
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

      const audioStream = await GENERATE_SPEECH_ROUTE.handler({
        ...createTestServerContext({ mastra: new Mastra({ logger: false, agents: { 'test-agent': agent } }) }),
        agentId: 'test-agent',
        text: 'test',
        speakerId: '1',
      });

      expect(audioStream).toBeDefined();
      expect(audioStream[Symbol.asyncIterator]).toBeDefined();
    });
  });

  describe('transcribeSpeechHandler', () => {
    it('should throw error when agentId is not provided', async () => {
      await expect(
        TRANSCRIBE_SPEECH_ROUTE.handler({
          ...createTestServerContext({ mastra }),
          agentId: undefined as any,
          audioData: Buffer.from('test'),
        }),
      ).rejects.toThrow('Agent ID is required');
    });

    it('should throw error when audioData is not provided', async () => {
      await expect(
        TRANSCRIBE_SPEECH_ROUTE.handler({
          ...createTestServerContext({ mastra }),
          agentId: 'test-agent',
          audioData: undefined as any,
        }),
      ).rejects.toThrow('Audio data is required');
    });

    it('should throw error when agent is not found', async () => {
      await expect(
        TRANSCRIBE_SPEECH_ROUTE.handler({
          ...createTestServerContext({ mastra }),
          agentId: 'non-existent',
          audioData: Buffer.from('test'),
        }),
      ).rejects.toThrow('Agent with id non-existent not found');
    });

    it('should throw error when agent does not have voice capabilities', async () => {
      const agentWithoutVoice = createAgentWithVoice({ voice: undefined });

      await expect(
        TRANSCRIBE_SPEECH_ROUTE.handler({
          ...createTestServerContext({
            mastra: new Mastra({ logger: false, agents: { 'test-agent': agentWithoutVoice } }),
          }),
          agentId: 'test-agent',
          audioData: Buffer.from('test'),
        }),
      ).rejects.toThrow('No voice provider configured');
    });

    it('should transcribe speech successfully', async () => {
      const mockText = 'transcribed text';
      const mockListen = vi.fn().mockResolvedValue(mockText);

      vi.spyOn(mockAgent, 'getVoice').mockReturnValue({
        listen: mockListen,
      } as any);

      const result = await TRANSCRIBE_SPEECH_ROUTE.handler({
        ...createTestServerContext({ mastra }),
        agentId: 'test-agent',
        audioData: Buffer.from('test'),
        options: { language: 'en' },
      });

      expect(result).toEqual({ text: mockText });
      expect(mockListen).toHaveBeenCalled();
    });
  });
});
