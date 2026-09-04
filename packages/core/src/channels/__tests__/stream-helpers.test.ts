import { describe, it, expect, vi } from 'vitest';

import { ToolTracker, editOrPostMessage, extractErrorMessage, postFileAttachment } from '../stream-helpers';

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
