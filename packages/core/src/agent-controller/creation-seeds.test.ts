import { describe, it, expect, beforeEach } from 'vitest';
import { Agent } from '../agent';
import { InMemoryStore } from '../storage/mock';
import { AgentController } from './agent-controller';
import { createMockWorkspace } from './test-utils';

type AgentControllerTestState = { currentModelId?: string };

const agent = () =>
  new Agent({
    name: 'test-agent',
    instructions: 'You are a test agent.',
    model: { provider: 'openai', name: 'gpt-4o', toolChoice: 'auto' },
  });

async function buildController(storage: InMemoryStore): Promise<AgentController<AgentControllerTestState>> {
  const controller = new AgentController<AgentControllerTestState>({
    workspace: createMockWorkspace(),
    id: 'test-controller',
    storage,
    stateSchema: undefined,
    modes: [
      { id: 'build', name: 'Build', default: true, defaultModelId: 'openai/gpt-5.5', agent: agent() },
      { id: 'plan', name: 'Plan', defaultModelId: 'openai/gpt-5.2-codex', agent: agent() },
    ],
  });
  await controller.init();
  return controller;
}

async function buildControllerWithoutModeDefaults(
  storage: InMemoryStore,
): Promise<AgentController<AgentControllerTestState>> {
  const controller = new AgentController<AgentControllerTestState>({
    workspace: createMockWorkspace(),
    id: 'test-controller',
    storage,
    stateSchema: undefined,
    modes: [
      { id: 'build', name: 'Build', default: true, agent: agent() },
      { id: 'plan', name: 'Plan', agent: agent() },
    ],
  });
  await controller.init();
  return controller;
}

describe('sessions born configured via createSession modeId/modelId', () => {
  let storage: InMemoryStore;

  beforeEach(() => {
    storage = new InMemoryStore();
  });

  it("starts in the requested mode with that mode's default model", async () => {
    const controller = await buildController(storage);
    const session = await controller.createSession({ id: 's1', ownerId: 'o', modeId: 'plan' });

    expect(session.mode.get()).toBe('plan');
    expect(session.model.get()).toBe('openai/gpt-5.2-codex');
  });

  it('starts on the requested model when one is given', async () => {
    const controller = await buildController(storage);
    const session = await controller.createSession({
      id: 's1',
      ownerId: 'o',
      modeId: 'plan',
      modelId: 'cerebras/zai-glm-4.7',
    });

    expect(session.mode.get()).toBe('plan');
    expect(session.model.get()).toBe('cerebras/zai-glm-4.7');
  });

  it('rejects a mode the controller does not have', async () => {
    const controller = await buildController(storage);

    await expect(controller.createSession({ id: 's1', ownerId: 'o', modeId: 'nope' })).rejects.toThrow(
      'Mode not found: nope',
    );
  });

  it('restores the seeded mode and model after a restart without re-passing them', async () => {
    const controller1 = await buildController(storage);
    await controller1.createSession({
      id: 's1',
      ownerId: 'o',
      threadId: 'seed-thread',
      modeId: 'plan',
      modelId: 'cerebras/zai-glm-4.7',
    });

    const controller2 = await buildController(storage);
    const resumed = await controller2.createSession({ id: 's1', ownerId: 'o', threadId: 'seed-thread' });

    expect(resumed.mode.get()).toBe('plan');
    expect(resumed.model.get()).toBe('cerebras/zai-glm-4.7');
  });

  it('applies and persists both seeds on a resumed thread that carries no selection', async () => {
    const controller1 = await buildController(storage);
    const first = await controller1.createSession({ id: 's1', ownerId: 'o', threadId: 'legacy-thread' });
    await first.thread.deleteSetting({ key: 'currentModeId' });
    await first.thread.deleteSetting({ key: 'modeModelId_build' });
    await first.thread.deleteSetting({ key: 'currentModelId' });

    const controller2 = await buildController(storage);
    const seeded = await controller2.createSession({
      id: 's1',
      ownerId: 'o',
      threadId: 'legacy-thread',
      modeId: 'plan',
      modelId: 'cerebras/zai-glm-4.7',
    });
    expect(seeded.mode.get()).toBe('plan');
    expect(seeded.model.get()).toBe('cerebras/zai-glm-4.7');

    const controller3 = await buildController(storage);
    const resumed = await controller3.createSession({ id: 's1', ownerId: 'o', threadId: 'legacy-thread' });
    expect(resumed.mode.get()).toBe('plan');
    expect(resumed.model.get()).toBe('cerebras/zai-glm-4.7');
  });

  it("lets a resumed thread's persisted selection win over creation seeds", async () => {
    const controller1 = await buildController(storage);
    const first = await controller1.createSession({ id: 's1', ownerId: 'o', threadId: 'switched-thread' });
    await first.mode.switch({ modeId: 'plan' });

    const controller2 = await buildController(storage);
    const resumed = await controller2.createSession({
      id: 's1',
      ownerId: 'o',
      threadId: 'switched-thread',
      modeId: 'build',
    });

    expect(resumed.mode.get()).toBe('plan');
  });

  it('drops a model seed whose mode seed lost to the persisted mode, without persisting it', async () => {
    const controller1 = await buildControllerWithoutModeDefaults(storage);
    const first = await controller1.createSession({ id: 's1', ownerId: 'o', threadId: 'plan-thread' });
    await first.mode.switch({ modeId: 'plan' });

    const controller2 = await buildControllerWithoutModeDefaults(storage);
    const resumed = await controller2.createSession({
      id: 's1',
      ownerId: 'o',
      threadId: 'plan-thread',
      modeId: 'build',
      modelId: 'cerebras/zai-glm-4.7',
    });
    expect(resumed.mode.get()).toBe('plan');
    expect(await resumed.thread.getSetting({ key: 'modeModelId_plan' })).toBeUndefined();

    const controller3 = await buildControllerWithoutModeDefaults(storage);
    const restarted = await controller3.createSession({ id: 's1', ownerId: 'o', threadId: 'plan-thread' });
    expect(restarted.mode.get()).toBe('plan');
    expect(restarted.model.get()).toBe('');
  });

  it('lets the persisted selection win on the auto-resume path too', async () => {
    const controller1 = await buildController(storage);
    await controller1.createSession({ id: 's1', ownerId: 'o' });

    const controller2 = await buildController(storage);
    const resumed = await controller2.createSession({ id: 's1', ownerId: 'o', modeId: 'plan' });

    expect(resumed.mode.get()).toBe('build');
    expect(resumed.model.get()).toBe('openai/gpt-5.5');
  });

  it('returns an already live session unchanged, ignoring the seeds', async () => {
    const controller = await buildController(storage);
    const live = await controller.createSession({ id: 's1', ownerId: 'o' });
    expect(live.mode.get()).toBe('build');

    const again = await controller.createSession({ id: 's1', ownerId: 'o', modeId: 'plan' });

    expect(again).toBe(live);
    expect(again.mode.get()).toBe('build');

    await expect(controller.createSession({ id: 's1', ownerId: 'o', modeId: 'nope' })).rejects.toThrow(
      'Mode not found: nope',
    );
  });
});
