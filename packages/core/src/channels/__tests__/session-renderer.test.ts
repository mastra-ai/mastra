import { beforeAll, describe, expect, it, vi } from 'vitest';

import type { Session } from '../../harness/session';
import type { HarnessEvent, HarnessEventListener, HarnessMessage } from '../../harness/types';
import { getChatModule } from '../chat-lazy';
import type { ChatChannelRenderContext } from '../output-processor';
import { SessionChannelRenderer } from '../session-renderer';
import type { PendingApprovalRecord } from '../stream-helpers';

// The static/streaming drivers resolve Card/CardText/etc. via the lazily
// loaded chat module at call time, so prime it before any driver runs.
beforeAll(async () => {
  await getChatModule();
});

/**
 * Minimal fake of the Harness {@link Session} event bus: records subscribers
 * and lets the test emit `HarnessEvent`s synchronously. Only the surface the
 * renderer touches (`subscribe`) is implemented.
 */
function createFakeSession() {
  const listeners = new Set<HarnessEventListener>();
  const subscribe = vi.fn((listener: HarnessEventListener) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  });
  const emit = (event: HarnessEvent) => {
    for (const l of listeners) void l(event);
  };
  const session = { subscribe } as unknown as Session;
  return { session, emit, listeners };
}

function assistantMessage(id: string, text: string): HarnessMessage {
  return {
    id,
    role: 'assistant',
    content: [{ type: 'text', text }],
  } as unknown as HarnessMessage;
}

/**
 * Build a real-shaped {@link ChatChannelRenderContext} backed by a recording
 * adapter + thread, so the renderer drives the genuine render-pump + drivers.
 * Streaming is disabled so the static driver produces deterministic posts.
 */
function createRenderContext(overrides?: Partial<ChatChannelRenderContext>) {
  const posts: unknown[] = [];
  const edits: Array<{ threadId: string; messageId: string; message: unknown }> = [];
  const stash = new Map<string, PendingApprovalRecord>();

  const chatThread = {
    id: 'thread-1',
    channelId: 'chan-1',
    isDM: true,
    post: vi.fn(async (message: unknown) => {
      posts.push(message);
      return { id: `posted-${posts.length}`, text: '' };
    }),
  } as any;

  const adapter = {
    name: 'discord',
    editMessage: vi.fn(async (threadId: string, messageId: string, message: unknown) => {
      edits.push({ threadId, messageId, message });
    }),
  } as any;

  const render: ChatChannelRenderContext = {
    adapter,
    chatThread,
    platform: 'discord',
    streaming: { enabled: false },
    toolDisplay: 'cards',
    channelToolNames: new Set<string>(),
    onApprovalPosted: (toolCallId, record) => {
      stash.set(toolCallId, record);
    },
    getPendingApproval: id => stash.get(id),
    takePendingApproval: id => {
      const r = stash.get(id);
      if (r) stash.delete(id);
      return r;
    },
    wrapStream: stream => stream,
    typingGate: { active: false },
    ...overrides,
  };

  return { render, posts, edits, stash, chatThread, adapter };
}

describe('SessionChannelRenderer', () => {
  it('renders streamed assistant text from session events to the channel', async () => {
    const { session, emit } = createFakeSession();
    const { render, posts } = createRenderContext();

    const renderer = new SessionChannelRenderer({ session, render, runId: 'run-1' });
    const drained = renderer.start();

    emit({ type: 'message_start', message: assistantMessage('m1', '') });
    emit({ type: 'message_update', message: assistantMessage('m1', 'Hel') });
    emit({ type: 'message_update', message: assistantMessage('m1', 'Hello world') });
    emit({ type: 'message_end', message: assistantMessage('m1', 'Hello world') });
    emit({ type: 'agent_end', reason: 'complete' });

    await drained;

    const text = posts.map(p => (typeof p === 'string' ? p : JSON.stringify(p))).join('\n');
    expect(text).toContain('Hello world');
  });

  it('completes a tool-approval round-trip: card stashed on suspend, resume renders result', async () => {
    const { session, emit } = createFakeSession();
    const { render, stash } = createRenderContext();

    // --- Initial run: tool call → approval required → suspended -------------
    const renderer = new SessionChannelRenderer({ session, render, runId: 'run-1' });
    const drained = renderer.start();

    emit({ type: 'tool_start', toolCallId: 'tc-1', toolName: 'mastra_fs_read', args: { path: 'a.txt' } });
    emit({ type: 'tool_approval_required', toolCallId: 'tc-1', toolName: 'mastra_fs_read', args: { path: 'a.txt' } });
    emit({ type: 'agent_end', reason: 'suspended' });

    // The suspended run must drain so the incoming-message handler can return,
    // and the approval card must be stashed for the later button click.
    await drained;
    expect(stash.has('tc-1')).toBe(true);

    // --- Resume run (approval): a fresh renderer renders the tool-result ----
    const { session: session2, emit: emit2 } = createFakeSession();
    const resumeRender = createRenderContext();
    const resumeRenderer = new SessionChannelRenderer({
      session: session2,
      render: resumeRender.render,
      runId: 'run-1',
    });
    const resumeDrained = resumeRenderer.start();

    emit2({ type: 'tool_end', toolCallId: 'tc-1', result: 'file contents', isError: false });
    emit2({ type: 'message_update', message: assistantMessage('m2', 'Done reading the file.') });
    emit2({ type: 'message_end', message: assistantMessage('m2', 'Done reading the file.') });
    emit2({ type: 'agent_end', reason: 'complete' });

    await resumeDrained;

    const resumeText = resumeRender.posts.map(p => (typeof p === 'string' ? p : JSON.stringify(p))).join('\n');
    expect(resumeText).toContain('Done reading the file.');
  });

  it('resolves drained on aborted runs without throwing', async () => {
    const { session, emit } = createFakeSession();
    const { render } = createRenderContext();

    const renderer = new SessionChannelRenderer({ session, render, runId: 'run-1' });
    const drained = renderer.start();

    emit({ type: 'message_update', message: assistantMessage('m1', 'partial') });
    emit({ type: 'agent_end', reason: 'aborted' });

    await expect(drained).resolves.toBeUndefined();
  });
});
