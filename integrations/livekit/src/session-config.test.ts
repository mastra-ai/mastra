import type { voice } from '@livekit/agents';
import { describe, expect, expectTypeOf, it } from 'vitest';
import { LiveKitSessionConfigSchema } from './session-config';
import type { LiveKitSessionOptions } from './session-config';

describe('LiveKitSessionConfigSchema', () => {
  it('produces options accepted directly by LiveKit without introducing defaults', () => {
    expectTypeOf<LiveKitSessionOptions>().toExtend<voice.AgentSessionOptions>();
    const config = {
      version: 1,
      options: {
        stt: 'deepgram/nova-3:en',
        tts: 'cartesia/sonic-3',
        userAwayTimeout: null,
        turnHandling: {
          endpointing: { mode: 'dynamic', minDelay: 200, maxDelay: 1500 },
          interruption: { enabled: false, minDuration: 500, minWords: 2, resumeFalseInterruption: false },
        },
      },
    };
    expect(LiveKitSessionConfigSchema.parse(config)).toEqual(config);
    expect(LiveKitSessionConfigSchema.parse({ version: 1, options: {} })).toEqual({ version: 1, options: {} });
  });

  it.each([
    { version: 2, options: {} },
    { options: {} },
    { version: 1 },
    { version: 1, options: {}, extra: true },
    { version: 1, options: { stt: { model: 'deepgram/nova-3' } } },
    { version: 1, options: { tts: ' ' } },
    { version: 1, options: { userAwayTimeout: -1 } },
    { version: 1, options: { userAwayTimeout: Infinity } },
    { version: 1, options: { llm: 'not-a-mastra-agent' } },
    { version: 1, options: { turnHandling: { preemptiveGeneration: { enabled: true } } } },
    { version: 1, options: { turnHandling: { endpointing: { minDelay: 2000, maxDelay: 500 } } } },
    { version: 1, options: { turnHandling: { endpointing: { minDelay: -1 } } } },
    { version: 1, options: { turnHandling: { interruption: { minWords: 1.5 } } } },
    { version: 1, options: { turnHandling: { interruption: { mode: 'unknown' } } } },
  ])('rejects unsupported or invalid configuration: %j', config => {
    expect(() => LiveKitSessionConfigSchema.parse(config)).toThrow();
  });
});
