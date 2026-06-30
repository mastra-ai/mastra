import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Captured constructor configs so we can assert how each provider's voice client
 * was built (model name, apiKey, baseURL) without hitting the network.
 */
const openaiCalls: Array<Record<string, any>> = [];
const deepgramCalls: Array<Record<string, any>> = [];

vi.mock('@mastra/voice-openai', () => ({
  OpenAIVoice: class {
    constructor(config: Record<string, any>) {
      openaiCalls.push(config);
    }
    async listen() {
      return 'openai transcript';
    }
  },
}));

vi.mock('@mastra/voice-deepgram', () => ({
  DeepgramVoice: class {
    constructor(config: Record<string, any>) {
      deepgramCalls.push(config);
    }
    async listen() {
      // Deepgram returns an object shape, not a bare string.
      return { transcript: 'deepgram transcript', words: [] };
    }
  },
}));

import { transcribeAudio, VoiceCredentialError, resolveProviderApiKey } from '../transcribe.js';

const AUDIO = Buffer.from('fake-wav');

describe('transcribeAudio provider routing', () => {
  beforeEach(() => {
    openaiCalls.length = 0;
    deepgramCalls.length = 0;
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('routes the default (openai/whisper-1) through OpenAIVoice with no baseURL', async () => {
    vi.stubEnv('OPENAI_API_KEY', 'sk-openai');
    const text = await transcribeAudio(AUDIO);
    expect(text).toBe('openai transcript');
    expect(deepgramCalls).toHaveLength(0);
    expect(openaiCalls).toHaveLength(1);
    expect(openaiCalls[0]!.listeningModel.name).toBe('whisper-1');
    expect(openaiCalls[0]!.listeningModel.apiKey).toBe('sk-openai');
    expect(openaiCalls[0]!.listeningModel.options).toBeUndefined();
  });

  it('routes an openai-compatible host (groq) through OpenAIVoice with its baseURL', async () => {
    vi.stubEnv('GROQ_API_KEY', 'gsk-groq');
    const text = await transcribeAudio(AUDIO, { provider: 'groq', model: 'whisper-large-v3-turbo' });
    expect(text).toBe('openai transcript');
    expect(openaiCalls).toHaveLength(1);
    expect(openaiCalls[0]!.listeningModel.name).toBe('whisper-large-v3-turbo');
    expect(openaiCalls[0]!.listeningModel.apiKey).toBe('gsk-groq');
    expect(openaiCalls[0]!.listeningModel.options.baseURL).toBe('https://api.groq.com/openai/v1');
  });

  it('routes Deepgram through the dedicated DeepgramVoice and normalizes { transcript }', async () => {
    vi.stubEnv('DEEPGRAM_API_KEY', 'dg-key');
    const text = await transcribeAudio(AUDIO, { provider: 'deepgram', model: 'nova-3' });
    expect(text).toBe('deepgram transcript');
    expect(openaiCalls).toHaveLength(0);
    expect(deepgramCalls).toHaveLength(1);
    expect(deepgramCalls[0]!.listeningModel.name).toBe('nova-3');
    expect(deepgramCalls[0]!.listeningModel.apiKey).toBe('dg-key');
  });

  it('throws VoiceCredentialError when the provider has no key', async () => {
    // Force the key empty so the test is deterministic regardless of the host
    // environment (e.g. a real DEEPGRAM_API_KEY exported on a dev machine/CI).
    vi.stubEnv('DEEPGRAM_API_KEY', '');
    await expect(transcribeAudio(AUDIO, { provider: 'deepgram' })).rejects.toBeInstanceOf(VoiceCredentialError);
  });

  it('resolveProviderApiKey honors env over stored credentials', () => {
    vi.stubEnv('DEEPGRAM_API_KEY', 'env-key');
    const authStorage = { getStoredApiKey: () => 'stored-key' } as any;
    expect(resolveProviderApiKey('deepgram', authStorage)).toBe('env-key');
  });

  it('resolveProviderApiKey falls back to stored credentials when env is unset', () => {
    const authStorage = { getStoredApiKey: (p: string) => (p === 'groq' ? 'stored-groq' : undefined) } as any;
    expect(resolveProviderApiKey('groq', authStorage)).toBe('stored-groq');
  });
});
