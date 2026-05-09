/**
 * Harness v1 — runnable example.
 *
 *   tsx packages/core/src/harness/v1/examples/basic-session.ts
 *
 * Builds a Harness around a single mode + agent, opens a session, sends a
 * message, and logs the resulting `AgentResult`. The agent is faked so the
 * script runs without any model credentials; swap in a real `Agent` to send
 * actual requests.
 */

import { Agent } from '../../../agent';
import { InMemoryHarness } from '../../../storage/domains/harness/inmemory';
import { InMemoryDB } from '../../../storage/domains/inmemory-db';

import { Harness } from '../harness';

class FakeAgent extends Agent<any, any, any> {
  constructor() {
    super({
      id: 'demo',
      name: 'demo',
      instructions: 'a demo agent that ignores its model',
      model: 'openai/gpt-4o-mini' as any,
    });
  }

  async stream(messages: any): Promise<any> {
    const fullOutput = {
      text: `echoing back: ${typeof messages === 'string' ? messages : '<structured>'}`,
      usage: { inputTokens: 4, outputTokens: 8, totalTokens: 12 },
      finishReason: 'stop',
      object: undefined,
      steps: [],
      warnings: [],
      providerMetadata: undefined,
      request: {},
      reasoning: [],
      reasoningText: undefined,
      toolCalls: [],
      toolResults: [],
      sources: [],
      files: [],
      response: { id: 'r', timestamp: new Date(), modelId: 'demo', messages: [], uiMessages: [] },
      totalUsage: { inputTokens: 4, outputTokens: 8, totalTokens: 12 },
      error: undefined,
      tripwire: undefined,
      traceId: undefined,
      spanId: undefined,
      runId: 'demo-run',
      suspendPayload: undefined,
      messages: [],
      rememberedMessages: [],
    };
    return {
      getFullOutput: async () => fullOutput,
      text: Promise.resolve(fullOutput.text),
      finishReason: Promise.resolve(fullOutput.finishReason),
      usage: Promise.resolve(fullOutput.usage),
    };
  }
}

async function main() {
  const harness = new Harness({
    agents: { demo: new FakeAgent() } as any,
    modes: [{ id: 'chat', agentId: 'demo' }],
    defaultModeId: 'chat',
    sessions: { storage: new InMemoryHarness({ db: new InMemoryDB() }) },
  });

  const session = await harness.session({
    resourceId: 'demo-user',
    threadId: { fresh: true },
  });

  console.info('Opened session', {
    sessionId: session.id,
    threadId: session.threadId,
    mode: session.getCurrentMode().id,
  });

  const result = await session.message({ content: 'hello, harness' });

  console.info('Response:', result.text);
  console.info('Usage:', result.usage);
  console.info('Finish reason:', result.finishReason);

  const display = session.getDisplayState();
  console.info('Display state:', display);

  await harness.closeSession({ sessionId: session.id });
  await harness.shutdown();
}

main().catch(err => {
  console.error('Example failed:', err);
  process.exit(1);
});
