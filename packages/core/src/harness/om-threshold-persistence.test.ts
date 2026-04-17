import { describe, it, expect, beforeEach } from 'vitest';
import { Agent } from '../agent';
import { InMemoryStore } from '../storage/mock';
import { Harness } from './harness';

function createHarness(storage: InMemoryStore, initialState: Record<string, unknown> = {}) {
  const agent = new Agent({
    name: 'test-agent',
    instructions: 'You are a test agent.',
    model: { provider: 'openai', name: 'gpt-4o', toolChoice: 'auto' },
  });

  return new Harness({
    id: 'test-harness',
    storage,
    initialState: initialState as any,
    modes: [{ id: 'default', name: 'Default', default: true, agent }],
  });
}

describe('Harness OM threshold persistence', () => {
  let storage: InMemoryStore;

  beforeEach(() => {
    storage = new InMemoryStore();
  });

  it('restores observation and reflection thresholds from thread metadata when switching back to a thread', async () => {
    const harness = createHarness(storage, {
      observationThreshold: 30000,
      reflectionThreshold: 40000,
    });
    await harness.init();

    const threadA = await harness.createThread();
    await harness.setState({ observationThreshold: 12000, reflectionThreshold: 21000 } as any);
    await harness.setThreadSetting({ key: 'observationThreshold', value: 12000 });
    await harness.setThreadSetting({ key: 'reflectionThreshold', value: 21000 });

    await harness.createThread();
    await harness.setState({ observationThreshold: 33000, reflectionThreshold: 44000 } as any);

    await harness.switchThread({ threadId: threadA.id });

    expect((harness.getState() as any).observationThreshold).toBe(12000);
    expect((harness.getState() as any).reflectionThreshold).toBe(21000);
  });

  it('persists current thresholds onto an existing thread when metadata does not define overrides', async () => {
    const harness = createHarness(storage, {
      observationThreshold: 15000,
      reflectionThreshold: 25000,
    });
    await harness.init();

    const thread = await harness.createThread();
    await harness.setState({ observationThreshold: 18000, reflectionThreshold: 28000 } as any);

    await harness.switchThread({ threadId: thread.id });

    expect((harness.getState() as any).observationThreshold).toBe(18000);
    expect((harness.getState() as any).reflectionThreshold).toBe(28000);

    const memory = await storage.getStore('memory');
    const savedThread = await memory?.getThreadById({ threadId: thread.id });
    expect(savedThread?.metadata?.observationThreshold).toBe(18000);
    expect(savedThread?.metadata?.reflectionThreshold).toBe(28000);
  });
});
