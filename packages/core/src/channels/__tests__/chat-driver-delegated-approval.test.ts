import { beforeAll, describe, expect, it, vi } from 'vitest';

import { runStaticDriver } from '../chat-driver-static';
import { runStreamingDriver } from '../chat-driver-streaming';
import { getChatModule } from '../chat-lazy';
import type { PendingApprovalRecord } from '../stream-helpers';

// A supervisor re-raises each sub-agent pause under its own delegation call id,
// so several sub-agent approvals in one delegation share `toolCallId`. Each
// card must still be its own message with its own `tool_approve:<card id>`
// buttons, or a repeat click on card #1 can answer card #2.

function createHarness() {
  const posts: any[] = [];
  const edits: Array<{ messageId: string; content: any }> = [];
  let nextId = 1;

  const adapter: any = {
    name: 'test',
    editMessage: vi.fn(async (_threadId: string, messageId: string, content: any) => {
      edits.push({ messageId, content });
    }),
    deleteMessage: vi.fn().mockResolvedValue(undefined),
    startTyping: vi.fn().mockResolvedValue(undefined),
  };

  const chatThread: any = {
    id: 'test:c1:t1',
    channelId: 'test:c1',
    isDM: false,
    post: vi.fn(async (content: any) => {
      posts.push(content);
      return { id: `m${nextId++}`, text: '' };
    }),
    startTyping: vi.fn(async () => {}),
  };

  return { adapter, chatThread, posts, edits };
}

function createStash() {
  const records = new Map<string, PendingApprovalRecord>();
  return {
    records,
    onApprovalPosted: (id: string, record: PendingApprovalRecord) => {
      records.set(id, record);
    },
    getPendingApproval: (id: string) => records.get(id),
    takePendingApproval: (id: string) => {
      const record = records.get(id);
      if (record) records.delete(id);
      return record;
    },
  };
}

function toolCallChunk(toolCallId: string, toolName: string, args: unknown) {
  return { type: 'tool-call', payload: { toolCallId, toolName, args }, runId: 'run-1' };
}

function approvalChunk(args: {
  toolCallId: string;
  toolName: string;
  callArgs: unknown;
  delegatedToolCallId?: string;
  delegatedToolName?: string;
}) {
  return {
    type: 'tool-call-approval',
    payload: {
      toolCallId: args.toolCallId,
      toolName: args.toolName,
      args: args.callArgs,
      ...(args.delegatedToolCallId
        ? { delegatedToolCallId: args.delegatedToolCallId, delegatedToolName: args.delegatedToolName ?? args.toolName }
        : {}),
    },
    runId: 'run-1',
  };
}

async function* streamOf(chunks: any[]) {
  for (const chunk of chunks) yield chunk;
}

function buttonIds(message: any): string[] {
  if (!message || typeof message !== 'object' || !Array.isArray(message.children)) return [];
  const ids: string[] = [];
  for (const child of message.children) {
    if (child?.type === 'actions' && Array.isArray(child.children)) {
      for (const button of child.children) {
        if (typeof button?.id === 'string') ids.push(button.id);
      }
    }
  }
  return ids;
}

function commonArgs(harness: ReturnType<typeof createHarness>, stash: ReturnType<typeof createStash>) {
  return {
    chatThread: harness.chatThread,
    adapter: harness.adapter,
    channelToolNames: new Set<string>(),
    onApprovalPosted: stash.onApprovalPosted,
    getPendingApproval: stash.getPendingApproval,
    takePendingApproval: stash.takePendingApproval,
  };
}

describe('approval cards for a delegated sub-agent tool call', () => {
  beforeAll(async () => {
    // `formatToolApproval` builds Chat SDK cards through the lazy module.
    await getChatModule();
  });

  describe('static driver', () => {
    it('posts each sub-agent approval as its own card with its own button ids', async () => {
      const harness = createHarness();
      const stash = createStash();

      await runStaticDriver({
        ...commonArgs(harness, stash),
        stream: streamOf([
          toolCallChunk('call_delegate_1', 'agent-worker', { task: 'clean up' }),
          approvalChunk({
            toolCallId: 'call_delegate_1',
            toolName: 'delete',
            callArgs: { path: 'a.txt' },
            delegatedToolCallId: 'call_delete_a',
          }),
          approvalChunk({
            toolCallId: 'call_delegate_1',
            toolName: 'delete',
            callArgs: { path: 'b.txt' },
            delegatedToolCallId: 'call_delete_b',
          }),
          { type: 'finish', payload: {} },
        ]),
        toolDisplay: 'cards',
      });

      // One running card for the delegation, then one card per sub-agent approval.
      expect(harness.posts).toHaveLength(3);
      expect(harness.edits).toHaveLength(0);

      const [, cardA, cardB] = harness.posts;
      expect(buttonIds(cardA)).toEqual(['tool_approve:call_delete_a', 'tool_deny:call_delete_a']);
      expect(buttonIds(cardB)).toEqual(['tool_approve:call_delete_b', 'tool_deny:call_delete_b']);

      expect([...stash.records.keys()]).toEqual(['call_delete_a', 'call_delete_b']);
      expect(stash.records.get('call_delete_a')).toMatchObject({
        messageId: 'm2',
        toolCallId: 'call_delegate_1',
        delegatedToolCallId: 'call_delete_a',
      });
      expect(stash.records.get('call_delete_b')).toMatchObject({
        messageId: 'm3',
        toolCallId: 'call_delegate_1',
        delegatedToolCallId: 'call_delete_b',
      });
    });

    it('still edits the running tool card for an ordinary approval', async () => {
      const harness = createHarness();
      const stash = createStash();

      await runStaticDriver({
        ...commonArgs(harness, stash),
        stream: streamOf([
          toolCallChunk('tool-call-1', 'weather', { city: 'NYC' }),
          approvalChunk({ toolCallId: 'tool-call-1', toolName: 'weather', callArgs: { city: 'NYC' } }),
          { type: 'finish', payload: {} },
        ]),
        toolDisplay: 'cards',
      });

      expect(harness.posts).toHaveLength(1);
      expect(harness.edits).toHaveLength(1);
      expect(harness.edits[0].messageId).toBe('m1');
      expect(buttonIds(harness.edits[0].content)).toEqual(['tool_approve:tool-call-1', 'tool_deny:tool-call-1']);
      expect([...stash.records.keys()]).toEqual(['tool-call-1']);
    });
  });

  describe('streaming driver', () => {
    it('posts each sub-agent approval as its own card with its own button ids', async () => {
      const harness = createHarness();
      const stash = createStash();

      await runStreamingDriver({
        ...commonArgs(harness, stash),
        toolDisplay: 'cards',
        typingGate: { active: false },
        stream: streamOf([
          toolCallChunk('call_delegate_1', 'agent-worker', { task: 'clean up' }),
          approvalChunk({
            toolCallId: 'call_delegate_1',
            toolName: 'delete',
            callArgs: { path: 'a.txt' },
            delegatedToolCallId: 'call_delete_a',
          }),
          approvalChunk({
            toolCallId: 'call_delegate_1',
            toolName: 'delete',
            callArgs: { path: 'b.txt' },
            delegatedToolCallId: 'call_delete_b',
          }),
          { type: 'finish', payload: {} },
        ]),
      });

      const approvalPosts = harness.posts.filter(post => buttonIds(post).length > 0);
      expect(approvalPosts).toHaveLength(2);
      expect(buttonIds(approvalPosts[0])).toEqual(['tool_approve:call_delete_a', 'tool_deny:call_delete_a']);
      expect(buttonIds(approvalPosts[1])).toEqual(['tool_approve:call_delete_b', 'tool_deny:call_delete_b']);
      expect(harness.edits).toHaveLength(0);

      expect(stash.records.get('call_delete_a')).toMatchObject({
        toolCallId: 'call_delegate_1',
        delegatedToolCallId: 'call_delete_a',
      });
      expect(stash.records.get('call_delete_b')).toMatchObject({
        toolCallId: 'call_delegate_1',
        delegatedToolCallId: 'call_delete_b',
      });
    });

    it('still edits the running tool card for an ordinary approval', async () => {
      const harness = createHarness();
      const stash = createStash();

      await runStreamingDriver({
        ...commonArgs(harness, stash),
        toolDisplay: 'cards',
        typingGate: { active: false },
        stream: streamOf([
          toolCallChunk('tool-call-1', 'weather', { city: 'NYC' }),
          approvalChunk({ toolCallId: 'tool-call-1', toolName: 'weather', callArgs: { city: 'NYC' } }),
          { type: 'finish', payload: {} },
        ]),
      });

      expect(harness.edits).toHaveLength(1);
      expect(harness.edits[0].messageId).toBe('m1');
      expect(buttonIds(harness.edits[0].content)).toEqual(['tool_approve:tool-call-1', 'tool_deny:tool-call-1']);
    });
  });
});
