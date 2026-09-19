import { beforeAll, describe, it, expect, vi } from 'vitest';

import { getChatModule } from '../chat-lazy';
import {
  ToolTracker,
  editOrPostMessage,
  extractErrorMessage,
  isBlankToolMessage,
  postFileAttachment,
  renderBuiltInToolEvent,
} from '../stream-helpers';
import type { ToolDisplayEvent } from '../types';

describe('ToolTracker', () => {
  it('tracks a tool start and returns enrichment', () => {
    const tracker = new ToolTracker();
    const e = tracker.trackStart({ toolCallId: 't1', toolName: 'weather', args: { city: 'NYC' } });

    expect(e.toolCallId).toBe('t1');
    expect(e.toolName).toBe('weather');
    expect(e.displayName).toBe('weather');
    expect(e.argsSummary).toBe('NYC');
    expect(typeof e.startedAt).toBe('number');
    expect(tracker.inFlightCount).toBe(1);
    expect(tracker.has('t1')).toBe(true);
  });

  it('strips mastra_workspace_ prefix from displayName', () => {
    const tracker = new ToolTracker();
    const e = tracker.trackStart({ toolCallId: 't1', toolName: 'mastra_workspace_view', args: { path: 'a.ts' } });
    expect(e.displayName).toBe('view');
  });

  it('enrichResult uses tracked displayName/argsSummary and computes duration', async () => {
    const tracker = new ToolTracker();
    tracker.trackStart({ toolCallId: 't1', toolName: 'mastra_workspace_view', args: { path: 'a.ts' } });
    // Force at least 1ms duration.
    await new Promise(r => setTimeout(r, 2));
    const e = tracker.enrichResult({
      toolCallId: 't1',
      toolName: 'mastra_workspace_view',
      args: { path: 'a.ts' },
      result: 'ok',
    });

    expect(e.displayName).toBe('view');
    expect(e.argsSummary).toBe('a.ts');
    expect(e.resultText).toContain('ok');
    expect(e.isError).toBe(false);
    expect(e.durationMs).toBeGreaterThanOrEqual(1);
    // enrichResult removes the tracked tool.
    expect(tracker.has('t1')).toBe(false);
    expect(tracker.inFlightCount).toBe(0);
  });

  it('enrichResult without prior trackStart falls back to call args', () => {
    const tracker = new ToolTracker();
    const e = tracker.enrichResult({
      toolCallId: 'orphan',
      toolName: 'weather',
      args: { city: 'NYC' },
      result: 'sunny',
    });

    expect(e.displayName).toBe('weather');
    expect(e.argsSummary).toBe('NYC');
    expect(e.durationMs).toBeUndefined();
    expect(e.resultText).toBeDefined();
  });

  it('enrichError captures error text and marks isError', () => {
    const tracker = new ToolTracker();
    tracker.trackStart({ toolCallId: 't1', toolName: 'weather', args: {} });
    const e = tracker.enrichError({
      toolCallId: 't1',
      toolName: 'weather',
      args: {},
      error: new Error('boom'),
    });

    expect(e.isError).toBe(true);
    expect(e.errorText).toContain('boom');
    expect(tracker.has('t1')).toBe(false);
  });

  it('enrichApproval keeps the tracked tool in flight (no delete)', () => {
    const tracker = new ToolTracker();
    tracker.trackStart({ toolCallId: 't1', toolName: 'weather', args: { city: 'NYC' } });
    const e = tracker.enrichApproval({ toolCallId: 't1', toolName: 'weather', args: { city: 'NYC' } });

    expect(e.displayName).toBe('weather');
    expect(e.argsSummary).toBe('NYC');
    expect(tracker.has('t1')).toBe(true);
    expect(tracker.inFlightCount).toBe(1);
  });

  it('parallel same-tool calls do not clobber each other', () => {
    const tracker = new ToolTracker();
    tracker.trackStart({ toolCallId: 't1', toolName: 'weather', args: { city: 'NYC' } });
    tracker.trackStart({ toolCallId: 't2', toolName: 'weather', args: { city: 'SF' } });

    expect(tracker.inFlightCount).toBe(2);

    const r1 = tracker.enrichResult({ toolCallId: 't1', toolName: 'weather', args: { city: 'NYC' }, result: 'rainy' });
    const r2 = tracker.enrichResult({ toolCallId: 't2', toolName: 'weather', args: { city: 'SF' }, result: 'foggy' });

    expect(r1.argsSummary).toBe('NYC');
    expect(r2.argsSummary).toBe('SF');
    expect(tracker.inFlightCount).toBe(0);
  });

  it('forget removes a tracked tool without enriching', () => {
    const tracker = new ToolTracker();
    tracker.trackStart({ toolCallId: 't1', toolName: 'weather', args: {} });
    tracker.forget('t1');
    expect(tracker.has('t1')).toBe(false);
  });

  it('reset clears all tracked tools', () => {
    const tracker = new ToolTracker();
    tracker.trackStart({ toolCallId: 't1', toolName: 'weather', args: {} });
    tracker.trackStart({ toolCallId: 't2', toolName: 'weather', args: {} });
    tracker.reset();
    expect(tracker.inFlightCount).toBe(0);
  });
});

describe('editOrPostMessage', () => {
  it('passes a { markdown } message through to editMessage unchanged', async () => {
    const editMessage = vi.fn().mockResolvedValue({});
    const post = vi.fn().mockResolvedValue({ id: 'new' });
    const message = { markdown: '**bold** update' };

    const id = await editOrPostMessage({
      adapter: { editMessage },
      chatThread: { id: 'thread-1', post },
      messageId: 'm1',
      message,
    });

    expect(id).toBe('m1');
    expect(editMessage).toHaveBeenCalledWith('thread-1', 'm1', message);
    expect(post).not.toHaveBeenCalled();
  });

  it('passes a { markdown } message through to post unchanged when there is no messageId', async () => {
    const editMessage = vi.fn();
    const post = vi.fn().mockResolvedValue({ id: 'new' });
    const message = { markdown: '**bold** post' };

    const id = await editOrPostMessage({
      adapter: { editMessage },
      chatThread: { id: 'thread-1', post },
      messageId: undefined,
      message,
    });

    expect(id).toBe('new');
    expect(editMessage).not.toHaveBeenCalled();
    expect(post).toHaveBeenCalledWith(message);
  });
});

describe('postFileAttachment', () => {
  it('posts the file as a markdown-shaped payload without a cast', async () => {
    const post = vi.fn().mockResolvedValue({});

    await postFileAttachment({
      chunk: { type: 'file', payload: { data: Buffer.from('abc').toString('base64'), mimeType: 'image/png' } } as any,
      chatThread: { post },
    });

    expect(post).toHaveBeenCalledTimes(1);
    const arg = post.mock.calls[0]![0];
    expect(arg.markdown).toBe(' ');
    expect(arg.files).toHaveLength(1);
    expect(arg.files[0].filename).toBe('generated.png');
    expect(arg.files[0].mimeType).toBe('image/png');
  });

  it('preserves an explicit filename from the payload (text file)', async () => {
    const post = vi.fn().mockResolvedValue({});

    await postFileAttachment({
      chunk: {
        type: 'file',
        payload: { data: Buffer.from('hello').toString('base64'), mimeType: 'text/plain', filename: 'report.txt' },
      } as any,
      chatThread: { post },
    });

    expect(post).toHaveBeenCalledTimes(1);
    const arg = post.mock.calls[0]![0];
    expect(arg.files[0].filename).toBe('report.txt');
    expect(arg.files[0].mimeType).toBe('text/plain');
  });

  it('preserves an explicit filename from the payload (PDF)', async () => {
    const post = vi.fn().mockResolvedValue({});

    await postFileAttachment({
      chunk: {
        type: 'file',
        payload: {
          data: Buffer.from('pdf-bytes').toString('base64'),
          mimeType: 'application/pdf',
          filename: 'contract.pdf',
        },
      } as any,
      chatThread: { post },
    });

    expect(post).toHaveBeenCalledTimes(1);
    const arg = post.mock.calls[0]![0];
    expect(arg.files[0].filename).toBe('contract.pdf');
    expect(arg.files[0].mimeType).toBe('application/pdf');
  });

  it('preserves an explicit filename from the payload (image)', async () => {
    const post = vi.fn().mockResolvedValue({});

    await postFileAttachment({
      chunk: {
        type: 'file',
        payload: {
          data: Buffer.from('img-bytes').toString('base64'),
          mimeType: 'image/png',
          filename: 'screenshot.png',
        },
      } as any,
      chatThread: { post },
    });

    expect(post).toHaveBeenCalledTimes(1);
    const arg = post.mock.calls[0]![0];
    expect(arg.files[0].filename).toBe('screenshot.png');
    expect(arg.files[0].mimeType).toBe('image/png');
  });

  it('falls back to generated.<ext> when no filename is provided', async () => {
    const post = vi.fn().mockResolvedValue({});

    await postFileAttachment({
      chunk: {
        type: 'file',
        payload: { data: Buffer.from('data').toString('base64'), mimeType: 'application/pdf' },
      } as any,
      chatThread: { post },
    });

    expect(post).toHaveBeenCalledTimes(1);
    const arg = post.mock.calls[0]![0];
    expect(arg.files[0].filename).toBe('generated.pdf');
  });
});

describe('extractErrorMessage', () => {
  it('returns strings as-is', () => {
    expect(extractErrorMessage('boom')).toBe('boom');
  });

  it('returns Error.message', () => {
    expect(extractErrorMessage(new Error('boom'))).toBe('boom');
  });

  it('returns MastraError-style details.errorMessage', () => {
    expect(extractErrorMessage({ details: { errorMessage: 'inner' } })).toBe('inner');
  });

  it('prefers top-level .message over details.errorMessage', () => {
    expect(extractErrorMessage({ message: 'top', details: { errorMessage: 'inner' } })).toBe('top');
  });

  it('returns the raw value when no message can be extracted', () => {
    const raw = { unknown: 'shape' };
    expect(extractErrorMessage(raw)).toBe(raw);
  });

  it('returns null/undefined unchanged', () => {
    expect(extractErrorMessage(null)).toBe(null);
    expect(extractErrorMessage(undefined)).toBe(undefined);
  });
});

describe('isBlankToolMessage', () => {
  it('treats empty and whitespace-only strings as blank', () => {
    expect(isBlankToolMessage('')).toBe(true);
    expect(isBlankToolMessage('   ')).toBe(true);
    expect(isBlankToolMessage('\n\t ')).toBe(true);
  });

  it('treats an empty markdown payload as blank', () => {
    expect(isBlankToolMessage({ markdown: '' })).toBe(true);
    expect(isBlankToolMessage({ markdown: '   ' })).toBe(true);
  });

  it('treats non-empty strings and markdown as non-blank', () => {
    expect(isBlankToolMessage('x')).toBe(false);
    expect(isBlankToolMessage({ markdown: 'x' })).toBe(false);
  });

  it('treats a card payload with no markdown field as non-blank', () => {
    expect(isBlankToolMessage({ blocks: [] } as never)).toBe(false);
  });
});

describe('renderBuiltInToolEvent resolved approval states', () => {
  // The card path renders through the lazily-loaded Chat SDK.
  beforeAll(async () => {
    await getChatModule();
  });

  const base = {
    toolCallId: 'tool-call-1',
    toolName: 'mastra_test-agent_deleteCustomer',
    displayName: 'deleteCustomer',
    argsSummary: 'id=42',
    args: { id: 42 },
  };

  it('renders `approved` as its own state, not as an actionable approval card', () => {
    const cards = JSON.stringify(renderBuiltInToolEvent({ ...base, kind: 'approved' }, 'cards'));
    expect(cards).toContain('Approved');
    // Must not fall through to the approval branch, which would leave the
    // Approve/Deny buttons on a card that has already been decided.
    expect(cards).not.toContain('Requires approval');

    const text = renderBuiltInToolEvent({ ...base, kind: 'approved' }, 'text');
    expect(typeof text).toBe('string');
    expect(text).toContain('Approved');
    expect(text).not.toContain('Requires approval');
  });

  it('renders `denied` with attribution when byUser is present', () => {
    const cards = JSON.stringify(renderBuiltInToolEvent({ ...base, kind: 'denied', byUser: 'Alice' }, 'cards'));
    expect(cards).toContain('Denied');
    expect(cards).toContain('by Alice');
    expect(cards).not.toContain('Requires approval');

    const text = renderBuiltInToolEvent({ ...base, kind: 'denied', byUser: 'Alice' }, 'text');
    expect(text).toContain('Denied by Alice');
  });

  it('renders `denied` without attribution when byUser is absent', () => {
    const text = renderBuiltInToolEvent({ ...base, kind: 'denied' }, 'text') as string;
    expect(text).toContain('Denied');
    expect(text).not.toContain('by ');
  });

  it('renders the resolved states as cards in cards mode and strings in text mode', () => {
    for (const kind of ['approved', 'denied'] as const) {
      const event: ToolDisplayEvent = { ...base, kind };
      expect(typeof renderBuiltInToolEvent(event, 'cards')).toBe('object');
      expect(typeof renderBuiltInToolEvent(event, 'text')).toBe('string');
    }
  });

  it('still renders `approval` as an actionable card regardless of mode', () => {
    const approval: ToolDisplayEvent = { ...base, kind: 'approval' };
    for (const mode of ['cards', 'text'] as const) {
      const rendered = JSON.stringify(renderBuiltInToolEvent(approval, mode));
      expect(rendered).toContain('Requires approval');
      expect(rendered).toContain(`tool_approve:${base.toolCallId}`);
      expect(rendered).toContain(`tool_deny:${base.toolCallId}`);
    }
  });

  it('never leaves Approve/Deny buttons on a resolved card', () => {
    for (const kind of ['approved', 'denied'] as const) {
      const rendered = JSON.stringify(renderBuiltInToolEvent({ ...base, kind }, 'cards'));
      expect(rendered).not.toContain(`tool_approve:${base.toolCallId}`);
      expect(rendered).not.toContain(`tool_deny:${base.toolCallId}`);
    }
  });
});
