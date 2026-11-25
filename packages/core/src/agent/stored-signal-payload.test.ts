import { describe, expect, it } from 'vitest';

import { InMemoryAgentSignalsStorage } from '../storage/domains/agent-signals/inmemory';
import { createSignal } from './signals';
import type { CreatedAgentSignal } from './signals';
import { fromStoredSignalPayload, toStoredSignalPayload } from './stored-signal-payload';

/** What a run reads back after the store wrote the payload as JSON text, as LibSQL and Postgres do. */
function throughJsonColumn(signal: CreatedAgentSignal) {
  return fromStoredSignalPayload(JSON.parse(JSON.stringify(toStoredSignalPayload(signal))));
}

function fields(signal: CreatedAgentSignal) {
  const { toDBMessage: _a, toLLMMessage: _b, toDataPart: _c, ...rest } = signal;
  return rest;
}

describe('stored signal payload', () => {
  it('gives the run the same message the sender queued, with its dates and metadata', () => {
    const sent = createSignal({
      type: 'user',
      contents: 'Use the staging cluster',
      createdAt: new Date('2026-03-01T10:00:00.000Z'),
      acceptedAt: new Date('2026-03-01T10:00:01.000Z'),
      attributes: { priority: 'high', retries: 2, urgent: true, none: null },
      metadata: { source: 'slack', nested: { thread: 't-1' } },
      author: { id: 'user-1', name: 'Ada' },
      providerOptions: { anthropic: { cacheControl: { type: 'ephemeral' } } },
    });

    const received = throughJsonColumn(sent);

    expect(fields(received)).toEqual(fields(sent));
    expect(received.createdAt).toBeInstanceOf(Date);
    expect(received.toLLMMessage()).toEqual(sent.toLLMMessage());
    expect(received.toDBMessage({ threadId: 't', resourceId: 'r' })).toEqual(
      sent.toDBMessage({ threadId: 't', resourceId: 'r' }),
    );
  });

  it('keeps attached file bytes, including binary data the event codec cannot carry', () => {
    const bytes = new Uint8Array([0, 1, 2, 250, 255]);
    const sent = createSignal({
      type: 'user',
      contents: [
        { type: 'text', text: 'Here is the screenshot' },
        { type: 'file', data: bytes, mediaType: 'image/png', filename: 'shot.png' },
        { type: 'file', data: new URL('https://example.com/report.pdf'), mediaType: 'application/pdf' },
        { type: 'file', data: 'aGVsbG8=', mediaType: 'text/plain' },
      ],
    });

    const received = throughJsonColumn(sent);

    expect(received.contents).toEqual(sent.contents);
    const [, binary, url] = received.contents as Array<{ data: unknown }>;
    expect(binary!.data).toBeInstanceOf(Uint8Array);
    expect(url!.data).toBeInstanceOf(URL);
    expect(received.toLLMMessage()).toEqual(sent.toLLMMessage());
  });

  it('keeps transient and reminder signals as they were sent', () => {
    const reminder = createSignal({
      type: 'reactive',
      tagName: 'system-reminder',
      contents: 'Be brief',
      transient: true,
    });
    const state = createSignal({ type: 'state', contents: 'cart: 2 items' });

    expect(fields(throughJsonColumn(reminder))).toEqual(fields(reminder));
    expect(fields(throughJsonColumn(state))).toEqual(fields(state));
  });

  it('round trips through the in-memory store', async () => {
    const store = new InMemoryAgentSignalsStorage();
    const sent = createSignal({
      type: 'user',
      contents: [{ type: 'file', data: new Uint8Array([7, 8, 9]), mediaType: 'application/octet-stream' }],
    });
    await store.enqueue({
      id: sent.id,
      threadKey: 'thread',
      runId: 'run',
      scope: 'pending',
      signal: toStoredSignalPayload(sent),
    });

    const [row] = await store.claim({ threadKey: 'thread', runId: 'run', scope: 'pending' });

    expect(fields(fromStoredSignalPayload(row!.signal))).toEqual(fields(sent));
  });

  it('refuses a stored form of a format version it does not know', () => {
    const stored = toStoredSignalPayload(createSignal({ type: 'user', contents: 'hello' }));

    expect(() => fromStoredSignalPayload({ ...stored, version: 2 })).toThrow('format version 2');
    expect(() => fromStoredSignalPayload({ signal: stored.signal })).toThrow('format version undefined');
  });
});
