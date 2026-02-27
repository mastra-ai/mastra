import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Agent } from '../agent';
import { InMemoryStore } from '../storage/mock';
import { Harness } from './harness';

function createAgent() {
  return new Agent({
    name: 'test-agent',
    instructions: 'You are a test agent.',
    model: { provider: 'openai', name: 'gpt-4o', toolChoice: 'auto' },
  });
}

/**
 * Create a mock stream response that processStream can consume without errors.
 */
function createMockStreamResponse() {
  const chunks: any[] = [
    { type: 'text-start', payload: { id: 'msg-1' } },
    { type: 'text-delta', payload: { id: 'msg-1', text: 'Hello' } },
    { type: 'text-end', payload: { id: 'msg-1' } },
    { type: 'step-end', payload: {} },
    { type: 'finish', payload: {} },
  ];

  return {
    fullStream: (async function* () {
      for (const chunk of chunks) {
        yield chunk;
      }
    })(),
  };
}

describe('Harness tracing propagation', () => {
  let agent: Agent;
  let harness: Harness;
  let streamSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    agent = createAgent();
    harness = new Harness({
      id: 'test-harness',
      storage: new InMemoryStore(),
      modes: [{ id: 'default', name: 'Default', default: true, agent }],
    });

    // Spy on agent.stream to capture the options it receives
    streamSpy = vi.spyOn(agent, 'stream').mockResolvedValue(createMockStreamResponse() as any);

    // Set up a thread so sendMessage doesn't try to create one via storage
    (harness as any).currentThreadId = 'test-thread-123';
  });

  // TODO(#13540): The fix should wrap agents with the tracing proxy (like wrapAgent)
  // so tracingContext is automatically injected into agent.stream() calls.
  it('should forward tracingContext to agent.stream()', async () => {
    await harness.sendMessage({ content: 'hello' });

    expect(streamSpy).toHaveBeenCalledTimes(1);

    const [, streamOptions] = streamSpy.mock.calls[0]!;

    expect(streamOptions).toHaveProperty('tracingContext');
  });

  // TODO(#13540): The fix should add tracingOptions as an optional parameter to
  // sendMessage() and forward it to agent.stream(). Update this test to pass
  // tracingOptions through sendMessage() once the API supports it.
  it('should forward tracingOptions to agent.stream()', async () => {
    await harness.sendMessage({ content: 'hello' });

    expect(streamSpy).toHaveBeenCalledTimes(1);

    const [, streamOptions] = streamSpy.mock.calls[0]!;

    expect(streamOptions).toHaveProperty('tracingOptions');
  });
});
