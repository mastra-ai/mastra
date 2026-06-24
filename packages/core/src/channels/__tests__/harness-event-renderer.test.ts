import { describe, it, expect, vi, beforeAll } from 'vitest';

import type { HarnessEvent, HarnessMessage } from '../../harness/types';
import { getChatModule } from '../chat-lazy';
import { createHarnessRenderState, handleHarnessEvent } from '../harness-event-renderer';
import type { HarnessRenderDeps, HarnessRenderState } from '../harness-event-renderer';
import type { PendingApprovalRecord } from '../stream-helpers';

// ---------------------------------------------------------------------------
// Test harness: record every platform call the renderer makes.
// ---------------------------------------------------------------------------

type Call =
  | { kind: 'post'; arg: unknown }
  | { kind: 'editMessage'; threadId: string; messageId: string; content: unknown };

function createRecording() {
  const calls: Call[] = [];
  let nextMessageId = 1;

  const adapter = {
    editMessage: vi.fn(async (threadId: string, messageId: string, content: unknown) => {
      calls.push({ kind: 'editMessage', threadId, messageId, content });
    }),
  };

  const chatThread = {
    id: 'test:c1:t1',
    post: vi.fn(async (content: unknown) => {
      calls.push({ kind: 'post', arg: content });
      return { id: `m${nextMessageId++}`, text: typeof content === 'string' ? content : '' };
    }),
  };

  return { calls, adapter, chatThread };
}

function makeDeps(overrides: Partial<HarnessRenderDeps> = {}): {
  deps: HarnessRenderDeps;
  calls: Call[];
  approvals: Array<{ toolCallId: string; record: PendingApprovalRecord }>;
} {
  const { calls, adapter, chatThread } = createRecording();
  const approvals: Array<{ toolCallId: string; record: PendingApprovalRecord }> = [];
  const deps: HarnessRenderDeps = {
    chatThread: chatThread as any,
    adapter: adapter as any,
    platform: 'test',
    toolDisplay: 'text',
    channelToolNames: new Set<string>(),
    canRenderApprovalButtons: true,
    updateIntervalMs: 0,
    onApprovalPosted: (toolCallId, record) => approvals.push({ toolCallId, record }),
    ...overrides,
  };
  return { deps, calls, approvals };
}

function assistantMessage(text: string): HarnessMessage {
  return { id: 'a1', role: 'assistant', content: [{ type: 'text', text }], createdAt: new Date() };
}

async function feed(events: HarnessEvent[], deps: HarnessRenderDeps, state: HarnessRenderState): Promise<void> {
  for (const event of events) {
    await handleHarnessEvent(event, state, deps);
  }
}

describe('handleHarnessEvent', () => {
  beforeAll(async () => {
    // Loads the `chat` module so card/approval formatting works.
    await getChatModule();
  });

  describe('assistant message streaming', () => {
    it('posts once then edits in place for cumulative message_update', async () => {
      const { deps, calls } = makeDeps();
      const state = createHarnessRenderState();

      await feed(
        [
          { type: 'message_start', message: assistantMessage('') },
          { type: 'message_update', message: assistantMessage('Hello') },
          { type: 'message_update', message: assistantMessage('Hello, world') },
          { type: 'message_end', message: assistantMessage('Hello, world!') },
        ],
        deps,
        state,
      );

      // First update posts; subsequent updates + end edit the same message.
      const posts = calls.filter(c => c.kind === 'post');
      const edits = calls.filter(c => c.kind === 'editMessage');
      expect(posts).toHaveLength(1);
      expect(posts[0]!.arg).toBe('Hello');
      expect(edits.length).toBeGreaterThanOrEqual(1);
      // The final rendered content is the full text.
      const last = calls[calls.length - 1]!;
      expect(last.kind).toBe('editMessage');
      expect((last as { content: unknown }).content).toBe('Hello, world!');
      // Every edit targets the originally-posted message id.
      for (const e of edits) {
        expect((e as { messageId: string }).messageId).toBe('m1');
      }
    });

    it('finalizes so the next turn posts a fresh message', async () => {
      const { deps, calls } = makeDeps();
      const state = createHarnessRenderState();

      await feed(
        [
          { type: 'message_update', message: assistantMessage('First') },
          { type: 'message_end', message: assistantMessage('First') },
          { type: 'message_update', message: assistantMessage('Second') },
          { type: 'message_end', message: assistantMessage('Second') },
        ],
        deps,
        state,
      );

      const posts = calls.filter(c => c.kind === 'post');
      expect(posts).toHaveLength(2);
      expect(posts[0]!.arg).toBe('First');
      expect(posts[1]!.arg).toBe('Second');
    });

    it('ignores non-assistant messages', async () => {
      const { deps, calls } = makeDeps();
      const state = createHarnessRenderState();
      const userMsg: HarnessMessage = {
        id: 'u1',
        role: 'user',
        content: [{ type: 'text', text: 'hi' }],
        createdAt: new Date(),
      };

      await feed([{ type: 'message_update', message: userMsg }], deps, state);
      expect(calls).toHaveLength(0);
    });
  });

  describe('tool lifecycle', () => {
    it('posts a running card then edits it to the result', async () => {
      const { deps, calls } = makeDeps();
      const state = createHarnessRenderState();

      await feed(
        [
          { type: 'tool_start', toolCallId: 'tc1', toolName: 'search', args: { q: 'cats' } },
          { type: 'tool_end', toolCallId: 'tc1', result: { hits: 3 }, isError: false },
        ],
        deps,
        state,
      );

      const posts = calls.filter(c => c.kind === 'post');
      const edits = calls.filter(c => c.kind === 'editMessage');
      expect(posts).toHaveLength(1);
      expect(edits).toHaveLength(1);
      // The card is edited in place (same message id from the running post).
      expect((edits[0] as { messageId: string }).messageId).toBe('m1');
    });

    it('renders a failed tool result', async () => {
      const { deps, calls } = makeDeps();
      const state = createHarnessRenderState();

      await feed(
        [
          { type: 'tool_start', toolCallId: 'tc2', toolName: 'fetch', args: {} },
          { type: 'tool_end', toolCallId: 'tc2', result: 'boom', isError: true },
        ],
        deps,
        state,
      );

      const edits = calls.filter(c => c.kind === 'editMessage');
      expect(edits).toHaveLength(1);
      expect(String((edits[0] as { content: unknown }).content)).toContain('boom');
    });

    it('skips channel tool names', async () => {
      const { deps, calls } = makeDeps({ channelToolNames: new Set(['add_reaction']) });
      const state = createHarnessRenderState();

      await feed(
        [
          { type: 'tool_start', toolCallId: 'tc3', toolName: 'add_reaction', args: {} },
          { type: 'tool_end', toolCallId: 'tc3', result: 'ok', isError: false },
        ],
        deps,
        state,
      );

      expect(calls).toHaveLength(0);
    });

    it('skips all tool cards in hidden mode', async () => {
      const { deps, calls } = makeDeps({ toolDisplay: 'hidden' });
      const state = createHarnessRenderState();

      await feed(
        [
          { type: 'tool_start', toolCallId: 'tc4', toolName: 'search', args: {} },
          { type: 'tool_end', toolCallId: 'tc4', result: 'ok', isError: false },
        ],
        deps,
        state,
      );

      expect(calls).toHaveLength(0);
    });
  });

  describe('tool approval', () => {
    it('posts an approval card and stashes the pending record', async () => {
      const { deps, calls, approvals } = makeDeps({ toolDisplay: 'cards' });
      const state = createHarnessRenderState();

      await feed(
        [{ type: 'tool_approval_required', toolCallId: 'tc5', toolName: 'delete_file', args: { path: '/x' } }],
        deps,
        state,
      );

      expect(calls.filter(c => c.kind === 'post')).toHaveLength(1);
      expect(approvals).toHaveLength(1);
      expect(approvals[0]!.toolCallId).toBe('tc5');
      expect(approvals[0]!.record.messageId).toBe('m1');
      expect(approvals[0]!.record.toolName).toBe('delete_file');
    });

    it('does not post an approval card when buttons are unsupported', async () => {
      const { deps, calls, approvals } = makeDeps({ canRenderApprovalButtons: false });
      const state = createHarnessRenderState();

      await feed(
        [{ type: 'tool_approval_required', toolCallId: 'tc6', toolName: 'delete_file', args: {} }],
        deps,
        state,
      );

      expect(calls).toHaveLength(0);
      expect(approvals).toHaveLength(0);
    });
  });

  describe('error and info', () => {
    it('posts an error event', async () => {
      const { deps, calls } = makeDeps();
      const state = createHarnessRenderState();

      await feed([{ type: 'error', error: new Error('kaput') }], deps, state);
      const posts = calls.filter(c => c.kind === 'post');
      expect(posts).toHaveLength(1);
      expect(String(posts[0]!.arg)).toContain('kaput');
    });

    it('posts an info event', async () => {
      const { deps, calls } = makeDeps();
      const state = createHarnessRenderState();

      await feed([{ type: 'info', message: 'heads up' }], deps, state);
      const posts = calls.filter(c => c.kind === 'post');
      expect(posts).toHaveLength(1);
      expect(posts[0]!.arg).toBe('heads up');
    });
  });

  describe('forward-compat', () => {
    it('ignores unknown event types without throwing', async () => {
      const { deps, calls } = makeDeps();
      const state = createHarnessRenderState();

      await feed(
        [
          { type: 'mode_changed', modeId: 'plan', previousModeId: 'build' } as HarnessEvent,
          { type: 'usage_update', usage: {} as any } as HarnessEvent,
          { type: 'some_future_event', foo: 1 } as unknown as HarnessEvent,
        ],
        deps,
        state,
      );

      expect(calls).toHaveLength(0);
    });
  });
});
