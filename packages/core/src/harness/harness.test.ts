import { describe, it, expect, beforeEach, vi } from 'vitest';
import { z } from 'zod';

import { InMemoryStore } from '../storage/mock';
import { Harness } from './harness';
import type { HarnessEvent, HarnessMode } from './types';

// =============================================================================
// Test Helpers
// =============================================================================

const testSchema = z.object({
  currentModelId: z.string().default('test-model'),
  counter: z.number().default(0),
});

type TestState = typeof testSchema;

/** Minimal mock agent — we only need the shape, not real LLM calls. */
function mockAgent(name = 'test-agent') {
  return { id: name, name } as any;
}

function createTestModes(): HarnessMode<TestState>[] {
  return [
    {
      id: 'plan',
      name: 'Plan',
      default: true,
      agent: mockAgent('plan-agent'),
    },
    {
      id: 'build',
      name: 'Build',
      agent: state => mockAgent(`build-${state.currentModelId}`),
    },
  ];
}

function createHarness(overrides?: Partial<Parameters<typeof Harness<TestState>>[0]>) {
  const storage = new InMemoryStore();
  return new Harness<TestState>({
    id: 'test-harness',
    resourceId: 'test-resource',
    storage,
    stateSchema: testSchema,
    modes: createTestModes(),
    ...overrides,
  } as any);
}

// =============================================================================
// Constructor
// =============================================================================

describe('Harness', () => {
  describe('constructor', () => {
    it('sets id and resource from config', () => {
      const h = createHarness();
      expect(h.id).toBe('test-harness');
      expect(h.getResourceId()).toBe('test-resource');
    });

    it('initializes state from schema defaults', () => {
      const h = createHarness();
      expect(h.state.get().currentModelId).toBe('test-model');
      expect(h.state.get().counter).toBe(0);
    });

    it('merges initialState over schema defaults', () => {
      const h = createHarness({
        initialState: { counter: 42 },
      });
      expect(h.state.get().counter).toBe(42);
      expect(h.state.get().currentModelId).toBe('test-model');
    });

    it('selects the default mode', () => {
      const h = createHarness();
      expect(h.modes.currentId()).toBe('plan');
    });

    it('falls back to first mode if none marked default', () => {
      const h = createHarness({
        modes: [
          { id: 'alpha', agent: mockAgent() },
          { id: 'beta', agent: mockAgent() },
        ],
      });
      expect(h.modes.currentId()).toBe('alpha');
    });

    it('throws if no modes provided', () => {
      expect(() => createHarness({ modes: [] })).toThrow('Harness requires at least one agent mode');
    });
  });

  // =========================================================================
  // Lifecycle
  // =========================================================================

  describe('init / destroy', () => {
    it('initializes storage', async () => {
      const storage = new InMemoryStore();
      const initSpy = vi.spyOn(storage, 'init');
      const h = new Harness<TestState>({
        id: 'test',
        resourceId: 'r',
        storage,
        stateSchema: testSchema,
        modes: createTestModes(),
      } as any);

      await h.init();
      expect(initSpy).toHaveBeenCalled();
    });

    it('destroy aborts running operations', async () => {
      const h = createHarness();
      await h.init();
      await h.destroy();
      expect(h.isRunning()).toBe(false);
    });
  });

  // =========================================================================
  // Event System
  // =========================================================================

  describe('event system', () => {
    it('delivers events to subscribers', async () => {
      const h = createHarness();
      const events: HarnessEvent[] = [];
      h.subscribe(e => {
        events.push(e);
      });

      await h.state.set({ counter: 1 });

      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('state_changed');
    });

    it('supports multiple subscribers', async () => {
      const h = createHarness();
      const a: HarnessEvent[] = [];
      const b: HarnessEvent[] = [];
      h.subscribe(e => {
        a.push(e);
      });
      h.subscribe(e => {
        b.push(e);
      });

      await h.state.set({ counter: 1 });

      expect(a).toHaveLength(1);
      expect(b).toHaveLength(1);
    });

    it('unsubscribe stops delivery', async () => {
      const h = createHarness();
      const events: HarnessEvent[] = [];
      const unsub = h.subscribe(e => {
        events.push(e);
      });

      await h.state.set({ counter: 1 });
      expect(events).toHaveLength(1);

      unsub();
      await h.state.set({ counter: 2 });
      expect(events).toHaveLength(1); // no new events
    });

    it('handles listener errors without breaking other listeners', async () => {
      const h = createHarness();
      const events: HarnessEvent[] = [];
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      h.subscribe(() => {
        throw new Error('boom');
      });
      h.subscribe(e => {
        events.push(e);
      });

      await h.state.set({ counter: 1 });

      expect(events).toHaveLength(1);
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  // =========================================================================
  // State Management
  // =========================================================================

  describe('state management', () => {
    it('state.get returns a read-only snapshot', async () => {
      const h = createHarness();
      const s1 = h.state.get();
      await h.state.set({ counter: 99 });
      const s2 = h.state.get();

      // s1 should not be mutated
      expect(s1.counter).toBe(0);
      expect(s2.counter).toBe(99);
    });

    it('state.set validates against schema', async () => {
      const h = createHarness();
      await expect(h.state.set({ counter: 'not a number' as any })).rejects.toThrow('Invalid state update');
    });

    it('state.set emits state_changed with changedKeys', async () => {
      const h = createHarness();
      const events: HarnessEvent[] = [];
      h.subscribe(e => {
        events.push(e);
      });

      await h.state.set({ counter: 5, currentModelId: 'new-model' });

      const event = events[0];
      expect(event.type).toBe('state_changed');
      if (event.type === 'state_changed') {
        expect(event.changedKeys).toContain('counter');
        expect(event.changedKeys).toContain('currentModelId');
      }
    });
  });

  // =========================================================================
  // Mode Management
  // =========================================================================

  describe('mode management', () => {
    it('modes.list returns all configured modes', () => {
      const h = createHarness();
      expect(h.modes.list()).toHaveLength(2);
      expect(h.modes.list().map(m => m.id)).toEqual(['plan', 'build']);
    });

    it('modes.current returns the active mode config', () => {
      const h = createHarness();
      const mode = h.modes.current();
      expect(mode.id).toBe('plan');
      expect(mode.name).toBe('Plan');
    });

    it('modes.switch changes the current mode and emits event', async () => {
      const h = createHarness();
      await h.init();

      const events: HarnessEvent[] = [];
      h.subscribe(e => {
        events.push(e);
      });

      await h.modes.switch('build');

      expect(h.modes.currentId()).toBe('build');
      const modeEvent = events.find(e => e.type === 'mode_changed');
      expect(modeEvent).toBeDefined();
      if (modeEvent?.type === 'mode_changed') {
        expect(modeEvent.modeId).toBe('build');
        expect(modeEvent.previousModeId).toBe('plan');
      }
    });

    it('modes.switch throws for unknown mode', async () => {
      const h = createHarness();
      await expect(h.modes.switch('unknown')).rejects.toThrow('Mode not found: unknown');
    });
  });

  // =========================================================================
  // Thread Management
  // =========================================================================

  describe('thread management', () => {
    let h: Harness<TestState>;

    beforeEach(async () => {
      h = createHarness();
      await h.init();
    });

    it('threads.create creates and selects a new thread', async () => {
      const thread = await h.threads.create('Test Thread');

      expect(thread.id).toBeDefined();
      expect(thread.title).toBe('Test Thread');
      expect(thread.resourceId).toBe('test-resource');
      expect(h.threads.current()).toBe(thread.id);
    });

    it('threads.create emits thread_created event', async () => {
      const events: HarnessEvent[] = [];
      h.subscribe(e => {
        events.push(e);
      });

      await h.threads.create();

      const event = events.find(e => e.type === 'thread_created');
      expect(event).toBeDefined();
    });

    it('threads.list returns threads for current resource', async () => {
      await h.threads.create('Thread 1');
      await h.threads.create('Thread 2');

      const threads = await h.threads.list();
      expect(threads).toHaveLength(2);
    });

    it('threads.switch changes current thread and emits event', async () => {
      const t1 = await h.threads.create('First');
      const t2 = await h.threads.create('Second');

      const events: HarnessEvent[] = [];
      h.subscribe(e => {
        events.push(e);
      });

      await h.threads.switch(t1.id);

      expect(h.threads.current()).toBe(t1.id);
      const event = events.find(e => e.type === 'thread_changed');
      expect(event).toBeDefined();
      if (event?.type === 'thread_changed') {
        expect(event.threadId).toBe(t1.id);
        expect(event.previousThreadId).toBe(t2.id);
      }
    });

    it('threads.switch throws for non-existent thread', async () => {
      await expect(h.threads.switch('fake-id')).rejects.toThrow('Thread not found');
    });

    it('threads.selectOrCreate creates if none exist', async () => {
      const thread = await h.threads.selectOrCreate();
      expect(thread.id).toBeDefined();
      expect(h.threads.current()).toBe(thread.id);
    });

    it('threads.selectOrCreate selects most recent if threads exist', async () => {
      const _t1 = await h.threads.create('Older');
      // Small delay to ensure different updatedAt timestamps
      await new Promise(r => setTimeout(r, 5));
      const t2 = await h.threads.create('Newer');

      // Reset the thread to simulate fresh start
      (h as any)._currentThreadId = null;

      const selected = await h.threads.selectOrCreate();
      expect(selected.id).toBe(t2.id);
    });

    it('threads.rename updates the thread title', async () => {
      await h.threads.create('Original');
      await h.threads.rename('Renamed');

      const threads = await h.threads.list();
      expect(threads[0].title).toBe('Renamed');
    });

    it('setResourceId clears current thread', () => {
      h.setResourceId('new-resource');
      expect(h.getResourceId()).toBe('new-resource');
      expect(h.threads.current()).toBeNull();
    });
  });

  // =========================================================================
  // Thread Metadata Persistence
  // =========================================================================

  describe('thread metadata', () => {
    let h: Harness<TestState>;

    beforeEach(async () => {
      h = createHarness();
      await h.init();
    });

    it('threads.persistSetting stores metadata on thread', async () => {
      await h.threads.create();
      await h.threads.persistSetting('myKey', 'myValue');

      const threads = await h.threads.list();
      expect(threads[0].metadata?.myKey).toBe('myValue');
    });

    it('modes.switch persists mode to thread metadata', async () => {
      await h.threads.create();
      await h.modes.switch('build');

      const threads = await h.threads.list();
      expect(threads[0].metadata?.currentModeId).toBe('build');
    });

    it('loadThreadMetadata restores mode on threads.switch', async () => {
      const t1 = await h.threads.create('T1');
      await h.modes.switch('build');

      const _t2 = await h.threads.create('T2');
      expect(h.modes.currentId()).toBe('build');

      await h.modes.switch('plan');

      // Switch to t1 — should restore build mode
      await h.threads.switch(t1.id);
      expect(h.modes.currentId()).toBe('build');
    });

    it('onThreadLoad hook is called when loading thread', async () => {
      const onThreadLoad = vi.fn().mockReturnValue({ counter: 42 });
      const h2 = createHarness({
        hooks: { onThreadLoad },
      });
      await h2.init();

      const thread = await h2.threads.create();
      await h2.threads.persistSetting('customData', 'hello');

      // Create a second thread and switch back
      await h2.threads.create();
      await h2.threads.switch(thread.id);

      expect(onThreadLoad).toHaveBeenCalled();
      expect(h2.state.get().counter).toBe(42);
    });

    it('onThreadCreate hook injects metadata', async () => {
      const h2 = createHarness({
        hooks: {
          onThreadCreate: () => ({ customField: 'injected' }),
        },
      });
      await h2.init();

      await h2.threads.create();
      const threads = await h2.threads.list();
      expect(threads[0].metadata?.customField).toBe('injected');
    });
  });

  // =========================================================================
  // Token Usage
  // =========================================================================

  describe('token usage', () => {
    it('starts at zero', () => {
      const h = createHarness();
      expect(h.usage.get()).toEqual({
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
      });
    });

    it('resets on new thread', async () => {
      const h = createHarness();
      await h.init();
      // Manually set usage
      (h as any)._tokenUsage = { promptTokens: 100, completionTokens: 50, totalTokens: 150 };

      await h.threads.create();
      expect(h.usage.get().totalTokens).toBe(0);
    });
  });

  // =========================================================================
  // Questions & Plan Approvals
  // =========================================================================

  describe('questions and plan approvals', () => {
    it('registerQuestion + respondToQuestion resolves', async () => {
      const h = createHarness();
      let answer: string | undefined;

      h.registerQuestion('q1', a => {
        answer = a;
      });
      h.respondToQuestion('q1', 'yes');

      expect(answer).toBe('yes');
    });

    it('respondToQuestion for unknown ID is a no-op', () => {
      const h = createHarness();
      h.respondToQuestion('unknown', 'answer');
    });

    it('registerPlanApproval + respondToPlanApproval resolves', async () => {
      const h = createHarness();
      let result: any;

      h.registerPlanApproval('p1', r => {
        result = r;
      });
      await h.respondToPlanApproval('p1', { action: 'approved' });

      expect(result).toEqual({ action: 'approved' });
    });
  });

  // =========================================================================
  // Workspace
  // =========================================================================

  describe('workspace', () => {
    it('hasWorkspace returns false when not configured', () => {
      const h = createHarness();
      expect(h.hasWorkspace()).toBe(false);
      expect(h.isWorkspaceReady()).toBe(false);
      expect(h.getWorkspace()).toBeUndefined();
    });
  });

  // =========================================================================
  // Session
  // =========================================================================

  describe('session', () => {
    it('session returns current state', async () => {
      const h = createHarness();
      await h.init();

      const s = await h.session();
      expect(s.currentThreadId).toBeNull();
      expect(s.currentModeId).toBe('plan');
      expect(s.threads).toEqual([]);
    });

    it('session reflects created threads', async () => {
      const h = createHarness();
      await h.init();
      await h.threads.create('Test');

      const s = await h.session();
      expect(s.threads).toHaveLength(1);
      expect(s.currentThreadId).toBeDefined();
    });
  });

  // =========================================================================
  // Send & Message Listing
  // =========================================================================

  describe('send and message listing', () => {
    function streamFromChunks(chunks: any[]): ReadableStream<any> {
      return new ReadableStream({
        start(controller) {
          for (const chunk of chunks) {
            controller.enqueue(chunk);
          }
          controller.close();
        },
      });
    }

    it('send streams text and emits lifecycle/message events', async () => {
      const streamMock = vi.fn().mockResolvedValue({
        fullStream: streamFromChunks([
          {
            type: 'text-start',
            payload: { id: 'm-1' },
          },
          {
            type: 'text-delta',
            payload: { id: 'm-1', text: 'Hello ' },
          },
          {
            type: 'text-delta',
            payload: { id: 'm-1', text: 'world' },
          },
          {
            type: 'finish',
            payload: {
              stepResult: { reason: 'stop' },
              output: {
                usage: {
                  inputTokens: 10,
                  outputTokens: 4,
                  totalTokens: 14,
                },
              },
            },
          },
        ]),
      });

      const h = createHarness({
        modes: [
          {
            id: 'plan',
            default: true,
            agent: {
              id: 'stream-agent',
              name: 'Stream Agent',
              stream: streamMock,
            } as any,
          },
        ],
      });
      await h.init();

      const events: HarnessEvent[] = [];
      h.subscribe(e => {
        events.push(e);
      });

      await h.send('hello');

      expect(streamMock).toHaveBeenCalled();
      expect(events.some(e => e.type === 'agent_start')).toBe(true);
      expect(events.some(e => e.type === 'message_start')).toBe(true);
      expect(events.some(e => e.type === 'message_update')).toBe(true);
      expect(events.some(e => e.type === 'message_end')).toBe(true);
      expect(events.some(e => e.type === 'agent_end')).toBe(true);
      expect(h.usage.get().totalTokens).toBe(14);
    });

    it('send respects onBeforeSend blocking hook', async () => {
      const streamMock = vi.fn().mockResolvedValue({
        fullStream: streamFromChunks([]),
      });

      const h = createHarness({
        hooks: {
          onBeforeSend: () => ({
            allowed: false,
            blockReason: 'blocked',
          }),
        },
        modes: [
          {
            id: 'plan',
            default: true,
            agent: {
              id: 'stream-agent',
              name: 'Stream Agent',
              stream: streamMock,
            } as any,
          },
        ],
      });
      await h.init();

      const events: HarnessEvent[] = [];
      h.subscribe(e => {
        events.push(e);
      });

      await h.send('hello');

      expect(streamMock).not.toHaveBeenCalled();
      expect(events.some(e => e.type === 'info')).toBe(true);
    });

    it('send requires approval when policy is ask and handles decline', async () => {
      const streamMock = vi.fn().mockResolvedValue({
        fullStream: streamFromChunks([
          {
            type: 'text-start',
            payload: { id: 'm-approve-1' },
          },
          {
            type: 'tool-call-approval',
            payload: {
              toolCallId: 'tool-approve-1',
              toolName: 'shell',
              args: { command: 'rm -rf /tmp/demo' },
            },
          },
          {
            type: 'finish',
            payload: {
              stepResult: { reason: 'stop' },
              output: {
                usage: {
                  inputTokens: 1,
                  outputTokens: 1,
                  totalTokens: 2,
                },
              },
            },
          },
        ]),
      });

      const h = createHarness({
        hooks: {
          resolveToolApproval: () => 'ask',
        },
        modes: [
          {
            id: 'plan',
            default: true,
            agent: {
              id: 'approval-agent',
              name: 'Approval Agent',
              stream: streamMock,
            } as any,
          },
        ],
      });
      await h.init();

      const events: HarnessEvent[] = [];
      h.subscribe(e => {
        events.push(e);
      });

      setTimeout(() => {
        h.resolveToolApprovalDecision('decline');
      }, 0);

      await h.send('please execute');

      expect(events.some(e => e.type === 'tool_approval_required')).toBe(true);
      const toolEnd = events.find(e => e.type === 'tool_end');
      expect(toolEnd).toBeDefined();
      if (toolEnd?.type === 'tool_end') {
        expect(toolEnd.toolCallId).toBe('tool-approve-1');
        expect(toolEnd.isError).toBe(true);
      }
    });

    it('send auto-denies tool when onBeforeToolUse blocks', async () => {
      const onBeforeToolUse = vi.fn().mockResolvedValue({ allowed: false });
      const streamMock = vi.fn().mockResolvedValue({
        fullStream: streamFromChunks([
          {
            type: 'text-start',
            payload: { id: 'm-approve-2' },
          },
          {
            type: 'tool-call-approval',
            payload: {
              toolCallId: 'tool-approve-2',
              toolName: 'shell',
              args: { command: 'echo test' },
            },
          },
          {
            type: 'finish',
            payload: {
              stepResult: { reason: 'stop' },
              output: {
                usage: {
                  inputTokens: 1,
                  outputTokens: 1,
                  totalTokens: 2,
                },
              },
            },
          },
        ]),
      });

      const h = createHarness({
        hooks: {
          resolveToolApproval: () => 'allow',
          onBeforeToolUse,
        },
        modes: [
          {
            id: 'plan',
            default: true,
            agent: {
              id: 'approval-agent',
              name: 'Approval Agent',
              stream: streamMock,
            } as any,
          },
        ],
      });
      await h.init();

      const events: HarnessEvent[] = [];
      h.subscribe(e => {
        events.push(e);
      });

      await h.send('please execute');

      expect(onBeforeToolUse).toHaveBeenCalledWith('shell', {
        command: 'echo test',
      });
      const toolEnd = events.find(e => e.type === 'tool_end');
      expect(toolEnd).toBeDefined();
      if (toolEnd?.type === 'tool_end') {
        expect(toolEnd.toolCallId).toBe('tool-approve-2');
        expect(toolEnd.isError).toBe(true);
      }
    });

    it('send supports ask + approve path without synthetic tool error', async () => {
      const streamMock = vi.fn().mockResolvedValue({
        fullStream: streamFromChunks([
          {
            type: 'text-start',
            payload: { id: 'm-approve-3' },
          },
          {
            type: 'tool-call-approval',
            payload: {
              toolCallId: 'tool-approve-3',
              toolName: 'shell',
              args: { command: 'pwd' },
            },
          },
          {
            type: 'finish',
            payload: {
              stepResult: { reason: 'stop' },
              output: {
                usage: {
                  inputTokens: 1,
                  outputTokens: 1,
                  totalTokens: 2,
                },
              },
            },
          },
        ]),
      });

      const h = createHarness({
        hooks: {
          resolveToolApproval: () => 'ask',
        },
        modes: [
          {
            id: 'plan',
            default: true,
            agent: {
              id: 'approval-agent',
              name: 'Approval Agent',
              stream: streamMock,
            } as any,
          },
        ],
      });
      await h.init();

      const events: HarnessEvent[] = [];
      h.subscribe(e => {
        events.push(e);
      });

      setTimeout(() => {
        h.resolveToolApprovalDecision('approve');
      }, 0);

      await h.send('please execute');

      expect(events.some(e => e.type === 'tool_approval_required')).toBe(true);
      const toolEnd = events.find(e => e.type === 'tool_end');
      expect(toolEnd).toBeUndefined();
    });

    it('send supports deny policy without prompting user and marks stop reason tool_use', async () => {
      const streamMock = vi.fn().mockResolvedValue({
        fullStream: streamFromChunks([
          {
            type: 'text-start',
            payload: { id: 'm-approve-4' },
          },
          {
            type: 'tool-call-approval',
            payload: {
              toolCallId: 'tool-approve-4',
              toolName: 'shell',
              args: { command: 'cat /etc/passwd' },
            },
          },
          {
            type: 'finish',
            payload: {
              stepResult: { reason: 'stop' },
              output: {
                usage: {
                  inputTokens: 1,
                  outputTokens: 1,
                  totalTokens: 2,
                },
              },
            },
          },
        ]),
      });

      const h = createHarness({
        hooks: {
          resolveToolApproval: () => 'deny',
        },
        modes: [
          {
            id: 'plan',
            default: true,
            agent: {
              id: 'approval-agent',
              name: 'Approval Agent',
              stream: streamMock,
            } as any,
          },
        ],
      });
      await h.init();

      const events: HarnessEvent[] = [];
      h.subscribe(e => {
        events.push(e);
      });

      await h.send('please execute');

      expect(events.some(e => e.type === 'tool_approval_required')).toBe(false);
      const toolEnd = events.find(e => e.type === 'tool_end');
      expect(toolEnd).toBeDefined();
      if (toolEnd?.type === 'tool_end') {
        expect(toolEnd.isError).toBe(true);
      }
      const messageEnd = events.find(e => e.type === 'message_end');
      expect(messageEnd).toBeDefined();
      if (messageEnd?.type === 'message_end') {
        expect(messageEnd.message.stopReason).toBe('tool_use');
      }
    });

    it('threads.messages maps storage messages to HarnessMessage format', async () => {
      const storage = new InMemoryStore();
      const h = new Harness<TestState>({
        id: 'test-harness',
        resourceId: 'test-resource',
        storage,
        stateSchema: testSchema,
        modes: createTestModes(),
      } as any);

      await h.init();
      const thread = await h.threads.create('Thread');
      const memoryStorage = await storage.getStore('memory');
      await memoryStorage!.saveMessages({
        messages: [
          {
            id: 'msg-1',
            role: 'assistant',
            threadId: thread.id,
            resourceId: thread.resourceId,
            createdAt: new Date(),
            content: {
              format: 2,
              parts: [
                { type: 'text', text: 'Hello from storage' },
                {
                  type: 'tool-invocation',
                  toolInvocation: {
                    state: 'call',
                    toolCallId: 'tool-1',
                    toolName: 'shell',
                    args: { cmd: 'ls' },
                  },
                },
              ],
            },
          } as any,
        ],
      });

      const messages = await h.threads.messages();
      expect(messages).toHaveLength(1);
      expect(messages[0].role).toBe('assistant');
      expect(messages[0].content[0]).toEqual({
        type: 'text',
        text: 'Hello from storage',
      });
      expect(messages[0].content[1]).toEqual({
        type: 'tool_call',
        id: 'tool-1',
        name: 'shell',
        args: { cmd: 'ls' },
      });
    });
  });
});
