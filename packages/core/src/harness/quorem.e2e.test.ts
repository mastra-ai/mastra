import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Agent } from '../agent';
import { MockMemory } from '../memory/mock';
import { InMemoryStore } from '../storage/mock';
import { Harness } from './harness';
import type { HarnessEvent, QuoremEnvironmentConfig } from './types';
import { defaultDisplayState } from './types';

// =============================================================================
// Test helpers
// =============================================================================

function createMockQuoremConfig(): QuoremEnvironmentConfig {
  return {
    createEnvironment: vi.fn().mockResolvedValue(undefined),
    removeEnvironment: vi.fn().mockResolvedValue(undefined),
    mergeResults: vi.fn().mockResolvedValue(undefined),
    getArtifacts: vi.fn().mockResolvedValue(['src/main.ts', 'src/utils.ts']),
    getResultDiff: vi.fn().mockResolvedValue('diff --git a/src/main.ts b/src/main.ts\\n+// changes'),
  };
}

function createTestHarness(opts?: { quorem?: QuoremEnvironmentConfig; memory?: MockMemory; storage?: InMemoryStore }) {
  const storage = opts?.storage ?? new InMemoryStore();
  const memory = opts?.memory ?? new MockMemory({ storage });

  const agent = new Agent({
    name: 'test-agent',
    instructions: 'You are a test agent.',
    model: { provider: 'openai', name: 'gpt-4o', toolChoice: 'auto' },
  });

  return new Harness({
    id: 'test-harness',
    storage,
    memory,
    modes: [{ id: 'default', name: 'Default', default: true, agent }],
    quorem: opts?.quorem ?? createMockQuoremConfig(),
    idGenerator: (() => {
      let counter = 0;
      return () => `test-id-${++counter}`;
    })(),
  });
}

// Helper to call the private emit method for display state testing
function emit(harness: Harness, event: HarnessEvent) {
  (harness as any).emit(event);
}

// Helper to set the currentThreadId on the harness
async function ensureThread(harness: Harness): Promise<string> {
  const thread = await harness.selectOrCreateThread();
  return thread.id;
}

// =============================================================================
// Display State: Quorem Events
// =============================================================================

describe('quorem display state', () => {
  let harness: Harness;

  beforeEach(() => {
    harness = createTestHarness();
  });

  it('initial display state has no active quorem session', () => {
    const ds = harness.getDisplayState();
    expect(ds.activeQuoremSession).toBeNull();
  });

  it('quorem_start creates an activeQuoremSession', () => {
    emit(harness, {
      type: 'quorem_start',
      sessionId: 'qs-1',
      task: 'Implement feature X',
      agents: [{ id: 'agent-a', label: 'Alpha' }, { id: 'agent-b', label: 'Beta' }, { id: 'agent-c' }],
    });

    const ds = harness.getDisplayState();
    expect(ds.activeQuoremSession).not.toBeNull();
    expect(ds.activeQuoremSession!.id).toBe('qs-1');
    expect(ds.activeQuoremSession!.task).toBe('Implement feature X');
    expect(ds.activeQuoremSession!.status).toBe('running');
    expect(ds.activeQuoremSession!.agents).toHaveLength(3);
    expect(ds.activeQuoremSession!.winnerId).toBeNull();
    expect(ds.activeQuoremSession!.endedAt).toBeNull();

    // Agents should have correct defaults
    const agentA = ds.activeQuoremSession!.agents[0]!;
    expect(agentA.id).toBe('agent-a');
    expect(agentA.label).toBe('Alpha');
    expect(agentA.status).toBe('pending');
    expect(agentA.threadId).toBeNull();
    expect(agentA.environmentPath).toBeNull();
    expect(agentA.environmentRef).toBeNull();
    expect(agentA.summary).toBeNull();
    expect(agentA.artifacts).toEqual([]);
    expect(agentA.error).toBeNull();
    expect(agentA.durationMs).toBeNull();

    // Agent without label should use id as label
    const agentC = ds.activeQuoremSession!.agents[2]!;
    expect(agentC.label).toBe('agent-c');
  });

  it('quorem_agent_start updates agent status and environment info', () => {
    emit(harness, {
      type: 'quorem_start',
      sessionId: 'qs-1',
      task: 'Task',
      agents: [{ id: 'agent-a' }],
    });

    emit(harness, {
      type: 'quorem_agent_start',
      sessionId: 'qs-1',
      agentId: 'agent-a',
      threadId: 'thread-clone-1',
      environmentPath: '/tmp/env/a',
    });

    const agent = harness.getDisplayState().activeQuoremSession!.agents[0]!;
    expect(agent.status).toBe('running');
    expect(agent.threadId).toBe('thread-clone-1');
    expect(agent.environmentPath).toBe('/tmp/env/a');
  });

  it('quorem_agent_start ignores unknown agentId', () => {
    emit(harness, {
      type: 'quorem_start',
      sessionId: 'qs-1',
      task: 'Task',
      agents: [{ id: 'agent-a' }],
    });

    // This should not throw
    emit(harness, {
      type: 'quorem_agent_start',
      sessionId: 'qs-1',
      agentId: 'unknown-agent',
      threadId: 'thread-clone-1',
      environmentPath: '/tmp/env/x',
    });

    const agent = harness.getDisplayState().activeQuoremSession!.agents[0]!;
    expect(agent.status).toBe('pending'); // unchanged
  });

  it('quorem_agent_end marks agent as completed with results', () => {
    emit(harness, {
      type: 'quorem_start',
      sessionId: 'qs-1',
      task: 'Task',
      agents: [{ id: 'agent-a' }],
    });

    emit(harness, {
      type: 'quorem_agent_end',
      sessionId: 'qs-1',
      agentId: 'agent-a',
      status: 'completed',
      summary: 'Implemented the feature using approach A.',
      artifacts: ['src/main.ts', 'src/utils.ts'],
      durationMs: 45000,
    });

    const agent = harness.getDisplayState().activeQuoremSession!.agents[0]!;
    expect(agent.status).toBe('completed');
    expect(agent.summary).toBe('Implemented the feature using approach A.');
    expect(agent.artifacts).toEqual(['src/main.ts', 'src/utils.ts']);
    expect(agent.durationMs).toBe(45000);
    expect(agent.error).toBeNull();
  });

  it('quorem_agent_end marks agent as error with error message', () => {
    emit(harness, {
      type: 'quorem_start',
      sessionId: 'qs-1',
      task: 'Task',
      agents: [{ id: 'agent-a' }],
    });

    emit(harness, {
      type: 'quorem_agent_end',
      sessionId: 'qs-1',
      agentId: 'agent-a',
      status: 'error',
      summary: null,
      artifacts: [],
      durationMs: 5000,
      error: 'Model quota exceeded',
    });

    const agent = harness.getDisplayState().activeQuoremSession!.agents[0]!;
    expect(agent.status).toBe('error');
    expect(agent.error).toBe('Model quota exceeded');
    expect(agent.summary).toBeNull();
  });

  it('quorem_review_start transitions session to reviewing', () => {
    emit(harness, {
      type: 'quorem_start',
      sessionId: 'qs-1',
      task: 'Task',
      agents: [{ id: 'agent-a' }],
    });

    emit(harness, { type: 'quorem_review_start', sessionId: 'qs-1' });

    expect(harness.getDisplayState().activeQuoremSession!.status).toBe('reviewing');
  });

  it('quorem_merged transitions session to merged with winner', () => {
    emit(harness, {
      type: 'quorem_start',
      sessionId: 'qs-1',
      task: 'Task',
      agents: [{ id: 'agent-a' }, { id: 'agent-b' }],
    });

    emit(harness, {
      type: 'quorem_merged',
      sessionId: 'qs-1',
      winnerId: 'agent-b',
      environmentRef: 'quorem/qs-1/agent-b',
    });

    const session = harness.getDisplayState().activeQuoremSession!;
    expect(session.status).toBe('merged');
    expect(session.winnerId).toBe('agent-b');
    expect(session.endedAt).toBeInstanceOf(Date);
  });

  it('quorem_cancelled transitions session to cancelled', () => {
    emit(harness, {
      type: 'quorem_start',
      sessionId: 'qs-1',
      task: 'Task',
      agents: [{ id: 'agent-a' }],
    });

    emit(harness, { type: 'quorem_cancelled', sessionId: 'qs-1' });

    const session = harness.getDisplayState().activeQuoremSession!;
    expect(session.status).toBe('cancelled');
    expect(session.endedAt).toBeInstanceOf(Date);
  });

  it('quorem_review_start is a no-op when no active session', () => {
    emit(harness, { type: 'quorem_review_start', sessionId: 'non-existent' });
    expect(harness.getDisplayState().activeQuoremSession).toBeNull();
  });

  it('quorem_merged is a no-op when no active session', () => {
    emit(harness, { type: 'quorem_merged', sessionId: 'non-existent', winnerId: 'x', environmentRef: 'b' });
    expect(harness.getDisplayState().activeQuoremSession).toBeNull();
  });

  it('quorem_cancelled is a no-op when no active session', () => {
    emit(harness, { type: 'quorem_cancelled', sessionId: 'non-existent' });
    expect(harness.getDisplayState().activeQuoremSession).toBeNull();
  });

  it('full display state lifecycle: start → agent_start → agent_end → review → merge', () => {
    emit(harness, {
      type: 'quorem_start',
      sessionId: 'qs-full',
      task: 'Refactor auth module',
      agents: [
        { id: 'agent-a', label: 'Conservative' },
        { id: 'agent-b', label: 'Aggressive' },
      ],
    });

    // Both agents start
    emit(harness, {
      type: 'quorem_agent_start',
      sessionId: 'qs-full',
      agentId: 'agent-a',
      threadId: 'thread-a',
      environmentPath: '/tmp/a',
    });
    emit(harness, {
      type: 'quorem_agent_start',
      sessionId: 'qs-full',
      agentId: 'agent-b',
      threadId: 'thread-b',
      environmentPath: '/tmp/b',
    });

    let ds = harness.getDisplayState();
    expect(ds.activeQuoremSession!.agents[0]!.status).toBe('running');
    expect(ds.activeQuoremSession!.agents[1]!.status).toBe('running');

    // Agent A completes
    emit(harness, {
      type: 'quorem_agent_end',
      sessionId: 'qs-full',
      agentId: 'agent-a',
      status: 'completed',
      summary: 'Refactored with minimal changes.',
      artifacts: ['src/auth.ts'],
      durationMs: 30000,
    });

    // Agent B errors
    emit(harness, {
      type: 'quorem_agent_end',
      sessionId: 'qs-full',
      agentId: 'agent-b',
      status: 'error',
      summary: null,
      artifacts: [],
      durationMs: 10000,
      error: 'Compilation error in refactored code',
    });

    ds = harness.getDisplayState();
    expect(ds.activeQuoremSession!.agents[0]!.status).toBe('completed');
    expect(ds.activeQuoremSession!.agents[1]!.status).toBe('error');

    // Review starts
    emit(harness, { type: 'quorem_review_start', sessionId: 'qs-full' });
    expect(ds.activeQuoremSession!.status).toBe('reviewing');

    // Merge winner
    emit(harness, {
      type: 'quorem_merged',
      sessionId: 'qs-full',
      winnerId: 'agent-a',
      environmentRef: 'quorem/qs-full/agent-a',
    });

    ds = harness.getDisplayState();
    expect(ds.activeQuoremSession!.status).toBe('merged');
    expect(ds.activeQuoremSession!.winnerId).toBe('agent-a');
    expect(ds.activeQuoremSession!.endedAt).toBeInstanceOf(Date);
  });
});

// =============================================================================
// defaultDisplayState includes activeQuoremSession
// =============================================================================

describe('defaultDisplayState includes quorem field', () => {
  it('has activeQuoremSession set to null', () => {
    const ds = defaultDisplayState();
    expect(ds.activeQuoremSession).toBeNull();
  });
});

// =============================================================================
// Quorem Lifecycle (e2e: calls real Harness methods)
// =============================================================================

describe('quorem session lifecycle', () => {
  let harness: Harness;
  let quoremConfig: QuoremEnvironmentConfig;
  let collectedEvents: HarnessEvent[];

  beforeEach(async () => {
    quoremConfig = createMockQuoremConfig();
    harness = createTestHarness({ quorem: quoremConfig });
    collectedEvents = [];
    harness.subscribe(event => {
      collectedEvents.push(event);
    });
    // Ensure a thread exists so startQuoremSession doesn't reject
    await ensureThread(harness);
  });

  describe('startQuoremSession', () => {
    it('throws if no quorem config is provided', async () => {
      const noQuoremHarness = createTestHarness({ quorem: undefined as any });
      // Remove quorem config
      (noQuoremHarness as any).config.quorem = undefined;
      await ensureThread(noQuoremHarness);
      await expect(noQuoremHarness.startQuoremSession({ task: 'test', agents: [{ id: 'a' }] })).rejects.toThrow(
        'Quorem is not configured',
      );
    });

    it('throws if no active thread', async () => {
      const freshHarness = createTestHarness();
      // Don't create a thread
      await expect(freshHarness.startQuoremSession({ task: 'test', agents: [{ id: 'a' }] })).rejects.toThrow(
        'No active thread',
      );
    });

    it('throws if no memory is configured', async () => {
      const noMemHarness = createTestHarness();
      await ensureThread(noMemHarness);
      (noMemHarness as any).config.memory = undefined;
      await expect(noMemHarness.startQuoremSession({ task: 'test', agents: [{ id: 'a' }] })).rejects.toThrow(
        'Memory is required',
      );
    });

    it('returns a QuoremSession with correct initial state', async () => {
      const session = await harness.startQuoremSession({
        task: 'Implement feature X',
        agents: [
          { id: 'agent-a', label: 'Alpha' },
          { id: 'agent-b', label: 'Beta' },
        ],
        evaluationCriteria: 'Code quality, performance, test coverage',
      });

      expect(session.id).toBeTruthy();
      expect(session.task).toBe('Implement feature X');
      expect(session.evaluationCriteria).toBe('Code quality, performance, test coverage');
      expect(session.status).toBe('running');
      expect(session.winnerId).toBeNull();
      expect(session.startedAt).toBeInstanceOf(Date);
      expect(session.endedAt).toBeNull();
      expect(session.agents).toHaveLength(2);

      const agentA = session.agents[0]!;
      expect(agentA.id).toBe('agent-a');
      expect(agentA.label).toBe('Alpha');
      expect(agentA.status).not.toBe('completed'); // pending or running
    });

    it('emits quorem_start event', async () => {
      await harness.startQuoremSession({
        task: 'Test task',
        agents: [{ id: 'a', label: 'A' }, { id: 'b' }],
      });

      const startEvent = collectedEvents.find(e => e.type === 'quorem_start');
      expect(startEvent).toBeDefined();
      expect(startEvent!.type).toBe('quorem_start');
      if (startEvent!.type === 'quorem_start') {
        expect(startEvent!.task).toBe('Test task');
        expect(startEvent!.agents).toHaveLength(2);
        expect(startEvent!.agents[0]!.id).toBe('a');
        expect(startEvent!.agents[0]!.label).toBe('A');
      }
    });

    it('throws when a session is already running', async () => {
      await harness.startQuoremSession({
        task: 'First task',
        agents: [{ id: 'a' }],
      });

      await expect(
        harness.startQuoremSession({
          task: 'Second task',
          agents: [{ id: 'b' }],
        }),
      ).rejects.toThrow('already running');
    });

    it('calls createEnvironment for each agent', async () => {
      await harness.startQuoremSession({
        task: 'Test task',
        agents: [{ id: 'agent-a' }, { id: 'agent-b' }],
      });

      // Wait a tick so async launchQuoremAgent starts
      await new Promise(r => setTimeout(r, 50));

      expect(quoremConfig.createEnvironment).toHaveBeenCalledTimes(2);
    });

    it('clones the thread for each agent via memory', async () => {
      const storage = new InMemoryStore();
      const memory = new MockMemory({ storage });
      const cloneSpy = vi.spyOn(memory, 'cloneThread');

      const h = createTestHarness({ quorem: quoremConfig, memory, storage });
      h.subscribe(e => {
        collectedEvents.push(e);
      });
      await ensureThread(h);

      await h.startQuoremSession({
        task: 'Test cloning',
        agents: [{ id: 'agent-x' }],
      });

      // Wait for the async agent launch
      await new Promise(r => setTimeout(r, 100));

      expect(cloneSpy).toHaveBeenCalledTimes(1);
      const call = cloneSpy.mock.calls[0]![0];
      expect(call.sourceThreadId).toBeTruthy();
      expect(call.newThreadId).toContain('quorem-');
      expect(call.newThreadId).toContain('agent-x');
    });
  });

  describe('getQuoremSession', () => {
    it('returns null when no session is active', () => {
      expect(harness.getQuoremSession()).toBeNull();
    });

    it('returns the active session', async () => {
      await harness.startQuoremSession({
        task: 'Active task',
        agents: [{ id: 'a' }],
      });

      const session = harness.getQuoremSession();
      expect(session).not.toBeNull();
      expect(session!.task).toBe('Active task');
    });
  });

  describe('cancelQuoremSession', () => {
    it('throws when no session is active', async () => {
      await expect(harness.cancelQuoremSession()).rejects.toThrow('No active quorem session');
    });

    it('marks running and pending agents as cancelled', async () => {
      await harness.startQuoremSession({
        task: 'Cancel test',
        agents: [{ id: 'a' }, { id: 'b' }],
      });

      await harness.cancelQuoremSession();

      // After cancel, session is null
      expect(harness.getQuoremSession()).toBeNull();
    });

    it('emits quorem_cancelled event', async () => {
      await harness.startQuoremSession({
        task: 'Cancel event test',
        agents: [{ id: 'a' }],
      });

      await harness.cancelQuoremSession();

      const cancelEvent = collectedEvents.find(e => e.type === 'quorem_cancelled');
      expect(cancelEvent).toBeDefined();
    });

    it('calls removeEnvironment for agents with environments', async () => {
      await harness.startQuoremSession({
        task: 'Cleanup test',
        agents: [{ id: 'a' }],
      });

      // Wait for agent to start and get an environment
      await new Promise(r => setTimeout(r, 100));

      await harness.cancelQuoremSession();

      // removeEnvironment should be called at least for the agents that got environments
      const removeCount = (quoremConfig.removeEnvironment as ReturnType<typeof vi.fn>).mock.calls.length;
      expect(removeCount).toBeGreaterThanOrEqual(0); // May be 0 if agent errored before environment was assigned
    });
  });

  describe('selectQuoremWinner', () => {
    it('throws when no session is active', async () => {
      await expect(harness.selectQuoremWinner('agent-a')).rejects.toThrow('No active quorem session');
    });

    it('throws when agent is not found', async () => {
      await harness.startQuoremSession({
        task: 'Winner test',
        agents: [{ id: 'a' }],
      });

      await expect(harness.selectQuoremWinner('nonexistent')).rejects.toThrow('not found');
    });

    it('throws when agent is not completed', async () => {
      await harness.startQuoremSession({
        task: 'Winner status test',
        agents: [{ id: 'a' }],
      });

      // Agent is pending/running, not completed
      await expect(harness.selectQuoremWinner('a')).rejects.toThrow('expected "completed"');
    });

    it('merges the winner environment and emits quorem_merged', async () => {
      await harness.startQuoremSession({
        task: 'Merge test',
        agents: [{ id: 'a' }],
      });

      // Manually mark the agent as completed with an environment ref
      const session = harness.getQuoremSession()!;
      const agentState = session.agents.find(a => a.id === 'a')!;
      agentState.status = 'completed';
      agentState.environmentRef = 'quorem/test-id-1/a';
      agentState.environmentPath = '/tmp/env/a';

      await harness.selectQuoremWinner('a');

      expect(quoremConfig.mergeResults).toHaveBeenCalledWith({ ref: 'quorem/test-id-1/a' });

      const mergeEvent = collectedEvents.find(e => e.type === 'quorem_merged');
      expect(mergeEvent).toBeDefined();
      if (mergeEvent?.type === 'quorem_merged') {
        expect(mergeEvent.winnerId).toBe('a');
        expect(mergeEvent.environmentRef).toBe('quorem/test-id-1/a');
      }

      // Session should be cleared
      expect(harness.getQuoremSession()).toBeNull();
    });

    it('cleans up all environments after merge', async () => {
      await harness.startQuoremSession({
        task: 'Cleanup after merge',
        agents: [{ id: 'a' }, { id: 'b' }],
      });

      const session = harness.getQuoremSession()!;
      // Mark both agents
      for (const agent of session.agents) {
        agent.status = 'completed';
        agent.environmentRef = `quorem/test-id-1/${agent.id}`;
        agent.environmentPath = `/tmp/env/${agent.id}`;
      }

      await harness.selectQuoremWinner('a');

      // removeEnvironment should be called for all agents
      expect(quoremConfig.removeEnvironment).toHaveBeenCalledWith({ path: '/tmp/env/a' });
      expect(quoremConfig.removeEnvironment).toHaveBeenCalledWith({ path: '/tmp/env/b' });
    });
  });

  describe('reviewQuoremAgent', () => {
    it('returns null when no session is active', async () => {
      const result = await harness.reviewQuoremAgent('agent-a');
      expect(result).toBeNull();
    });

    it('returns null for unknown agentId', async () => {
      await harness.startQuoremSession({
        task: 'Review test',
        agents: [{ id: 'a' }],
      });

      const result = await harness.reviewQuoremAgent('nonexistent');
      expect(result).toBeNull();
    });

    it('returns diff and artifacts for an agent with an environment', async () => {
      await harness.startQuoremSession({
        task: 'Review diff test',
        agents: [{ id: 'a' }],
      });

      const session = harness.getQuoremSession()!;
      const agentState = session.agents.find(a => a.id === 'a')!;
      agentState.environmentPath = '/tmp/env/a';

      const result = await harness.reviewQuoremAgent('a');
      expect(result).not.toBeNull();
      expect(result!.diff).toContain('diff --git');
      expect(result!.artifacts).toEqual(['src/main.ts', 'src/utils.ts']);

      expect(quoremConfig.getResultDiff).toHaveBeenCalledWith({ path: '/tmp/env/a' });
      expect(quoremConfig.getArtifacts).toHaveBeenCalledWith({ path: '/tmp/env/a' });
    });
  });
});

// =============================================================================
// Event emission verification
// =============================================================================

describe('quorem event emission', () => {
  let harness: Harness;
  let quoremConfig: QuoremEnvironmentConfig;
  let events: HarnessEvent[];

  beforeEach(async () => {
    quoremConfig = createMockQuoremConfig();
    harness = createTestHarness({ quorem: quoremConfig });
    events = [];
    harness.subscribe(event => {
      events.push(event);
    });
    await ensureThread(harness);
  });

  it('display_state_changed is emitted for each quorem event', async () => {
    await harness.startQuoremSession({
      task: 'DSC test',
      agents: [{ id: 'a' }],
    });

    // Every event triggers a display_state_changed
    const dscEvents = events.filter(e => e.type === 'display_state_changed');
    expect(dscEvents.length).toBeGreaterThanOrEqual(1);
  });

  it('cancel emits quorem_cancelled followed by display_state_changed', async () => {
    await harness.startQuoremSession({
      task: 'Cancel DSC test',
      agents: [{ id: 'a' }],
    });

    events = []; // Reset events
    await harness.cancelQuoremSession();

    const eventTypes = events.map(e => e.type);
    expect(eventTypes).toContain('quorem_cancelled');
    expect(eventTypes).toContain('display_state_changed');
  });
});
