import { initializeLogger, voice } from '@livekit/agents';
import { Agent } from '@mastra/core/agent';
import { createMockModel } from '@mastra/core/test-utils/llm-mock';
import { beforeAll, describe, expect, it } from 'vitest';
import { createMastraVoiceAgent, MastraVoiceAgent } from './worker-entry';

// Mirrors the docs example in docs/src/content/en/integrations/voice/livekit.mdx
// ("MastraVoiceAgent"): the exported class must be usable with the
// @livekit/agents voice.testing harness without STT/TTS or a running worker.

beforeAll(() => {
  // AgentSession throws outside a LiveKit worker unless the logger is initialized.
  initializeLogger({ level: 'silent', pretty: false });
});

function mastraAgent(reply: string) {
  return new Agent({
    id: 'support',
    name: 'support',
    instructions: 'You answer questions about opening hours.',
    model: createMockModel({ objectGenerationMode: 'json', mockText: reply }),
  });
}

describe('MastraVoiceAgent with voice.testing', () => {
  it('answers a text turn through the Mastra agent', async () => {
    const session = new voice.AgentSession();
    await session.start({
      agent: new MastraVoiceAgent({ agent: mastraAgent('We open at 9am.'), memory: false }),
    });

    const result = session.run({ userInput: 'What are your opening hours?' });
    await result.wait();

    result.expect.nextEvent().isMessage({ role: 'assistant' });
    result.expect.noMoreEvents();
    expect(result.events).toHaveLength(1);

    await session.close();
  });

  it('createMastraVoiceAgent produces an equivalent agent', async () => {
    const session = new voice.AgentSession();
    await session.start({
      agent: createMastraVoiceAgent({ agent: mastraAgent('We open at 9am.'), memory: false }),
    });

    const result = session.run({ userInput: 'Hello' });
    await result.wait();

    result.expect.nextEvent().isMessage({ role: 'assistant' });
    result.expect.noMoreEvents();

    await session.close();
  });
});
