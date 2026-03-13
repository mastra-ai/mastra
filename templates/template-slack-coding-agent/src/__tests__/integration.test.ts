/**
 * Integration tests for the Slack Coding Agent.
 *
 * Level 1: Unit tests — verify Harness creation, event flow, streaming adapter
 *          (no external services needed)
 *
 * Level 2: E2B integration — real sandbox with E2B API key
 *          (skipped if E2B_API_KEY is not set)
 *
 * Run with: npx vitest run src/__tests__/integration.test.ts
 */

import { Agent } from '@mastra/core/agent';
import { Harness } from '@mastra/core/harness';
import type { HarnessEvent, HarnessEventListener, HarnessMode } from '@mastra/core/harness';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createTestAgent() {
  return new Agent({
    name: 'test-coding-agent',
    instructions: 'You are a test coding agent.',
    model: { provider: 'openai', name: 'gpt-4o', toolChoice: 'auto' },
  });
}

function createTestHarness(overrides?: Partial<Parameters<typeof Harness>[0]>) {
  const agent = createTestAgent();
  const modes: HarnessMode[] = [
    { id: 'build', name: 'Build', default: true, agent },
  ];
  return new Harness({
    id: 'test-slack-coding',
    modes,
    ...overrides,
  });
}

// ---------------------------------------------------------------------------
// Level 1: Unit Tests (no external services)
// ---------------------------------------------------------------------------

describe('Harness creation', () => {
  it('creates a Harness with minimal config', () => {
    const harness = createTestHarness();
    expect(harness).toBeDefined();
    expect(harness.id).toBe('test-slack-coding');
  });

  it('starts with isRunning = false', () => {
    const harness = createTestHarness();
    const ds = harness.getDisplayState();
    expect(ds.isRunning).toBe(false);
  });

  it('can init without storage or workspace', async () => {
    const harness = createTestHarness();
    await harness.init();
    // Should not throw
  });
});

describe('Harness event subscription', () => {
  it('receives events via subscribe', () => {
    const harness = createTestHarness();
    const events: HarnessEvent[] = [];
    const listener: HarnessEventListener = (event) => {
      events.push(event);
    };
    harness.subscribe(listener);

    // Emit an event via the private emit method
    (harness as any).emit({ type: 'agent_start' });

    // Should receive agent_start + display_state_changed
    expect(events.length).toBe(2);
    expect(events[0]!.type).toBe('agent_start');
    expect(events[1]!.type).toBe('display_state_changed');
  });

  it('updates display state on agent_start', () => {
    const harness = createTestHarness();
    harness.subscribe(() => {}); // activate listener

    (harness as any).emit({ type: 'agent_start' });

    const ds = harness.getDisplayState();
    expect(ds.isRunning).toBe(true);
  });

  it('resets isRunning on agent_end', () => {
    const harness = createTestHarness();
    harness.subscribe(() => {});

    (harness as any).emit({ type: 'agent_start' });
    expect(harness.getDisplayState().isRunning).toBe(true);

    (harness as any).emit({ type: 'agent_end', reason: 'complete' });
    expect(harness.getDisplayState().isRunning).toBe(false);
  });

  it('tracks tool activity through events', () => {
    const harness = createTestHarness();
    const events: HarnessEvent[] = [];
    harness.subscribe((e) => events.push(e));

    (harness as any).emit({
      type: 'tool_start',
      toolCallId: 'tc1',
      toolName: 'execute_command',
      args: { command: 'echo hello' },
    });

    const toolEvents = events.filter((e) => e.type === 'tool_start');
    expect(toolEvents.length).toBe(1);
    expect((toolEvents[0] as any).toolName).toBe('execute_command');
  });

  it('tracks task updates', () => {
    const harness = createTestHarness();
    const events: HarnessEvent[] = [];
    harness.subscribe((e) => events.push(e));

    (harness as any).emit({
      type: 'task_updated',
      tasks: [
        { content: 'Fix bug', status: 'in_progress', activeForm: 'Fixing bug' },
        { content: 'Write tests', status: 'pending', activeForm: 'Writing tests' },
      ],
    });

    const taskEvents = events.filter((e) => e.type === 'task_updated');
    expect(taskEvents.length).toBe(1);
    expect((taskEvents[0] as any).tasks).toHaveLength(2);
  });
});

describe('Streaming adapter event mapping', () => {
  // Import the streaming module dynamically so we can test its helpers
  // For now, test the event patterns that the adapter handles

  it('handles message_update with text content', () => {
    const harness = createTestHarness();
    const events: HarnessEvent[] = [];
    harness.subscribe((e) => events.push(e));

    (harness as any).emit({
      type: 'message_update',
      message: {
        id: 'msg1',
        role: 'assistant',
        content: [
          { type: 'text', text: 'Hello from the agent' },
        ],
        createdAt: new Date(),
      },
    });

    const msgEvents = events.filter((e) => e.type === 'message_update');
    expect(msgEvents.length).toBe(1);
    const msg = (msgEvents[0] as any).message;
    const textParts = msg.content
      .filter((c: any) => c.type === 'text')
      .map((c: any) => c.text);
    expect(textParts.join('')).toBe('Hello from the agent');
  });

  it('handles error events', () => {
    const harness = createTestHarness();
    const events: HarnessEvent[] = [];
    harness.subscribe((e) => events.push(e));

    const error = new Error('Something went wrong');
    (harness as any).emit({ type: 'error', error });

    const errorEvents = events.filter((e) => e.type === 'error');
    expect(errorEvents.length).toBe(1);
    expect((errorEvents[0] as any).error.message).toBe('Something went wrong');
  });

  it('handles subagent lifecycle events', () => {
    const harness = createTestHarness();
    const events: HarnessEvent[] = [];
    harness.subscribe((e) => events.push(e));

    (harness as any).emit({
      type: 'subagent_start',
      toolCallId: 'tc1',
      agentType: 'explore',
      task: 'Find all usages of X',
      modelId: 'anthropic/claude-sonnet-4-20250514',
    });

    (harness as any).emit({
      type: 'subagent_end',
      toolCallId: 'tc1',
      agentType: 'explore',
      result: 'Found 3 usages',
      isError: false,
      durationMs: 5000,
    });

    const startEvents = events.filter((e) => e.type === 'subagent_start');
    const endEvents = events.filter((e) => e.type === 'subagent_end');
    expect(startEvents.length).toBe(1);
    expect(endEvents.length).toBe(1);
    expect((endEvents[0] as any).durationMs).toBe(5000);
  });
});

// ---------------------------------------------------------------------------
// Level 2: E2B Integration Tests (requires E2B_API_KEY)
// ---------------------------------------------------------------------------

describe.skipIf(!process.env.E2B_API_KEY)('E2B Sandbox Integration', () => {
  // Dynamic imports since @mastra/e2b may not be installed in all environments
  let E2BSandbox: any;
  let Workspace: any;

  beforeEach(async () => {
    const e2bModule = await import('@mastra/e2b');
    E2BSandbox = e2bModule.E2BSandbox;
    const wsModule = await import('@mastra/core/workspace');
    Workspace = wsModule.Workspace;
  });

  it('creates and starts an E2B sandbox', async () => {
    const sandbox = new E2BSandbox({
      id: `test-slack-${Date.now()}`,
      timeout: 60_000,
    });

    try {
      await sandbox._start();
      const result = await sandbox.executeCommand('echo', ['Hello from E2B']);
      expect(result.exitCode).toBe(0);
      expect(result.stdout.trim()).toBe('Hello from E2B');
    } finally {
      await sandbox._destroy().catch(() => {});
    }
  }, 120_000);

  it('creates a sandbox with git installed via template', async () => {
    const sandbox = new E2BSandbox({
      id: `test-git-${Date.now()}`,
      template: (base: any) => base.aptInstall(['git']),
      timeout: 60_000,
    });

    try {
      await sandbox._start();
      const result = await sandbox.executeCommand('git', ['--version']);
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('git version');
    } finally {
      await sandbox._destroy().catch(() => {});
    }
  }, 180_000);

  it('creates a Workspace wrapping an E2B sandbox', async () => {
    const sandbox = new E2BSandbox({
      id: `test-ws-${Date.now()}`,
      timeout: 60_000,
    });

    const workspace = new Workspace({ sandbox });

    try {
      await workspace.init();
      // Workspace should have a running sandbox
      expect(sandbox.status).toBe('running');
    } finally {
      await sandbox._destroy().catch(() => {});
    }
  }, 120_000);

  it('creates a Harness with E2B workspace and initializes it', async () => {
    const sandbox = new E2BSandbox({
      id: `test-harness-${Date.now()}`,
      timeout: 60_000,
    });

    const workspace = new Workspace({ sandbox });
    const harness = createTestHarness({ workspace });

    const events: HarnessEvent[] = [];
    harness.subscribe((e) => events.push(e));

    try {
      await harness.init();

      // Should have received workspace events
      const wsEvents = events.filter(
        (e) => e.type === 'workspace_status_changed' || e.type === 'workspace_ready',
      );
      expect(wsEvents.length).toBeGreaterThan(0);
    } finally {
      await sandbox._destroy().catch(() => {});
    }
  }, 120_000);
});
