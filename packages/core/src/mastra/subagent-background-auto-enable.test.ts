import { describe, expect, it } from 'vitest';
import { Agent } from '../agent';
import { MockStore } from '../storage';
import { Mastra } from './index';

describe.skip('Mastra — background tasks auto-enable for sub-agents', () => {
  it('enables the background task manager when an agent has sub-agents', () => {
    const subAgent = new Agent({
      id: 'child',
      name: 'child',
      instructions: 'child',
      model: 'openai/gpt-4o',
    });

    const parent = new Agent({
      id: 'parent',
      name: 'parent',
      instructions: 'parent',
      model: 'openai/gpt-4o',
      agents: { child: subAgent },
    });

    const mastra = new Mastra({
      logger: false,
      storage: new MockStore(),
      agents: { parent },
    });

    expect(mastra.backgroundTaskManager).toBeDefined();
  });

  it('does not enable the background task manager when no agent has sub-agents', () => {
    const agent = new Agent({
      id: 'solo',
      name: 'solo',
      instructions: 'solo',
      model: 'openai/gpt-4o',
    });

    const mastra = new Mastra({
      logger: false,
      storage: new MockStore(),
      agents: { agent },
    });

    expect(mastra.backgroundTaskManager).toBeUndefined();
  });

  it('respects explicit opt-out via backgroundTasks.enabled: false', () => {
    const subAgent = new Agent({
      id: 'child',
      name: 'child',
      instructions: 'child',
      model: 'openai/gpt-4o',
    });

    const parent = new Agent({
      id: 'parent',
      name: 'parent',
      instructions: 'parent',
      model: 'openai/gpt-4o',
      agents: { child: subAgent },
    });

    const mastra = new Mastra({
      logger: false,
      storage: new MockStore(),
      backgroundTasks: { enabled: false },
      agents: { parent },
    });

    expect(mastra.backgroundTaskManager).toBeUndefined();
  });

  it('enables the manager when agents are configured via a function resolver', () => {
    const parent = new Agent({
      id: 'parent',
      name: 'parent',
      instructions: 'parent',
      model: 'openai/gpt-4o',
      agents: () =>
        ({
          child: new Agent({
            id: 'child',
            name: 'child',
            instructions: 'child',
            model: 'openai/gpt-4o',
          }),
        }) as any,
    });

    const mastra = new Mastra({
      logger: false,
      storage: new MockStore(),
      agents: { parent },
    });

    // Function resolvers are evaluated per-request, so we can't inspect their
    // contents at registration time. Enable defensively so resolved sub-agents
    // still dispatch in the background by default.
    expect(mastra.backgroundTaskManager).toBeDefined();
  });

  it('keeps manager enabled when adding a second agent without sub-agents', () => {
    const subAgent = new Agent({
      id: 'child',
      name: 'child',
      instructions: 'child',
      model: 'openai/gpt-4o',
    });

    const parent = new Agent({
      id: 'parent',
      name: 'parent',
      instructions: 'parent',
      model: 'openai/gpt-4o',
      agents: { child: subAgent },
    });

    const solo = new Agent({
      id: 'solo',
      name: 'solo',
      instructions: 'solo',
      model: 'openai/gpt-4o',
    });

    const mastra = new Mastra({
      logger: false,
      storage: new MockStore(),
      agents: { parent, solo },
    });

    expect(mastra.backgroundTaskManager).toBeDefined();
  });
});
