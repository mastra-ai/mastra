import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { EventEmitterPubSub } from '../../events/event-emitter';
import { UnixSocketPubSub } from '../../events/unix-socket-pubsub';
import { Mastra } from '../../mastra';
import { MockMemory } from '../../memory/mock';
import { Agent } from '../agent';
import { MessageList } from '../message-list';
import {
  createSignal,
  dataPartToSignal,
  mastraDBMessageToSignal,
  resolveDeliveryAttributes,
  signalToDataPartFormat,
  signalToMastraDBMessage,
} from '../signals';
import { AgentThreadStreamRuntime, agentThreadStreamRuntime } from '../thread-stream-runtime';

function createTextStreamModel(responseText: string) {
  return new MockLanguageModelV2({
    doStream: async () => ({
      rawCall: { rawPrompt: null, rawSettings: {} },
      warnings: [],
      stream: convertArrayToReadableStream([
        { type: 'stream-start', warnings: [] },
        { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
        { type: 'text-start', id: 'text-1' },
        { type: 'text-delta', id: 'text-1', delta: responseText },
        { type: 'text-end', id: 'text-1' },
        {
          type: 'finish',
          finishReason: 'stop',
          usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
        },
      ]),
    }),
  });
}

function nextTick() {
  return new Promise(resolve => setTimeout(resolve, 0));
}

async function readNextRun(iterator: AsyncIterator<any>) {
  const nextRun = await readNextRunWithParts(iterator);
  if (nextRun.done) return nextRun;
  return { value: { runId: nextRun.value.runId, text: nextRun.value.text, part: nextRun.value.part }, done: false };
}

async function readNextRunWithParts(iterator: AsyncIterator<any>) {
  let runId: string | undefined;
  let text = '';
  const parts: any[] = [];

  while (true) {
    const next = await iterator.next();
    if (next.done) return next;

    const part = next.value;
    parts.push(part);
    runId ??= part.runId;
    if (part.type === 'text-delta') {
      text += part.payload.text;
    }
    if (part.type === 'finish' || part.type === 'error' || part.type === 'abort') {
      return { value: { runId, text, part, parts }, done: false };
    }
  }
}

async function waitForActiveRun(subscription: { activeRunId: () => string | null }, timeoutMs = 500) {
  const startedAt = Date.now();
  let runId = subscription.activeRunId();
  while (!runId) {
    if (Date.now() - startedAt > timeoutMs) {
      throw new Error('Timed out waiting for active run');
    }
    await nextTick();
    runId = subscription.activeRunId();
  }
  return runId;
}

async function waitForCondition(predicate: () => boolean, timeoutMs = 500) {
  const startedAt = Date.now();
  while (!predicate()) {
    if (Date.now() - startedAt > timeoutMs) {
      throw new Error('Timed out waiting for condition');
    }
    await nextTick();
  }
}

async function withTimeout<T>(promise: Promise<T>, message: string, timeoutMs = 500): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timeout = setTimeout(() => reject(new Error(message)), timeoutMs);
      }),
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

describe('Agent signals', () => {
  beforeEach(() => {
    agentThreadStreamRuntime.resetForTests();
  });

  it('converts signals between DB, LLM, and data part formats', () => {
    const signal = createSignal({
      id: 'signal-1',
      type: 'user-message',
      contents: 'Signal contents',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      acceptedAt: new Date('2026-01-01T00:00:01.000Z'),
      attributes: { priority: 'high' },
      metadata: { source: 'test', signal: { userProvided: true } },
    });

    expect(signal.toLLMMessage()).toEqual({
      role: 'user',
      content: '<user-message priority="high">Signal contents</user-message>',
    });
    expect(signal.toDataPart()).toEqual({
      type: 'data-user-message',
      data: {
        id: 'signal-1',
        type: 'user-message',
        contents: 'Signal contents',
        createdAt: '2026-01-01T00:00:00.000Z',
        acceptedAt: '2026-01-01T00:00:01.000Z',
        attributes: { priority: 'high' },
        metadata: { source: 'test', signal: { userProvided: true } },
      },
      transient: true,
    });

    const dbMessage = signal.toDBMessage({ threadId: 'thread-1', resourceId: 'resource-1' });
    expect(dbMessage.role).toBe('signal');
    expect(dbMessage.createdAt).toEqual(new Date('2026-01-01T00:00:00.000Z'));
    expect(dbMessage.content.metadata).toEqual({
      signal: {
        id: 'signal-1',
        type: 'user-message',
        createdAt: '2026-01-01T00:00:00.000Z',
        acceptedAt: '2026-01-01T00:00:01.000Z',
        attributes: { priority: 'high' },
        metadata: { source: 'test', signal: { userProvided: true } },
      },
    });
    expect(signalToMastraDBMessage(signal).role).toBe('signal');
    expect(mastraDBMessageToSignal(dbMessage).contents).toBe('Signal contents');
    expect(mastraDBMessageToSignal(dbMessage).createdAt).toEqual(new Date('2026-01-01T00:00:00.000Z'));
    expect(mastraDBMessageToSignal(dbMessage).acceptedAt).toEqual(new Date('2026-01-01T00:00:01.000Z'));
    expect(mastraDBMessageToSignal(dbMessage).attributes).toEqual({ priority: 'high' });
    expect(mastraDBMessageToSignal(dbMessage).metadata).toEqual({ source: 'test', signal: { userProvided: true } });

    const legacyDbMessage = {
      ...dbMessage,
      content: {
        ...dbMessage.content,
        metadata: {
          signal: {
            ...(dbMessage.content.metadata!.signal as Record<string, unknown>),
            acceptedAt: undefined,
          },
        },
      },
    };
    expect(mastraDBMessageToSignal(legacyDbMessage).acceptedAt).toBeUndefined();

    expect(dataPartToSignal(signalToDataPartFormat(signal)).contents).toBe('Signal contents');
    expect(dataPartToSignal(signalToDataPartFormat(signal)).acceptedAt).toEqual(new Date('2026-01-01T00:00:01.000Z'));

    const reminderSignal = createSignal({
      id: 'signal-2',
      type: 'system-reminder',
      contents: 'Use <safe> content & continue',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      attributes: { type: 'dynamic-agents-md', path: '/tmp/AGENTS.md', enabled: true, ignored: null },
    });

    expect(reminderSignal.toLLMMessage()).toEqual({
      role: 'user',
      content:
        '<system-reminder type="dynamic-agents-md" path="/tmp/AGENTS.md" enabled="true">Use &lt;safe&gt; content &amp; continue</system-reminder>',
    });
    expect(reminderSignal.toDataPart().data.attributes).toEqual({
      type: 'dynamic-agents-md',
      path: '/tmp/AGENTS.md',
      enabled: true,
      ignored: null,
    });
    expect(mastraDBMessageToSignal(reminderSignal.toDBMessage()).attributes).toEqual({
      type: 'dynamic-agents-md',
      path: '/tmp/AGENTS.md',
      enabled: true,
      ignored: null,
    });

    const fileContents = [
      { type: 'text' as const, text: 'Review this file' },
      {
        type: 'file' as const,
        data: 'data:text/plain;base64,aGVsbG8=',
        mediaType: 'text/plain',
        filename: 'note.txt',
      },
    ];
    const fileSignal = createSignal({
      id: 'signal-3',
      type: 'user-message',
      contents: fileContents,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
    });

    // toLLMMessage emits the v5 UserModelMessage shape (uses mediaType for FilePart).
    expect(fileSignal.toLLMMessage()).toEqual({
      role: 'user',
      content: [
        { type: 'text', text: 'Review this file' },
        {
          type: 'file',
          data: 'data:text/plain;base64,aGVsbG8=',
          mediaType: 'text/plain',
          filename: 'note.txt',
        },
      ],
    });
    expect(fileSignal.toDataPart().data.contents).toEqual(fileContents);
    expect(mastraDBMessageToSignal(fileSignal.toDBMessage()).contents).toEqual(fileContents);
  });

  it('renders user-message attributes inline-wrapped for text and multimodal contents', () => {
    const stringSignal = createSignal({
      type: 'user-message',
      contents: 'Hello',
      attributes: { messageId: 'm-1', userId: 'u-1' },
    });
    expect(stringSignal.toLLMMessage()).toEqual({
      role: 'user',
      content: '<user-message messageId="m-1" userId="u-1">Hello</user-message>',
    });

    const partsTextSignal = createSignal({
      type: 'user-message',
      contents: [{ type: 'text', text: 'Hello again' }],
      attributes: { messageId: 'm-1b' },
    });
    expect(partsTextSignal.toLLMMessage()).toEqual({
      role: 'user',
      content: '<user-message messageId="m-1b">Hello again</user-message>',
    });

    const fileContents = [
      { type: 'text' as const, text: 'Look at this' },
      {
        type: 'file' as const,
        data: 'data:image/png;base64,aGVsbG8=',
        mediaType: 'image/png',
      },
    ];
    const multimodalSignal = createSignal({
      type: 'user-message',
      contents: fileContents,
      attributes: { messageId: 'm-2' },
    });
    // Multimodal: text part is inline-wrapped, file part is preserved.
    const multimodalResult = multimodalSignal.toLLMMessage();
    expect(multimodalResult.role).toBe('user');
    expect(multimodalResult.content).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'text',
          text: '<user-message messageId="m-2">Look at this</user-message>',
        }),
        expect.objectContaining({
          type: 'file',
          data: 'data:image/png;base64,aGVsbG8=',
        }),
      ]),
    );

    // file-only: no text part exists, so the marker is prepended as a synthetic text part on
    // the same message so the attributes still surface alongside the file payload.
    const fileOnlyContents = [
      { type: 'file' as const, data: 'data:image/png;base64,aGVsbG8=', mediaType: 'image/png' },
    ];
    const fileOnlySignal = createSignal({
      type: 'user-message',
      contents: fileOnlyContents,
      attributes: { messageId: 'm-2d' },
    });
    const fileOnlyResult = fileOnlySignal.toLLMMessage();
    expect(fileOnlyResult.role).toBe('user');
    expect(fileOnlyResult.content).toEqual([
      expect.objectContaining({ type: 'text', text: '<user-message messageId="m-2d" />' }),
      expect.objectContaining({ type: 'file', data: 'data:image/png;base64,aGVsbG8=' }),
    ]);

    const noAttributeSignal = createSignal({
      type: 'user-message',
      contents: 'Plain message',
    });
    expect(noAttributeSignal.toLLMMessage()).toEqual({ role: 'user', content: 'Plain message' });

    const onlyNullAttributesSignal = createSignal({
      type: 'user-message',
      contents: 'Plain message',
      attributes: { ignored: null, alsoIgnored: undefined },
    });
    expect(onlyNullAttributesSignal.toLLMMessage()).toEqual({ role: 'user', content: 'Plain message' });
  });

  it('renders system-reminder signals with multimodal contents the same way as user-message attributes', () => {
    // Text-only system-reminder still wraps even without attributes (the wrapper is the signal).
    const plainReminder = createSignal({
      type: 'system-reminder',
      contents: 'Be concise.',
    });
    expect(plainReminder.toLLMMessage()).toEqual({
      role: 'user',
      content: '<system-reminder>Be concise.</system-reminder>',
    });

    // System-reminder with multimodal contents: text part is inline-wrapped with the marker,
    // file part is preserved alongside it on the same logical turn.
    const screenshotContents = [
      { type: 'text' as const, text: 'The user is looking at this screen.' },
      {
        type: 'file' as const,
        data: 'data:image/png;base64,aGVsbG8=',
        mediaType: 'image/png',
      },
    ];
    const screenshotReminder = createSignal({
      type: 'system-reminder',
      contents: screenshotContents,
      attributes: { kind: 'screenshot' },
    });
    const screenshotResult = screenshotReminder.toLLMMessage();
    expect(screenshotResult.role).toBe('user');
    expect(screenshotResult.content).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'text',
          text: '<system-reminder kind="screenshot">The user is looking at this screen.</system-reminder>',
        }),
        expect.objectContaining({
          type: 'file',
          data: 'data:image/png;base64,aGVsbG8=',
        }),
      ]),
    );

    // System-reminder with only file parts has no text to inline-wrap, so the marker is
    // prepended as a synthetic text part on the same message.
    const fileOnlyReminderContents = [
      { type: 'file' as const, data: 'data:image/png;base64,aGVsbG8=', mediaType: 'image/png' },
    ];
    const fileOnlyReminder = createSignal({
      type: 'system-reminder',
      contents: fileOnlyReminderContents,
      attributes: { kind: 'reference-image' },
    });
    const fileOnlyResult = fileOnlyReminder.toLLMMessage();
    expect(fileOnlyResult.role).toBe('user');
    expect(fileOnlyResult.content).toEqual([
      expect.objectContaining({ type: 'text', text: '<system-reminder kind="reference-image" />' }),
      expect.objectContaining({ type: 'file', data: 'data:image/png;base64,aGVsbG8=' }),
    ]);

    // System-reminder with mixed text + file parts: the marker is inlined into the very first
    // text part, subsequent parts pass through untouched on the same logical turn.
    const mixedReminderContents = [
      { type: 'text' as const, text: 'Step one of the screen.' },
      { type: 'text' as const, text: 'Step two has this attachment.' },
      { type: 'file' as const, data: 'data:image/png;base64,aGVsbG8=', mediaType: 'image/png' },
    ];
    const mixedReminder = createSignal({
      type: 'system-reminder',
      contents: mixedReminderContents,
      attributes: { kind: 'walkthrough' },
    });
    const mixedResult = mixedReminder.toLLMMessage();
    expect(mixedResult.content).toEqual([
      expect.objectContaining({
        type: 'text',
        text: '<system-reminder kind="walkthrough">Step one of the screen.</system-reminder>',
      }),
      expect.objectContaining({ type: 'text', text: 'Step two has this attachment.' }),
      expect.objectContaining({ type: 'file', data: 'data:image/png;base64,aGVsbG8=' }),
    ]);
  });

  it('persists multimodal signal contents as faithful DB parts so UIs can render them', () => {
    const fileContents = [
      { type: 'text' as const, text: 'Look at this' },
      { type: 'file' as const, data: 'data:image/png;base64,aGVsbG8=', mediaType: 'image/png' },
    ];

    const userMessage = createSignal({
      type: 'user-message',
      contents: fileContents,
      attributes: { messageId: 'm-1' },
    });
    const userDb = userMessage.toDBMessage();
    expect(userDb.content.parts).toEqual([
      expect.objectContaining({ type: 'text', text: 'Look at this' }),
      expect.objectContaining({ type: 'file', data: 'data:image/png;base64,aGVsbG8=' }),
    ]);
    // Stash is dropped — metadata.signal carries only envelope fields (id/type/attributes/createdAt).
    const signalMeta = (userDb.content.metadata as { signal: Record<string, unknown> }).signal;
    expect(signalMeta).not.toHaveProperty('contents');
    expect(signalMeta).toMatchObject({ type: 'user-message', attributes: { messageId: 'm-1' } });

    const reminder = createSignal({
      type: 'system-reminder',
      contents: fileContents,
      attributes: { kind: 'screenshot' },
    });
    const reminderDb = reminder.toDBMessage();
    expect(reminderDb.content.parts).toEqual([
      expect.objectContaining({ type: 'text', text: 'Look at this' }),
      expect.objectContaining({ type: 'file', data: 'data:image/png;base64,aGVsbG8=' }),
    ]);

    // Empty contents still produce a single empty text part so consumers that assume non-empty parts stay happy.
    const emptyReminder = createSignal({ type: 'system-reminder', contents: '' });
    expect(emptyReminder.toDBMessage().content.parts).toEqual([{ type: 'text', text: '' }]);
  });

  it('round-trips multimodal non-user-message signals through DB without dropping file parts', () => {
    const screenshotContents = [
      { type: 'text' as const, text: 'The user is looking at this screen.' },
      { type: 'file' as const, data: 'data:image/png;base64,aGVsbG8=', mediaType: 'image/png' },
    ];
    const reminder = createSignal({
      type: 'system-reminder',
      contents: screenshotContents,
      attributes: { kind: 'screenshot' },
    });
    const rehydrated = mastraDBMessageToSignal(reminder.toDBMessage());
    expect(rehydrated.type).toBe('system-reminder');
    expect(rehydrated.contents).toEqual(screenshotContents);
    expect(rehydrated.attributes).toEqual({ kind: 'screenshot' });

    // dataPart round-trip preserves the multimodal shape too.
    const fromDataPart = dataPartToSignal(reminder.toDataPart());
    expect(fromDataPart.contents).toEqual(screenshotContents);
  });

  it('threads providerOptions through LLM message, DB storage, and rehydration', () => {
    const providerOptions = {
      openai: { reasoningEffort: 'high' },
      anthropic: { cacheControl: { type: 'ephemeral' } },
    };
    const signal = createSignal({
      type: 'user-message',
      contents: 'hello',
      providerOptions,
    });

    // LLM message: providerOptions on the CoreMessage so it flows to the model.
    const llmMessage = signal.toLLMMessage();
    expect(llmMessage).toMatchObject({ role: 'user', content: 'hello', providerOptions });

    // DB storage: content.providerMetadata (canonical location, also surfaces to useChat).
    const db = signal.toDBMessage();
    expect(db.content.providerMetadata).toEqual(providerOptions);

    // Round-trip: rehydrated signal carries providerOptions and re-emits it.
    const rehydrated = mastraDBMessageToSignal(db);
    expect(rehydrated.providerOptions).toEqual(providerOptions);
    expect(rehydrated.toLLMMessage()).toMatchObject({ providerOptions });
  });

  it('omits providerOptions on LLM / DB output when not provided', () => {
    const signal = createSignal({ type: 'user-message', contents: 'hi' });
    const llmMessage = signal.toLLMMessage();
    expect((llmMessage as { providerOptions?: unknown }).providerOptions).toBeUndefined();
    expect(signal.toDBMessage().content.providerMetadata).toBeUndefined();
  });

  it('threads per-part providerOptions through LLM, DB, and rehydration', () => {
    const partProviderOptions = { anthropic: { cacheControl: { type: 'ephemeral' } } };
    const signal = createSignal({
      type: 'user-message',
      contents: [
        { type: 'text', text: 'hello', providerOptions: partProviderOptions },
        { type: 'file', data: 'AAA=', mediaType: 'image/png' },
      ],
    });

    // LLM: parts array carries per-part providerOptions (not collapsed to bare string).
    const llmMessage = signal.toLLMMessage();
    expect(llmMessage.role).toBe('user');
    expect(Array.isArray(llmMessage.content)).toBe(true);
    const llmParts = llmMessage.content as Array<{ type: string; providerOptions?: unknown }>;
    expect(llmParts[0]).toMatchObject({ type: 'text', text: 'hello', providerOptions: partProviderOptions });
    expect(llmParts[1]).toMatchObject({ type: 'file', data: 'AAA=', mediaType: 'image/png' });

    // DB: per-part providerMetadata persisted alongside the storage part.
    const db = signal.toDBMessage();
    const textPart = db.content.parts[0] as { type: string; providerMetadata?: unknown };
    expect(textPart).toMatchObject({ type: 'text', text: 'hello', providerMetadata: partProviderOptions });

    // Round-trip: rehydrated signal restores per-part providerOptions.
    const rehydrated = mastraDBMessageToSignal(db);
    const rehydratedContents = rehydrated.contents as Array<{ type: string; providerOptions?: unknown }>;
    expect(rehydratedContents[0]).toMatchObject({ type: 'text', text: 'hello', providerOptions: partProviderOptions });
  });

  it('preserves per-part providerOptions on a single-text user-message (no bare-string collapse)', () => {
    const partProviderOptions = { anthropic: { cacheControl: { type: 'ephemeral' } } };
    const signal = createSignal({
      type: 'user-message',
      contents: [{ type: 'text', text: 'hello', providerOptions: partProviderOptions }],
    });

    const llmMessage = signal.toLLMMessage();
    // Must keep parts array — collapsing to a bare string would drop providerOptions.
    expect(Array.isArray(llmMessage.content)).toBe(true);
    const llmParts = llmMessage.content as Array<{ type: string; providerOptions?: unknown }>;
    expect(llmParts[0]).toMatchObject({ type: 'text', text: 'hello', providerOptions: partProviderOptions });
  });

  describe('legacy metadata.signal.contents rehydration', () => {
    function buildLegacyDBRow(legacyContents: unknown) {
      const row = createSignal({
        id: 'signal-legacy',
        createdAt: '2026-01-01T00:00:00.000Z',
        type: 'user-message',
        contents: 'placeholder',
      }).toDBMessage();
      row.content.metadata = {
        ...row.content.metadata,
        signal: {
          ...(row.content.metadata?.signal as Record<string, unknown>),
          contents: legacyContents,
        },
      };
      return row;
    }

    it('recovers a bare string stash', () => {
      const rehydrated = mastraDBMessageToSignal(buildLegacyDBRow('hello world'));
      expect(rehydrated.contents).toBe('hello world');
    });

    it('recovers an Array<TextPart | FilePart> stash with mediaType', () => {
      const rehydrated = mastraDBMessageToSignal(
        buildLegacyDBRow([
          { type: 'text', text: 'caption' },
          { type: 'file', data: 'BASE64', mediaType: 'image/png', filename: 'photo.png' },
        ]),
      );
      expect(rehydrated.contents).toEqual([
        { type: 'text', text: 'caption' },
        { type: 'file', data: 'BASE64', mediaType: 'image/png', filename: 'photo.png' },
      ]);
    });

    it('recovers a CoreUserMessage wrapper with text-only content', () => {
      const rehydrated = mastraDBMessageToSignal(buildLegacyDBRow({ role: 'user', content: 'hello world' }));
      expect(rehydrated.contents).toBe('hello world');
    });

    it('recovers a CoreUserMessage wrapper with mixed text + image parts', () => {
      const rehydrated = mastraDBMessageToSignal(
        buildLegacyDBRow({
          role: 'user',
          content: [
            { type: 'text', text: 'what is this?' },
            { type: 'image', image: 'BASE64', mediaType: 'image/png' },
          ],
        }),
      );
      expect(rehydrated.contents).toEqual([
        { type: 'text', text: 'what is this?' },
        { type: 'file', data: 'BASE64', mediaType: 'image/png' },
      ]);
    });

    it('recovers a CoreUserMessage[] stash from the React hook', () => {
      const rehydrated = mastraDBMessageToSignal(
        buildLegacyDBRow([
          { role: 'user', content: 'first' },
          { role: 'user', content: [{ type: 'text', text: 'second' }] },
        ]),
      );
      expect(rehydrated.contents).toEqual([
        { type: 'text', text: 'first' },
        { type: 'text', text: 'second' },
      ]);
    });

    it('falls back to canonical content.parts when the stash is unrecognisable', () => {
      const row = buildLegacyDBRow({ totally: 'unrelated' });
      row.content.parts = [{ type: 'text', text: 'from canonical parts' }];
      const rehydrated = mastraDBMessageToSignal(row);
      expect(rehydrated.contents).toBe('from canonical parts');
    });

    it('prefers a valid multimodal stash over flattened-text content.parts (main-era rows)', () => {
      // Main wrote the full original input to metadata.signal.contents and a flattened text
      // projection to content.parts. If we preferred parts here we'd silently drop the file
      // payload on rehydrate.
      const row = buildLegacyDBRow([
        { type: 'text', text: 'caption' },
        { type: 'file', data: 'BASE64', mediaType: 'image/png', filename: 'photo.png' },
      ]);
      row.content.parts = [{ type: 'text', text: 'caption' }];
      const rehydrated = mastraDBMessageToSignal(row);
      expect(rehydrated.contents).toEqual([
        { type: 'text', text: 'caption' },
        { type: 'file', data: 'BASE64', mediaType: 'image/png', filename: 'photo.png' },
      ]);
    });
  });

  it('rejects invalid XML names for contextual signal markup', () => {
    expect(() =>
      createSignal({
        type: 'system reminder',
        contents: 'invalid tag name',
      }).toLLMMessage(),
    ).toThrow('Invalid signal XML tag name: system reminder');

    expect(() =>
      createSignal({
        type: 'system-reminder',
        contents: 'invalid attribute name',
        attributes: { 'bad attr': 'value' },
      }).toLLMMessage(),
    ).toThrow('Invalid signal XML attribute name: bad attr');
  });

  it('subscribes to a future thread run', async () => {
    const agent = new Agent({
      id: 'future-thread-agent',
      name: 'Future Thread Agent',
      instructions: 'Test',
      model: createTextStreamModel('future response'),
    });

    const subscription = await agent.subscribeToThread({
      threadId: 'future-thread',
      resourceId: 'future-user',
    });
    const nextRun = readNextRun(subscription.stream[Symbol.asyncIterator]());

    const stream = await agent.stream('Hello', {
      memory: { thread: 'future-thread', resource: 'future-user' },
    });

    const subscribedRun = await nextRun;
    expect(subscribedRun.value.runId).toBe(stream.runId);
    expect(subscribedRun.value.text).toBe('future response');

    subscription.unsubscribe();
  });

  it('delivers each thread run to multiple same-runtime subscribers', async () => {
    const runtime = new AgentThreadStreamRuntime();
    const agent = { id: 'multi-subscriber-thread-agent' } as Agent<any, any, any, any>;
    const threadId = 'multi-subscriber-thread';
    const resourceId = 'multi-subscriber-user';

    const registerRun = (runNumber: number) => {
      const runId = `multi-subscriber-run-${runNumber}`;
      let finish!: () => void;
      const finished = new Promise<void>(resolve => {
        finish = resolve;
      });
      const parts = [
        { type: 'start', runId },
        { type: 'text-start', runId, payload: { id: `text-${runNumber}` } },
        { type: 'text-delta', runId, payload: { id: `text-${runNumber}`, text: `response ${runNumber}` } },
        { type: 'text-end', runId, payload: { id: `text-${runNumber}` } },
        {
          type: 'finish',
          runId,
          payload: { usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 }, finishReason: 'stop' },
        },
      ];
      const fullStream = new ReadableStream({
        start(controller) {
          setTimeout(() => {
            for (const part of parts) controller.enqueue(part);
            controller.close();
            finish();
          }, 25);
        },
      });

      runtime.registerRun(
        agent,
        {
          runId,
          status: 'running',
          fullStream,
          _waitUntilFinished: () => finished,
        } as any,
        { memory: { thread: threadId, resource: resourceId } } as any,
      );
      return runId;
    };

    const firstSubscription = await runtime.subscribeToThread(agent, { threadId, resourceId });
    const secondSubscription = await runtime.subscribeToThread(agent, { threadId, resourceId });
    const firstIterator = firstSubscription.stream[Symbol.asyncIterator]();
    const secondIterator = secondSubscription.stream[Symbol.asyncIterator]();

    try {
      const firstSubscriberRun1 = readNextRun(firstIterator);
      const secondSubscriberRun1 = readNextRun(secondIterator);
      const runId1 = registerRun(1);

      const [run1a, run1b] = await Promise.all([
        withTimeout(firstSubscriberRun1, 'Timed out waiting for first subscriber to receive run 1'),
        withTimeout(secondSubscriberRun1, 'Timed out waiting for second subscriber to receive run 1'),
      ]);
      expect(run1a.value).toMatchObject({ runId: runId1, text: 'response 1' });
      expect(run1b.value).toMatchObject({ runId: runId1, text: 'response 1' });

      const firstSubscriberRun2 = readNextRun(firstIterator);
      const secondSubscriberRun2 = readNextRun(secondIterator);
      const runId2 = registerRun(2);

      const [run2a, run2b] = await Promise.all([
        withTimeout(firstSubscriberRun2, 'Timed out waiting for first subscriber to receive run 2'),
        withTimeout(secondSubscriberRun2, 'Timed out waiting for second subscriber to receive run 2'),
      ]);
      expect(run2a.value).toMatchObject({ runId: runId2, text: 'response 2' });
      expect(run2b.value).toMatchObject({ runId: runId2, text: 'response 2' });
    } finally {
      firstSubscription.unsubscribe();
      secondSubscription.unsubscribe();
    }
  });

  it('keeps multicast thread streams alive when one subscriber unsubscribes mid-run', async () => {
    const runtime = new AgentThreadStreamRuntime();
    const agent = { id: 'subscriber-cancel-agent' } as Agent<any, any, any, any>;
    const threadId = 'subscriber-cancel-thread';
    const resourceId = 'subscriber-cancel-user';
    const runId = 'subscriber-cancel-run';
    let finish!: () => void;
    const finished = new Promise<void>(resolve => {
      finish = resolve;
    });
    const parts = [
      { type: 'start', runId },
      { type: 'text-start', runId, payload: { id: 'text-1' } },
      { type: 'text-delta', runId, payload: { id: 'text-1', text: 'still running' } },
      { type: 'text-end', runId, payload: { id: 'text-1' } },
      {
        type: 'finish',
        runId,
        payload: { usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 }, finishReason: 'stop' },
      },
    ];
    const fullStream = new ReadableStream({
      async start(controller) {
        for (const part of parts) {
          await new Promise(resolve => setTimeout(resolve, 5));
          controller.enqueue(part);
        }
        controller.close();
        finish();
      },
    });

    const firstSubscription = await runtime.subscribeToThread(agent, { threadId, resourceId });
    const secondSubscription = await runtime.subscribeToThread(agent, { threadId, resourceId });
    const firstIterator = firstSubscription.stream[Symbol.asyncIterator]();
    const secondIterator = secondSubscription.stream[Symbol.asyncIterator]();

    try {
      const secondRun = readNextRun(secondIterator);
      runtime.registerRun(
        agent,
        {
          runId,
          status: 'running',
          fullStream,
          _waitUntilFinished: () => finished,
        } as any,
        { memory: { thread: threadId, resource: resourceId } } as any,
      );

      const firstPart = await withTimeout(firstIterator.next(), 'Timed out waiting for first subscriber part');
      expect(firstPart.value).toMatchObject({ type: 'start', runId });
      await firstIterator.return?.();
      firstSubscription.unsubscribe();

      await expect(
        withTimeout(secondRun, 'Timed out waiting for second subscriber to finish run'),
      ).resolves.toMatchObject({
        value: { runId, text: 'still running' },
        done: false,
      });
    } finally {
      firstSubscription.unsubscribe();
      secondSubscription.unsubscribe();
    }
  });

  it('starts an idle thread run when a user-message signal is sent', async () => {
    const agent = new Agent({
      id: 'idle-signal-agent',
      name: 'Idle Signal Agent',
      instructions: 'Test',
      model: createTextStreamModel('signal response'),
    });

    const subscription = await agent.subscribeToThread({
      threadId: 'idle-thread',
      resourceId: 'idle-user',
    });
    const nextRun = readNextRunWithParts(subscription.stream[Symbol.asyncIterator]());

    const signalResult = await agent.sendSignal(
      { type: 'user-message', contents: 'Hello from signal' },
      {
        resourceId: 'idle-user',
        threadId: 'idle-thread',
        ifIdle: { streamOptions: { memory: { resource: 'idle-user', thread: 'idle-thread' } } },
      },
    );

    const subscribedRun = await nextRun;
    expect(signalResult).toEqual(expect.objectContaining({ accepted: true, runId: subscribedRun.value.runId }));
    expect(signalResult.signal.id).toBeDefined();
    expect(signalResult.signal.acceptedAt).toBeInstanceOf(Date);
    expect(subscribedRun.value.text).toBe('signal response');
    const signalPart = subscribedRun.value.parts.find((part: any) => part.type === 'data-user-message');
    expect(signalPart?.data).toMatchObject({
      id: signalResult.signal.id,
      contents: 'Hello from signal',
      acceptedAt: signalResult.signal.acceptedAt?.toISOString(),
    });
    expect(signalPart?.data.createdAt).toBeDefined();
    expect(signalPart?.transient).toBe(true);

    subscription.unsubscribe();
  });

  it('starts an idle thread run by default when a thread-targeted signal is sent', async () => {
    const agent = new Agent({
      id: 'idle-signal-without-options-agent',
      name: 'Idle Signal Without Options Agent',
      instructions: 'Test',
      model: createTextStreamModel('signal response'),
    });

    const result = await agent.sendSignal(
      { type: 'user-message', contents: 'Hello from signal' },
      { resourceId: 'idle-user', threadId: 'idle-thread' },
    );

    expect(result).toEqual(expect.objectContaining({ accepted: true }));
  });

  it('persists idle data parts as a new assistant message without appending to stale history', async () => {
    let streamCount = 0;
    const memory = new MockMemory();
    await memory.createThread({ threadId: 'idle-data-part-thread', resourceId: 'idle-data-part-user' });
    await memory.saveMessages({
      messages: [
        {
          id: 'historical-assistant',
          role: 'assistant',
          createdAt: new Date('2026-01-01T00:00:00.000Z'),
          threadId: 'idle-data-part-thread',
          resourceId: 'idle-data-part-user',
          content: {
            format: 2,
            parts: [{ type: 'text', text: 'historical response' }],
            content: 'historical response',
          },
        },
      ],
    });

    const agent = new Agent({
      id: 'idle-data-part-agent',
      name: 'Idle Data Part Agent',
      instructions: 'Test',
      model: new MockLanguageModelV2({
        doStream: async () => {
          streamCount += 1;
          return {
            rawCall: { rawPrompt: null, rawSettings: {} },
            warnings: [],
            stream: convertArrayToReadableStream([{ type: 'stream-start', warnings: [] }]),
          };
        },
      }),
      memory,
    });

    const result = agent.sendDataPart(
      { type: 'data-om-observation', data: { observationId: 'obs-1' } },
      { resourceId: 'idle-data-part-user', threadId: 'idle-data-part-thread' },
    );
    await expect(result.persisted).resolves.toBeUndefined();

    const recalled = await memory.recall({ threadId: 'idle-data-part-thread', resourceId: 'idle-data-part-user' });
    expect(streamCount).toBe(0);
    expect(recalled.messages).toHaveLength(2);
    expect(recalled.messages[0]?.id).toBe('historical-assistant');
    expect(recalled.messages[0]?.content.parts).toEqual([{ type: 'text', text: 'historical response' }]);
    expect(recalled.messages[1]?.role).toBe('assistant');
    expect(recalled.messages[1]?.content.parts).toEqual([
      { type: 'data-om-observation', data: { observationId: 'obs-1' } },
    ]);
  });

  it('appends active-run data parts to the current assistant message', async () => {
    const memory = new MockMemory();
    const messageList = new MessageList().add(
      {
        id: 'active-response-message',
        role: 'assistant',
        type: 'text',
        threadId: 'active-data-part-thread',
        resourceId: 'active-data-part-user',
        content: { format: 2, parts: [{ type: 'text', text: 'active response' }] },
        createdAt: new Date(),
      },
      'response',
    );
    const runtime = new AgentThreadStreamRuntime();
    const neverFinishes = new Promise<any>(() => {});

    runtime.registerRun(
      { id: 'active-data-part-agent', getMemory: async () => memory } as any,
      {
        runId: 'active-data-part-run',
        messageId: 'active-response-message',
        messageList,
        status: 'running',
        _waitUntilFinished: () => neverFinishes,
      } as any,
      {
        runId: 'active-data-part-run',
        memory: { thread: 'active-data-part-thread', resource: 'active-data-part-user' },
      } as any,
    );

    const result = runtime.sendDataPart(
      { id: 'active-data-part-agent', getMemory: async () => memory } as any,
      { type: 'data-om-observation', data: { observationId: 'active-obs' } },
      { threadId: 'active-data-part-thread', resourceId: 'active-data-part-user' },
    );
    await expect(result.persisted).resolves.toBeUndefined();

    expect(messageList.get.response.db()[0]?.content.parts).toMatchObject([
      { type: 'text', text: 'active response' },
      { type: 'data-om-observation', data: { observationId: 'active-obs' } },
    ]);
    const recalled = await memory.recall({ threadId: 'active-data-part-thread', resourceId: 'active-data-part-user' });
    expect(recalled.messages).toHaveLength(0);
  });

  it('persists an idle signal without waking the agent when idle behavior is persist', async () => {
    let streamCount = 0;
    const memory = new MockMemory();
    await memory.createThread({ threadId: 'idle-persist-thread', resourceId: 'idle-persist-user' });
    const agent = new Agent({
      id: 'idle-persist-agent',
      name: 'Idle Persist Agent',
      instructions: 'Test',
      model: new MockLanguageModelV2({
        doStream: async () => {
          streamCount += 1;
          return {
            rawCall: { rawPrompt: null, rawSettings: {} },
            warnings: [],
            stream: convertArrayToReadableStream([{ type: 'stream-start', warnings: [] }]),
          };
        },
      }),
      memory,
    });

    const result = agent.sendSignal(
      { type: 'user-message', contents: 'persist without waking' },
      { resourceId: 'idle-persist-user', threadId: 'idle-persist-thread', ifIdle: { behavior: 'persist' } },
    );
    await expect(result.persisted).resolves.toBeUndefined();

    const recalled = await memory.recall({ threadId: 'idle-persist-thread', resourceId: 'idle-persist-user' });
    expect(streamCount).toBe(0);
    expect(recalled.messages).toHaveLength(1);
    // Stash dropped; payload lives in content.parts now.
    expect(recalled.messages[0]?.content.metadata?.signal).toMatchObject({ type: 'user-message' });
    expect(recalled.messages[0]?.content.parts).toEqual(
      expect.arrayContaining([expect.objectContaining({ type: 'text', text: 'persist without waking' })]),
    );
  });

  it('discards an active signal when active behavior is discard', async () => {
    let releaseFirst!: () => void;
    const firstFinished = new Promise<void>(resolve => {
      releaseFirst = resolve;
    });
    let streamCount = 0;
    const prompts: any[][] = [];

    const agent = new Agent({
      id: 'active-discard-agent',
      name: 'Active Discard Agent',
      instructions: 'Test',
      model: new MockLanguageModelV2({
        doStream: async ({ prompt }) => {
          streamCount += 1;
          prompts.push(prompt);
          return {
            rawCall: { rawPrompt: null, rawSettings: {} },
            warnings: [],
            stream: new ReadableStream({
              async start(controller) {
                controller.enqueue({ type: 'stream-start', warnings: [] });
                controller.enqueue({
                  type: 'response-metadata',
                  id: `discard-${streamCount}`,
                  modelId: 'mock-model-id',
                  timestamp: new Date(0),
                });
                controller.enqueue({ type: 'text-start', id: 'text-1' });
                controller.enqueue({ type: 'text-delta', id: 'text-1', delta: 'first response' });
                controller.enqueue({ type: 'text-end', id: 'text-1' });
                if (streamCount === 1) {
                  await firstFinished;
                }
                controller.enqueue({
                  type: 'finish',
                  finishReason: 'stop',
                  usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
                });
                controller.close();
              },
            }),
          };
        },
      }),
    });

    const stream = await agent.stream('Hello', {
      memory: { thread: 'active-discard-thread', resource: 'active-discard-user' },
    });
    await agent.sendSignal(
      { type: 'user-message', contents: 'discard while running' },
      { resourceId: 'active-discard-user', threadId: 'active-discard-thread', ifActive: { behavior: 'discard' } },
    );

    releaseFirst();
    await expect(stream.text).resolves.toBe('first response');
    expect(streamCount).toBe(1);
    expect(JSON.stringify(prompts)).not.toContain('discard while running');
  });

  it('routes active-run signals across runtime instances through PubSub', async () => {
    const pubsub = new EventEmitterPubSub();
    const ownerRuntime = new AgentThreadStreamRuntime();
    const senderRuntime = new AgentThreadStreamRuntime();
    const owner = new Agent({
      id: 'remote-signal-agent',
      name: 'Remote Signal Owner Agent',
      instructions: 'Test',
      model: createTextStreamModel('owner response'),
    });
    const sender = new Agent({
      id: 'remote-signal-agent',
      name: 'Remote Signal Sender Agent',
      instructions: 'Test',
      model: createTextStreamModel('sender response'),
    });
    let finishRun!: () => void;
    const output = {
      runId: 'remote-run-1',
      status: 'running',
      fullStream: (async function* () {})(),
      _waitUntilFinished: () => new Promise<void>(resolve => (finishRun = resolve)),
    } as any;

    const ownerSubscription = await ownerRuntime.subscribeToThread(
      owner,
      {
        resourceId: 'remote-resource',
        threadId: 'remote-thread',
      },
      pubsub,
    );
    const senderSubscription = await senderRuntime.subscribeToThread(
      sender,
      {
        resourceId: 'remote-resource',
        threadId: 'remote-thread',
      },
      pubsub,
    );

    ownerRuntime.registerRun(
      owner,
      output,
      { runId: 'remote-run-1', memory: { resource: 'remote-resource', thread: 'remote-thread' } } as any,
      pubsub,
    );
    await waitForCondition(() => senderSubscription.activeRunId() === 'remote-run-1');

    let waitResolved = false;
    const waitForRemoteRun = senderRuntime
      .waitForCrossAgentThreadRun(
        new Agent({
          id: 'remote-other-agent',
          name: 'Remote Other Agent',
          instructions: 'Test',
          model: createTextStreamModel('other response'),
        }),
        { memory: { resource: 'remote-resource', thread: 'remote-thread' } },
        pubsub,
      )
      .then(() => {
        waitResolved = true;
      });
    await nextTick();
    expect(waitResolved).toBe(false);

    const result = senderRuntime.sendSignal(
      sender,
      { type: 'user-message', contents: [{ role: 'user', content: 'remote follow-up' }] },
      { resourceId: 'remote-resource', threadId: 'remote-thread' },
      pubsub,
    );

    expect(result.accepted).toBe(true);
    await waitForCondition(() => ownerRuntime.drainPendingSignals('remote-run-1', pubsub).length === 1);

    finishRun();
    await waitForRemoteRun;
    ownerSubscription.unsubscribe();
    senderSubscription.unsubscribe();
  });

  it.runIf(process.platform !== 'win32')(
    'broadcasts subscribed thread stream parts across UnixSocketPubSub runtime instances',
    async () => {
      const tempDir = await mkdtemp(join(tmpdir(), 'mastra-agent-signals-'));
      const ownerPubSub = new UnixSocketPubSub(join(tempDir, 'signals.sock'));
      const followerPubSub = new UnixSocketPubSub(join(tempDir, 'signals.sock'));
      const ownerRuntime = new AgentThreadStreamRuntime();
      const followerRuntime = new AgentThreadStreamRuntime();
      const owner = new Agent({
        id: 'unix-stream-agent',
        name: 'Unix Stream Owner Agent',
        instructions: 'Test',
        model: createTextStreamModel('owner response'),
      });
      const follower = new Agent({
        id: 'unix-stream-agent',
        name: 'Unix Stream Follower Agent',
        instructions: 'Test',
        model: createTextStreamModel('follower response'),
      });
      let finishRun!: () => void;
      const output = {
        runId: 'unix-run-1',
        status: 'running',
        fullStream: (async function* () {
          yield { type: 'text-delta', runId: 'unix-run-1', payload: { text: 'hello over uds' } };
          yield { type: 'finish', runId: 'unix-run-1', payload: {} };
        })(),
        _waitUntilFinished: () => new Promise<void>(resolve => (finishRun = resolve)),
      } as any;

      try {
        const ownerSubscription = await ownerRuntime.subscribeToThread(
          owner,
          { resourceId: 'unix-resource', threadId: 'unix-thread' },
          ownerPubSub,
        );
        const followerSubscription = await followerRuntime.subscribeToThread(
          follower,
          { resourceId: 'unix-resource', threadId: 'unix-thread' },
          followerPubSub,
        );
        const ownerRun = readNextRunWithParts(ownerSubscription.stream[Symbol.asyncIterator]());
        const followerRun = readNextRunWithParts(followerSubscription.stream[Symbol.asyncIterator]());

        ownerRuntime.registerRun(
          owner,
          output,
          { runId: 'unix-run-1', memory: { resource: 'unix-resource', thread: 'unix-thread' } } as any,
          ownerPubSub,
        );

        await expect(ownerRun).resolves.toMatchObject({ value: { text: 'hello over uds' }, done: false });
        await expect(followerRun).resolves.toMatchObject({ value: { text: 'hello over uds' }, done: false });
        finishRun();
        ownerSubscription.unsubscribe();
        followerSubscription.unsubscribe();
      } finally {
        await Promise.allSettled([ownerPubSub.close(), followerPubSub.close()]);
        await rm(tempDir, { recursive: true, force: true });
      }
    },
  );

  it.runIf(process.platform !== 'win32')(
    'broadcasts to a remote subscriber without a same-runtime subscriber',
    async () => {
      const tempDir = await mkdtemp(join(tmpdir(), 'mastra-agent-remote-only-'));
      const ownerPubSub = new UnixSocketPubSub(join(tempDir, 'signals.sock'));
      const followerPubSub = new UnixSocketPubSub(join(tempDir, 'signals.sock'));
      const ownerRuntime = new AgentThreadStreamRuntime();
      const followerRuntime = new AgentThreadStreamRuntime();
      const owner = { id: 'remote-only-agent' } as Agent<any, any, any, any>;
      const follower = { id: 'remote-only-agent' } as Agent<any, any, any, any>;
      const runId = 'remote-only-run';
      let finishRun!: () => void;
      const output = {
        runId,
        status: 'running',
        fullStream: (async function* () {
          yield { type: 'text-delta', runId, payload: { text: 'remote only response' } };
          yield { type: 'finish', runId, payload: {} };
        })(),
        _waitUntilFinished: () => new Promise<void>(resolve => (finishRun = resolve)),
      } as any;

      try {
        const followerSubscription = await followerRuntime.subscribeToThread(
          follower,
          { resourceId: 'remote-only-resource', threadId: 'remote-only-thread' },
          followerPubSub,
        );
        const followerRun = readNextRun(followerSubscription.stream[Symbol.asyncIterator]());

        ownerRuntime.registerRun(
          owner,
          output,
          { runId, memory: { resource: 'remote-only-resource', thread: 'remote-only-thread' } } as any,
          ownerPubSub,
        );

        await expect(withTimeout(followerRun, 'Timed out waiting for remote-only subscriber')).resolves.toMatchObject({
          value: { runId, text: 'remote only response' },
          done: false,
        });
        finishRun();
        followerSubscription.unsubscribe();
      } finally {
        await Promise.allSettled([ownerPubSub.close(), followerPubSub.close()]);
        await rm(tempDir, { recursive: true, force: true });
      }
    },
  );

  it('supports cross-instance thread subscriptions through an injected PubSub without Mastra', async () => {
    const pubsub = new EventEmitterPubSub();
    const runner = new Agent({
      id: 'standalone-shared-agent',
      name: 'Standalone Shared Runner Agent',
      instructions: 'Test',
      model: createTextStreamModel('standalone shared response'),
      pubsub,
    });
    const observer = new Agent({
      id: 'standalone-shared-agent',
      name: 'Standalone Shared Observer Agent',
      instructions: 'Test',
      model: createTextStreamModel('standalone observer response'),
      pubsub,
    });

    const subscription = await observer.subscribeToThread({
      threadId: 'standalone-shared-thread',
      resourceId: 'standalone-shared-user',
    });
    const iterator = subscription.stream[Symbol.asyncIterator]();
    const firstRunPromise = readNextRun(iterator);

    const stream = await runner.stream('Hello', {
      memory: { thread: 'standalone-shared-thread', resource: 'standalone-shared-user' },
    });

    const subscribedRun = await firstRunPromise;
    expect(subscribedRun.value.runId).toBe(stream.runId);
    expect(subscribedRun.value.text).toBe('standalone shared response');

    const secondRunPromise = readNextRun(iterator);
    const signalResult = await runner.sendSignal(
      { type: 'user-message', contents: 'Hello from standalone shared signal' },
      {
        resourceId: 'standalone-shared-user',
        threadId: 'standalone-shared-thread',
        ifIdle: {
          streamOptions: { memory: { resource: 'standalone-shared-user', thread: 'standalone-shared-thread' } },
        },
      },
    );
    const signalRun = await secondRunPromise;
    expect(signalResult).toEqual(expect.objectContaining({ accepted: true, runId: signalRun.value.runId }));
    expect(signalResult.signal.id).toBeDefined();
    expect(signalRun.value.text).toBe('standalone shared response');

    subscription.unsubscribe();
  });

  it('propagates standalone parent pubsub to child agents without their own pubsub', async () => {
    const pubsub = new EventEmitterPubSub();
    const child = new Agent({
      id: 'standalone-child-agent',
      name: 'Standalone Child Agent',
      instructions: 'Test',
      model: createTextStreamModel('child response'),
    });
    const parent = new Agent({
      id: 'standalone-parent-agent',
      name: 'Standalone Parent Agent',
      instructions: 'Test',
      model: createTextStreamModel('parent response'),
      pubsub,
      agents: { child },
    });

    await parent.listAgents();

    expect(child.getPubSub()).toBe(pubsub);

    const secondPubSub = new EventEmitterPubSub();
    const secondParent = new Agent({
      id: 'second-standalone-parent-agent',
      name: 'Second Standalone Parent Agent',
      instructions: 'Test',
      model: createTextStreamModel('second parent response'),
      pubsub: secondPubSub,
      agents: { child },
    });

    await secondParent.listAgents();

    expect(child.getPubSub()).toBe(secondPubSub);
  });

  it('isolates standalone agents that use different injected pubsubs', async () => {
    const runner = new Agent({
      id: 'standalone-isolated-agent',
      name: 'Standalone Isolated Runner Agent',
      instructions: 'Test',
      model: createTextStreamModel('isolated response'),
      pubsub: new EventEmitterPubSub(),
    });
    const observer = new Agent({
      id: 'standalone-isolated-agent',
      name: 'Standalone Isolated Observer Agent',
      instructions: 'Test',
      model: createTextStreamModel('isolated observer response'),
      pubsub: new EventEmitterPubSub(),
    });

    const subscription = await observer.subscribeToThread({
      threadId: 'standalone-isolated-thread',
      resourceId: 'standalone-isolated-user',
    });
    const iterator = subscription.stream[Symbol.asyncIterator]();
    const nextRunPromise = readNextRun(iterator);

    await runner.stream('Hello', {
      memory: { thread: 'standalone-isolated-thread', resource: 'standalone-isolated-user' },
    });

    await runner.getPubSub()?.flush?.();
    const result = await Promise.race([
      nextRunPromise.then(() => 'delivered'),
      new Promise<'timeout'>(resolve => setTimeout(() => resolve('timeout'), 100)),
    ]);
    expect(result).toBe('timeout');

    subscription.unsubscribe();
    await nextRunPromise;
  });

  it('supports cross-instance thread subscriptions through the Mastra runtime', async () => {
    const pubsub = new EventEmitterPubSub();
    const runner = new Agent({
      id: 'shared-agent',
      name: 'Shared Runner Agent',
      instructions: 'Test',
      model: createTextStreamModel('shared response'),
    });
    const observer = new Agent({
      id: 'shared-agent',
      name: 'Shared Observer Agent',
      instructions: 'Test',
      model: createTextStreamModel('observer response'),
    });
    new Mastra({ agents: { runner, observer }, logger: false, pubsub });
    expect(runner.getPubSub()).toBe(pubsub);
    expect(observer.getPubSub()).toBe(pubsub);

    const subscription = await observer.subscribeToThread({
      threadId: 'shared-thread',
      resourceId: 'shared-user',
    });
    const iterator = subscription.stream[Symbol.asyncIterator]();
    const firstRunPromise = readNextRun(iterator);

    const stream = await runner.stream('Hello', {
      memory: { thread: 'shared-thread', resource: 'shared-user' },
    });

    const subscribedRun = await firstRunPromise;
    expect(subscribedRun.value.runId).toBe(stream.runId);
    expect(subscribedRun.value.text).toBe('shared response');

    const secondRunPromise = readNextRun(iterator);
    const signalResult = await runner.sendSignal(
      { type: 'user-message', contents: 'Hello from shared signal' },
      {
        resourceId: 'shared-user',
        threadId: 'shared-thread',
        ifIdle: { streamOptions: { memory: { resource: 'shared-user', thread: 'shared-thread' } } },
      },
    );
    const signalRun = await secondRunPromise;
    expect(signalResult).toEqual(expect.objectContaining({ accepted: true, runId: signalRun.value.runId }));
    expect(signalResult.signal.id).toBeDefined();
    expect(signalRun.value.text).toBe('shared response');

    subscription.unsubscribe();
  });

  it('drains multiple user-message signals into an active same-agent thread run without merging them into users', async () => {
    let releaseFirst!: () => void;
    const firstFinished = new Promise<void>(resolve => {
      releaseFirst = resolve;
    });
    let releaseSecond!: () => void;
    const secondFinished = new Promise<void>(resolve => {
      releaseSecond = resolve;
    });
    let streamCount = 0;
    const prompts: any[][] = [];

    const model = new MockLanguageModelV2({
      doStream: async ({ prompt }) => {
        streamCount += 1;
        const callIndex = streamCount;
        prompts.push(prompt);
        const responseText =
          callIndex === 1 ? 'first response' : callIndex === 2 ? 'first signal response' : 'second signal response';

        return {
          rawCall: { rawPrompt: null, rawSettings: {} },
          warnings: [],
          stream: new ReadableStream({
            async start(controller) {
              controller.enqueue({ type: 'stream-start', warnings: [] });
              controller.enqueue({
                type: 'response-metadata',
                id: `id-${callIndex}`,
                modelId: 'mock-model-id',
                timestamp: new Date(0),
              });
              controller.enqueue({ type: 'text-start', id: `text-${callIndex}` });
              controller.enqueue({ type: 'text-delta', id: `text-${callIndex}`, delta: responseText });
              controller.enqueue({ type: 'text-end', id: `text-${callIndex}` });
              if (callIndex === 1) {
                await firstFinished;
              }
              if (callIndex === 2) {
                await secondFinished;
              }
              controller.enqueue({
                type: 'finish',
                finishReason: 'stop',
                usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
              });
              controller.close();
            },
          }),
        };
      },
    });

    const memory = new MockMemory();
    const agent = new Agent({
      id: 'active-signal-agent',
      name: 'Active Signal Agent',
      instructions: 'Test',
      model,
      memory,
    });

    const subscription = await agent.subscribeToThread({
      threadId: 'active-thread',
      resourceId: 'active-user',
    });
    const iterator = subscription.stream[Symbol.asyncIterator]();
    const firstRunPromise = readNextRun(iterator);

    const stream = await agent.stream('Hello', {
      memory: { thread: 'active-thread', resource: 'active-user' },
    });
    await expect(waitForActiveRun(subscription)).resolves.toBe(stream.runId);

    const firstSignalResult = await agent.sendSignal(
      { type: 'user-message', contents: 'First signal while running' },
      { resourceId: 'active-user', threadId: 'active-thread' },
    );
    expect(firstSignalResult).toEqual(expect.objectContaining({ accepted: true, runId: stream.runId }));
    expect(firstSignalResult.signal.id).toBeDefined();

    releaseFirst();
    await waitForCondition(() => streamCount === 2);

    const secondSignalResult = await agent.sendSignal(
      { type: 'user-message', contents: 'Second signal while running' },
      { resourceId: 'active-user', threadId: 'active-thread' },
    );
    expect(secondSignalResult).toEqual(expect.objectContaining({ accepted: true, runId: stream.runId }));
    expect(secondSignalResult.signal.id).toBeDefined();
    expect(secondSignalResult.signal.id).not.toBe(firstSignalResult.signal.id);

    releaseSecond();
    const firstRun = await firstRunPromise;
    expect(firstRun.value.text).toBe('first responsefirst signal responsesecond signal response');
    expect(streamCount).toBe(3);
    expect(JSON.stringify(prompts[1])).toContain('First signal while running');
    expect(JSON.stringify(prompts[1])).not.toContain('Second signal while running');
    expect(JSON.stringify(prompts[2])).toContain('First signal while running');
    expect(JSON.stringify(prompts[2])).toContain('Second signal while running');

    await stream.consumeStream();
    const recalled = await memory.recall({ threadId: 'active-thread', resourceId: 'active-user' });
    expect(recalled.messages.map(message => message.role)).toEqual([
      'user',
      'assistant',
      'signal',
      'assistant',
      'signal',
      'assistant',
    ]);
    expect(recalled.messages.map(message => message.content.parts.map(part => part.type))).toEqual([
      ['text'],
      ['text'],
      ['text'],
      ['text'],
      ['text'],
      ['text'],
    ]);
    expect(
      recalled.messages.map(message =>
        message.content.parts.map(part => (part.type === 'text' ? part.text : '')).join(''),
      ),
    ).toEqual([
      'Hello',
      'first response',
      'First signal while running',
      'first signal response',
      'Second signal while running',
      'second signal response',
    ]);

    const [userMessage, firstAssistant, firstSignal, secondAssistant, secondSignal, thirdAssistant] = recalled.messages;
    expect(firstSignal.id).toBe(firstSignalResult.signal.id);
    expect(secondSignal.id).toBe(secondSignalResult.signal.id);
    expect(firstSignal.id).not.toBe(userMessage.id);
    expect(secondSignal.id).not.toBe(userMessage.id);
    expect(firstSignal.createdAt.getTime()).toBeGreaterThan(firstAssistant.createdAt.getTime());
    expect(firstSignal.createdAt.getTime()).toBeLessThanOrEqual(secondAssistant.createdAt.getTime());
    expect(secondSignal.createdAt.getTime()).toBeGreaterThan(secondAssistant.createdAt.getTime());
    expect(secondSignal.createdAt.getTime()).toBeLessThanOrEqual(thirdAssistant.createdAt.getTime());

    const firstRecalledSignal = mastraDBMessageToSignal(firstSignal);
    const secondRecalledSignal = mastraDBMessageToSignal(secondSignal);
    expect(firstRecalledSignal.createdAt).toEqual(firstSignal.createdAt);
    expect(secondRecalledSignal.createdAt).toEqual(secondSignal.createdAt);
    expect(firstRecalledSignal.acceptedAt).toEqual(firstSignalResult.signal.acceptedAt);
    expect(secondRecalledSignal.acceptedAt).toEqual(secondSignalResult.signal.acceptedAt);

    const firstSignalMetadata = firstSignal.content.metadata?.signal as { createdAt?: string; acceptedAt?: string };
    const secondSignalMetadata = secondSignal.content.metadata?.signal as { createdAt?: string; acceptedAt?: string };
    expect(firstSignalMetadata).toMatchObject({
      createdAt: firstSignal.createdAt.toISOString(),
      acceptedAt: firstSignalResult.signal.acceptedAt?.toISOString(),
    });
    expect(secondSignalMetadata).toMatchObject({
      createdAt: secondSignal.createdAt.toISOString(),
      acceptedAt: secondSignalResult.signal.acceptedAt?.toISOString(),
    });
    expect(firstAssistant.content.metadata?.mastra).toMatchObject({ responseBoundary: true });
    expect(secondAssistant.content.metadata?.mastra).toMatchObject({ responseBoundary: true });

    subscription.unsubscribe();
  });

  it('preserves current-step tool calls before draining a follow-up signal', async () => {
    const prompts: any[][] = [];
    let callCount = 0;
    let continueToToolCall!: () => void;
    const waitBeforeToolCall = new Promise<void>(resolve => {
      continueToToolCall = resolve;
    });

    const model = new MockLanguageModelV2({
      doStream: async ({ prompt }) => {
        callCount += 1;
        const callIndex = callCount;
        prompts.push(prompt);

        if (callIndex === 1) {
          return {
            rawCall: { rawPrompt: null, rawSettings: {} },
            warnings: [],
            stream: new ReadableStream({
              async start(controller) {
                controller.enqueue({ type: 'stream-start', warnings: [] });
                controller.enqueue({
                  type: 'response-metadata',
                  id: 'id-1',
                  modelId: 'mock-model-id',
                  timestamp: new Date(0),
                });
                controller.enqueue({ type: 'text-start', id: 'text-1' });
                controller.enqueue({ type: 'text-delta', id: 'text-1', delta: 'I will check' });
                await waitBeforeToolCall;
                controller.enqueue({
                  type: 'tool-call',
                  toolCallId: 'stale-tool-call',
                  toolName: 'staleTool',
                  input: '{}',
                });
                controller.enqueue({ type: 'text-end', id: 'text-1' });
                controller.enqueue({
                  type: 'finish',
                  finishReason: 'stop',
                  usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
                });
                controller.close();
              },
            }),
          };
        }

        return {
          rawCall: { rawPrompt: null, rawSettings: {} },
          warnings: [],
          stream: convertArrayToReadableStream([
            { type: 'stream-start', warnings: [] },
            { type: 'response-metadata', id: 'id-2', modelId: 'mock-model-id', timestamp: new Date(0) },
            { type: 'text-start', id: 'text-2' },
            { type: 'text-delta', id: 'text-2', delta: 'signal response' },
            { type: 'text-end', id: 'text-2' },
            {
              type: 'finish',
              finishReason: 'stop',
              usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
            },
          ]),
        };
      },
    });

    const agent = new Agent({
      id: 'tool-interjection-signal-agent',
      name: 'Tool Interjection Signal Agent',
      instructions: 'Test',
      model,
    });

    const subscription = await agent.subscribeToThread({
      threadId: 'tool-interjection-thread',
      resourceId: 'tool-interjection-user',
    });
    const iterator = subscription.stream[Symbol.asyncIterator]();
    const chunks: any[] = [];
    const runPromise = (async () => {
      while (true) {
        const next = await iterator.next();
        if (next.done) return;
        chunks.push(next.value);
        if (next.value.type === 'finish' || next.value.type === 'error' || next.value.type === 'abort') return;
      }
    })();

    const stream = await agent.stream('Hello', {
      memory: { thread: 'tool-interjection-thread', resource: 'tool-interjection-user' },
    });
    await expect(waitForActiveRun(subscription)).resolves.toBe(stream.runId);

    const signalResult = await agent.sendSignal(
      { type: 'user-message', contents: 'Actually stop and answer this instead' },
      { resourceId: 'tool-interjection-user', threadId: 'tool-interjection-thread' },
    );
    expect(signalResult).toEqual(expect.objectContaining({ accepted: true, runId: stream.runId }));

    continueToToolCall();
    await waitForCondition(() => callCount === 2);
    await runPromise;

    expect(chunks.map(chunk => chunk.type)).toContain('tool-call');
    expect(JSON.stringify(prompts[1])).toContain('Actually stop and answer this instead');
    expect(JSON.stringify(prompts[1])).toContain('stale-tool-call');

    subscription.unsubscribe();
  });

  it('interrupts an active reasoning stream to drain thread-targeted follow-up signals', async () => {
    const prompts: any[][] = [];
    let callCount = 0;
    let releaseReasoningChunk: (() => void) | undefined;
    let finishFirstCall: (() => void) | undefined;

    const model = new MockLanguageModelV2({
      doStream: async ({ prompt }) => {
        callCount += 1;
        const callIndex = callCount;
        prompts.push(prompt);

        if (callIndex === 1) {
          return {
            rawCall: { rawPrompt: null, rawSettings: {} },
            warnings: [],
            stream: new ReadableStream({
              async start(controller) {
                controller.enqueue({ type: 'stream-start', warnings: [] });
                controller.enqueue({
                  type: 'response-metadata',
                  id: 'id-1',
                  modelId: 'mock-model-id',
                  timestamp: new Date(0),
                });
                controller.enqueue({ type: 'reasoning-start', id: 'reasoning-1' });
                controller.enqueue({ type: 'reasoning-delta', id: 'reasoning-1', delta: 'thinking' });
                await new Promise<void>(resolve => (releaseReasoningChunk = resolve));
                controller.enqueue({ type: 'reasoning-delta', id: 'reasoning-1', delta: ' still thinking' });
                await new Promise<void>(resolve => (finishFirstCall = resolve));
                controller.enqueue({ type: 'reasoning-end', id: 'reasoning-1' });
                controller.enqueue({
                  type: 'finish',
                  finishReason: 'stop',
                  usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
                });
                controller.close();
              },
            }),
          };
        }

        return {
          rawCall: { rawPrompt: null, rawSettings: {} },
          warnings: [],
          stream: convertArrayToReadableStream([
            { type: 'stream-start', warnings: [] },
            { type: 'response-metadata', id: 'id-2', modelId: 'mock-model-id', timestamp: new Date(0) },
            { type: 'text-start', id: 'text-1' },
            { type: 'text-delta', id: 'text-1', delta: 'signal response' },
            { type: 'text-end', id: 'text-1' },
            {
              type: 'finish',
              finishReason: 'stop',
              usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
            },
          ]),
        };
      },
    });

    const agent = new Agent({
      id: 'interleaved-reasoning-signal-agent',
      name: 'Interleaved Reasoning Signal Agent',
      instructions: 'Test',
      model,
    });

    const subscription = await agent.subscribeToThread({
      threadId: 'interleaved-reasoning-thread',
      resourceId: 'interleaved-reasoning-user',
    });
    const iterator = subscription.stream[Symbol.asyncIterator]();
    const runPromise = readNextRun(iterator);

    const stream = await agent.stream('Hello', {
      memory: { thread: 'interleaved-reasoning-thread', resource: 'interleaved-reasoning-user' },
    });
    await expect(waitForActiveRun(subscription)).resolves.toBe(stream.runId);
    await waitForCondition(() => !!releaseReasoningChunk);

    const signalResult = await agent.sendSignal(
      { type: 'user-message', contents: 'Stop reasoning and answer this' },
      { resourceId: 'interleaved-reasoning-user', threadId: 'interleaved-reasoning-thread' },
    );
    expect(signalResult).toEqual(expect.objectContaining({ accepted: true, runId: stream.runId }));

    releaseReasoningChunk?.();
    await waitForCondition(() => !!finishFirstCall);
    finishFirstCall?.();
    await waitForCondition(() => callCount === 2);

    const run = await runPromise;
    expect(run.value.text).toContain('signal response');
    expect(JSON.stringify(prompts[1])).toContain('Stop reasoning and answer this');

    subscription.unsubscribe();
  });

  it('drains thread-targeted follow-up signals into an idle-started run before the run record exists', async () => {
    const prompts: any[][] = [];

    const model = new MockLanguageModelV2({
      doStream: async ({ prompt }) => {
        prompts.push(prompt);

        return {
          rawCall: { rawPrompt: null, rawSettings: {} },
          warnings: [],
          stream: convertArrayToReadableStream([
            { type: 'stream-start', warnings: [] },
            { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
            { type: 'text-start', id: 'text-1' },
            { type: 'text-delta', id: 'text-1', delta: 'response' },
            { type: 'text-end', id: 'text-1' },
            {
              type: 'finish',
              finishReason: 'stop',
              usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
            },
          ]),
        };
      },
    });

    const agent = new Agent({
      id: 'idle-start-thread-target-agent',
      name: 'Idle Start Thread Target Agent',
      instructions: 'Test',
      model,
    });

    const subscription = await agent.subscribeToThread({
      threadId: 'idle-start-thread',
      resourceId: 'idle-start-user',
    });
    const iterator = subscription.stream[Symbol.asyncIterator]();
    const runPromise = readNextRun(iterator);

    const firstSignal = await agent.sendSignal(
      { type: 'user-message', contents: 'start idle stream' },
      {
        resourceId: 'idle-start-user',
        threadId: 'idle-start-thread',
        ifIdle: { streamOptions: { memory: { resource: 'idle-start-user', thread: 'idle-start-thread' } } },
      },
    );

    const followUp = await agent.sendSignal(
      { type: 'user-message', contents: 'thread targeted follow up' },
      {
        resourceId: 'idle-start-user',
        threadId: 'idle-start-thread',
        ifIdle: { streamOptions: { memory: { resource: 'idle-start-user', thread: 'idle-start-thread' } } },
      },
    );

    expect(followUp.runId).toBe(firstSignal.runId);

    const run = await runPromise;
    expect(run.value.runId).toBe(firstSignal.runId);
    expect(run.value.text).toBe('response');
    expect(prompts).toHaveLength(1);
    expect(JSON.stringify(prompts[0])).toContain('thread targeted follow up');

    subscription.unsubscribe();
  });

  it('preserves active interjections sent immediately after repeated idle signal-started runs', async () => {
    const releaseInitialCalls: Array<() => void> = [];
    const prompts: any[][] = [];
    let callCount = 0;

    const model = new MockLanguageModelV2({
      doStream: async ({ prompt }) => {
        callCount += 1;
        const callIndex = callCount;
        prompts.push(prompt);

        return {
          rawCall: { rawPrompt: null, rawSettings: {} },
          warnings: [],
          stream: new ReadableStream({
            async start(controller) {
              controller.enqueue({ type: 'stream-start', warnings: [] });
              controller.enqueue({
                type: 'response-metadata',
                id: `id-${callIndex}`,
                modelId: 'mock-model-id',
                timestamp: new Date(0),
              });
              controller.enqueue({ type: 'text-start', id: 'text-1' });
              controller.enqueue({ type: 'text-delta', id: 'text-1', delta: `response ${callIndex}` });
              controller.enqueue({ type: 'text-end', id: 'text-1' });
              if (callIndex === 1 || callIndex === 2) {
                await new Promise<void>(resolve => releaseInitialCalls.push(resolve));
              }
              controller.enqueue({
                type: 'finish',
                finishReason: 'stop',
                usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
              });
              controller.close();
            },
          }),
        };
      },
    });

    const agent = new Agent({
      id: 'repeated-idle-signal-agent',
      name: 'Repeated Idle Signal Agent',
      instructions: 'Test',
      model,
    });

    const subscription = await agent.subscribeToThread({
      threadId: 'repeated-idle-thread',
      resourceId: 'repeated-idle-user',
    });
    const iterator = subscription.stream[Symbol.asyncIterator]();

    const firstRunPromise = readNextRun(iterator);
    const firstIdle = await agent.sendSignal(
      { type: 'user-message', contents: 'start first idle stream' },
      {
        resourceId: 'repeated-idle-user',
        threadId: 'repeated-idle-thread',
        ifIdle: { streamOptions: { memory: { resource: 'repeated-idle-user', thread: 'repeated-idle-thread' } } },
      },
    );
    await agent.sendSignal(
      { type: 'user-message', contents: 'first active interjection' },
      { runId: firstIdle.runId, resourceId: 'repeated-idle-user', threadId: 'repeated-idle-thread' },
    );
    while (releaseInitialCalls.length < 1) await nextTick();
    releaseInitialCalls.shift()?.();
    const firstRun = await firstRunPromise;
    expect(firstRun.value.text).toBe('response 1');
    expect(JSON.stringify(prompts[0])).toContain('first active interjection');

    const secondRunPromise = readNextRun(iterator);
    const secondIdle = await agent.sendSignal(
      { type: 'user-message', contents: 'start second idle stream' },
      {
        resourceId: 'repeated-idle-user',
        threadId: 'repeated-idle-thread',
        ifIdle: { streamOptions: { memory: { resource: 'repeated-idle-user', thread: 'repeated-idle-thread' } } },
      },
    );
    await agent.sendSignal(
      { type: 'user-message', contents: 'second active interjection' },
      { runId: secondIdle.runId, resourceId: 'repeated-idle-user', threadId: 'repeated-idle-thread' },
    );
    while (releaseInitialCalls.length < 1) await nextTick();
    releaseInitialCalls.shift()?.();
    const secondRun = await secondRunPromise;
    expect(secondRun.value.text).toBe('response 2');
    expect(JSON.stringify(prompts[1])).toContain('second active interjection');

    subscription.unsubscribe();
  });

  it('queues a signal from another agent until the active thread run finishes', async () => {
    let releaseFirst!: () => void;
    const firstFinished = new Promise<void>(resolve => {
      releaseFirst = resolve;
    });
    let firstStarted = false;
    let secondStarted = false;

    const firstAgent = new Agent({
      id: 'cross-agent-a',
      name: 'Cross Agent A',
      instructions: 'Test',
      model: new MockLanguageModelV2({
        doStream: async () => {
          firstStarted = true;
          return {
            rawCall: { rawPrompt: null, rawSettings: {} },
            warnings: [],
            stream: new ReadableStream({
              async start(controller) {
                controller.enqueue({ type: 'stream-start', warnings: [] });
                controller.enqueue({
                  type: 'response-metadata',
                  id: 'cross-a',
                  modelId: 'mock-model-id',
                  timestamp: new Date(0),
                });
                controller.enqueue({ type: 'text-start', id: 'text-1' });
                controller.enqueue({ type: 'text-delta', id: 'text-1', delta: 'first response' });
                controller.enqueue({ type: 'text-end', id: 'text-1' });
                await firstFinished;
                controller.enqueue({
                  type: 'finish',
                  finishReason: 'stop',
                  usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
                });
                controller.close();
              },
            }),
          };
        },
      }),
    });
    const secondAgent = new Agent({
      id: 'cross-agent-b',
      name: 'Cross Agent B',
      instructions: 'Test',
      model: new MockLanguageModelV2({
        doStream: async () => {
          secondStarted = true;
          return {
            rawCall: { rawPrompt: null, rawSettings: {} },
            warnings: [],
            stream: convertArrayToReadableStream([
              { type: 'stream-start', warnings: [] },
              { type: 'response-metadata', id: 'cross-b', modelId: 'mock-model-id', timestamp: new Date(0) },
              { type: 'text-start', id: 'text-1' },
              { type: 'text-delta', id: 'text-1', delta: 'second response' },
              { type: 'text-end', id: 'text-1' },
              {
                type: 'finish',
                finishReason: 'stop',
                usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
              },
            ]),
          };
        },
      }),
    });
    new Mastra({ agents: { firstAgent, secondAgent }, logger: false });

    const subscription = await firstAgent.subscribeToThread({
      threadId: 'cross-agent-thread',
      resourceId: 'cross-agent-user',
    });
    const iterator = subscription.stream[Symbol.asyncIterator]();
    const firstRunPromise = readNextRun(iterator);

    const firstStream = await firstAgent.stream('Hello', {
      memory: { thread: 'cross-agent-thread', resource: 'cross-agent-user' },
    });
    const firstText = firstStream.text;
    await nextTick();
    expect(firstStarted).toBe(true);

    const signalResult = await secondAgent.sendSignal(
      { type: 'user-message', contents: 'Hello from another agent' },
      {
        resourceId: 'cross-agent-user',
        threadId: 'cross-agent-thread',
        ifIdle: { streamOptions: { memory: { resource: 'cross-agent-user', thread: 'cross-agent-thread' } } },
      },
    );
    await nextTick();
    expect(secondStarted).toBe(false);

    releaseFirst();
    await expect(firstText).resolves.toBe('first response');
    await expect(firstRunPromise).resolves.toMatchObject({ value: { runId: firstStream.runId }, done: false });

    const secondRun = await readNextRun(iterator);
    expect(secondRun.value.runId).toBe(signalResult.runId);
    expect(secondRun.value.text).toBe('second response');
    expect(secondStarted).toBe(true);

    subscription.unsubscribe();
  });

  it('cleans up a thread subscription and completes the iterator', async () => {
    const agent = new Agent({
      id: 'cleanup-signal-agent',
      name: 'Cleanup Signal Agent',
      instructions: 'Test',
      model: createTextStreamModel('cleanup response'),
    });

    const subscription = await agent.subscribeToThread({
      threadId: 'cleanup-thread',
      resourceId: 'cleanup-user',
    });
    const iterator = subscription.stream[Symbol.asyncIterator]();

    subscription.unsubscribe();
    await expect(iterator.next()).resolves.toEqual({ value: undefined, done: true });
  });

  it('allows a thread follower to abort the active run controller', () => {
    const runtime = new AgentThreadStreamRuntime();
    const options = runtime.prepareRunOptions({
      runId: 'abort-run',
      memory: { thread: 'abort-thread', resource: 'abort-user' },
    } as any);
    const neverFinishes = new Promise<any>(() => {});

    runtime.registerRun(
      { id: 'abortable-agent' } as any,
      {
        runId: 'abort-run',
        status: 'running',
        _waitUntilFinished: () => neverFinishes,
      } as any,
      options,
    );

    expect(runtime.abortThread({ threadId: 'abort-thread', resourceId: 'abort-user' })).toBe(true);
    expect(options.abortSignal?.aborted).toBe(true);
  });

  it('does not consume active run output while watching for completion', () => {
    const runtime = new AgentThreadStreamRuntime();
    const getFullOutput = vi.fn();

    runtime.registerRun(
      { id: 'watch-agent' } as any,
      {
        runId: 'watch-run',
        status: 'running',
        getFullOutput,
        _waitUntilFinished: () => new Promise<any>(() => {}),
      } as any,
      {
        runId: 'watch-run',
        memory: { thread: 'watch-thread', resource: 'watch-user' },
      } as any,
    );

    expect(getFullOutput).not.toHaveBeenCalled();
  });

  it('delivers a future thread run to multiple subscribers', async () => {
    const agent = new Agent({
      id: 'multiple-subscriber-agent',
      name: 'Multiple Subscriber Agent',
      instructions: 'Test',
      model: createTextStreamModel('multi response'),
    });

    const firstSubscription = await agent.subscribeToThread({
      threadId: 'multi-thread',
      resourceId: 'multi-user',
    });
    const secondSubscription = await agent.subscribeToThread({
      threadId: 'multi-thread',
      resourceId: 'multi-user',
    });
    const firstRunPromise = readNextRun(firstSubscription.stream[Symbol.asyncIterator]());
    const secondRunPromise = readNextRun(secondSubscription.stream[Symbol.asyncIterator]());

    const stream = await agent.stream('Hello', {
      memory: { thread: 'multi-thread', resource: 'multi-user' },
    });

    await expect(firstRunPromise).resolves.toMatchObject({ value: { runId: stream.runId }, done: false });
    await expect(secondRunPromise).resolves.toMatchObject({ value: { runId: stream.runId }, done: false });

    firstSubscription.unsubscribe();
    secondSubscription.unsubscribe();
  });

  it('isolates subscriptions by resource and thread id', async () => {
    const agent = new Agent({
      id: 'isolated-signal-agent',
      name: 'Isolated Signal Agent',
      instructions: 'Test',
      model: createTextStreamModel('isolated response'),
    });

    const targetSubscription = await agent.subscribeToThread({
      threadId: 'isolated-thread',
      resourceId: 'isolated-user',
    });
    const otherResourceSubscription = await agent.subscribeToThread({
      threadId: 'isolated-thread',
      resourceId: 'other-user',
    });
    const otherThreadSubscription = await agent.subscribeToThread({
      threadId: 'other-thread',
      resourceId: 'isolated-user',
    });

    const targetNext = readNextRun(targetSubscription.stream[Symbol.asyncIterator]());
    const otherResourceNext = readNextRun(otherResourceSubscription.stream[Symbol.asyncIterator]());
    const otherThreadNext = readNextRun(otherThreadSubscription.stream[Symbol.asyncIterator]());

    const stream = await agent.stream('Hello', {
      memory: { thread: 'isolated-thread', resource: 'isolated-user' },
    });

    await expect(targetNext).resolves.toMatchObject({ value: { runId: stream.runId }, done: false });
    await nextTick();

    otherResourceSubscription.unsubscribe();
    otherThreadSubscription.unsubscribe();
    await expect(otherResourceNext).resolves.toEqual({ value: undefined, done: true });
    await expect(otherThreadNext).resolves.toEqual({ value: undefined, done: true });

    targetSubscription.unsubscribe();
  });

  it('does not replay completed thread runs to late subscribers', async () => {
    const agent = new Agent({
      id: 'late-subscription-agent',
      name: 'Late Subscription Agent',
      instructions: 'Test',
      model: createTextStreamModel('late response'),
    });

    const stream = await agent.stream('Hello', {
      memory: { thread: 'late-thread', resource: 'late-user' },
    });
    await stream.text;
    const subscription = await agent.subscribeToThread({
      threadId: 'late-thread',
      resourceId: 'late-user',
    });
    const iterator = subscription.stream[Symbol.asyncIterator]();

    const nextRun = readNextRun(iterator);
    await nextTick();
    subscription.unsubscribe();
    await expect(nextRun).resolves.toEqual({ value: undefined, done: true });
  });

  it('drains a signal by active run id into the active run', async () => {
    let releaseFirst!: () => void;
    const firstFinished = new Promise<void>(resolve => {
      releaseFirst = resolve;
    });
    let streamCount = 0;
    const prompts: any[][] = [];

    const model = new MockLanguageModelV2({
      doStream: async ({ prompt }) => {
        streamCount += 1;
        prompts.push(prompt);
        const responseText = streamCount === 1 ? 'run id first response' : 'run id signal response';

        return {
          rawCall: { rawPrompt: null, rawSettings: {} },
          warnings: [],
          stream: new ReadableStream({
            async start(controller) {
              controller.enqueue({ type: 'stream-start', warnings: [] });
              controller.enqueue({
                type: 'response-metadata',
                id: `run-id-${streamCount}`,
                modelId: 'mock-model-id',
                timestamp: new Date(0),
              });
              controller.enqueue({ type: 'text-start', id: 'text-1' });
              controller.enqueue({ type: 'text-delta', id: 'text-1', delta: responseText });
              controller.enqueue({ type: 'text-end', id: 'text-1' });
              if (streamCount === 1) {
                await firstFinished;
              }
              controller.enqueue({
                type: 'finish',
                finishReason: 'stop',
                usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
              });
              controller.close();
            },
          }),
        };
      },
    });

    const agent = new Agent({
      id: 'run-id-signal-agent',
      name: 'Run Id Signal Agent',
      instructions: 'Test',
      model,
    });
    const subscription = await agent.subscribeToThread({
      threadId: 'run-id-thread',
      resourceId: 'run-id-user',
    });
    const iterator = subscription.stream[Symbol.asyncIterator]();
    const firstRunPromise = readNextRun(iterator);

    const stream = await agent.stream('Hello', {
      memory: { thread: 'run-id-thread', resource: 'run-id-user' },
    });
    await expect(waitForActiveRun(subscription)).resolves.toBe(stream.runId);

    expect(agent.sendSignal({ type: 'user-message', contents: 'Hello by run id' }, { runId: stream.runId })).toEqual(
      expect.objectContaining({
        accepted: true,
        runId: stream.runId,
      }),
    );

    releaseFirst();
    await firstRunPromise;
    await expect(stream.text).resolves.toBe('run id first responserun id signal response');
    expect(streamCount).toBe(2);
    expect(JSON.stringify(prompts[1])).toContain('Hello by run id');

    subscription.unsubscribe();
  });

  it('throws when sending a signal to an unknown run id without a thread target', () => {
    const agent = new Agent({
      id: 'missing-run-signal-agent',
      name: 'Missing Run Signal Agent',
      instructions: 'Test',
      model: createTextStreamModel('missing run response'),
    });

    expect(() => agent.sendSignal({ type: 'user-message', contents: 'Hello' }, { runId: 'missing-run-id' })).toThrow(
      'No active agent run found for signal target',
    );
  });

  it('starts an idle thread run with a system-reminder signal as user-role XML context', async () => {
    let capturedPrompt: any[] | undefined;
    const model = new MockLanguageModelV2({
      doStream: async ({ prompt }) => {
        capturedPrompt = prompt;
        return {
          rawCall: { rawPrompt: prompt, rawSettings: {} },
          warnings: [],
          stream: convertArrayToReadableStream([
            { type: 'stream-start', warnings: [] },
            { type: 'response-metadata', id: 'system-signal-id', modelId: 'mock-model-id', timestamp: new Date(0) },
            { type: 'text-start', id: 'text-1' },
            { type: 'text-delta', id: 'text-1', delta: 'system signal response' },
            { type: 'text-end', id: 'text-1' },
            {
              type: 'finish',
              finishReason: 'stop',
              usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
            },
          ]),
        };
      },
    });

    const agent = new Agent({
      id: 'system-signal-agent',
      name: 'System Signal Agent',
      instructions: 'Test',
      model,
    });

    const stream = await agent.sendSignal(
      { type: 'system-reminder', contents: 'continue', attributes: { reminderType: 'test-reminder' } },
      {
        resourceId: 'system-signal-user',
        threadId: 'system-signal-thread',
        ifIdle: { streamOptions: { memory: { resource: 'system-signal-user', thread: 'system-signal-thread' } } },
      },
    );

    expect(stream.accepted).toBe(true);
    for (let i = 0; i < 10 && !capturedPrompt; i++) {
      await nextTick();
    }
    expect(
      capturedPrompt?.some(
        message =>
          message.role === 'user' &&
          Array.isArray(message.content) &&
          message.content.some(
            (part: any) => part.text === '<system-reminder reminderType="test-reminder">continue</system-reminder>',
          ),
      ),
    ).toBe(true);
  });

  describe('delivery option attributes', () => {
    it('resolveDeliveryAttributes merges option attributes into signal attributes', () => {
      const signal = createSignal({
        type: 'user-message',
        contents: 'hello',
        attributes: { existing: 'yes' },
      });

      const resolved = resolveDeliveryAttributes(signal, { delivery: 'while-active' });
      expect(resolved.attributes).toEqual({ existing: 'yes', delivery: 'while-active' });
    });

    it('resolveDeliveryAttributes returns same signal when no option attributes are selected', () => {
      const signal = createSignal({
        type: 'user-message',
        contents: 'hello',
      });

      const resolved = resolveDeliveryAttributes(signal, undefined);
      expect(resolved).toBe(signal);
    });

    it('resolved delivery attributes appear in toLLMMessage XML', () => {
      const signal = createSignal({
        type: 'user-message',
        contents: 'fix the bug',
      });

      const resolved = resolveDeliveryAttributes(signal, { delivery: 'while-active' });
      expect(resolved.toLLMMessage()).toEqual({
        role: 'user',
        content: '<user-message delivery="while-active">fix the bug</user-message>',
      });
    });

    it('resolved delivery attributes appear in toDBMessage and toDataPart', () => {
      const signal = createSignal({
        type: 'user-message',
        contents: 'fix the bug',
      });

      const resolved = resolveDeliveryAttributes(signal, { delivery: 'while-active' });
      const db = resolved.toDBMessage({ threadId: 't', resourceId: 'r' });
      expect((db.content.metadata!.signal as Record<string, unknown>).attributes).toEqual({
        delivery: 'while-active',
      });

      const dataPart = resolved.toDataPart();
      expect(dataPart.data.attributes).toEqual({ delivery: 'while-active' });
    });

    it('thread-stream-runtime resolves ifActive.attributes as while-active on active signal delivery', () => {
      const runtime = new AgentThreadStreamRuntime();
      const pubsub = new EventEmitterPubSub();
      const agent = { id: 'delivery-active-agent' } as any;

      // Prepare and register a run that is still "running" so the thread is active.
      const options = runtime.prepareRunOptions(
        {
          runId: 'active-run',
          memory: { thread: 'delivery-thread', resource: 'delivery-resource' },
        } as any,
        pubsub,
      );
      runtime.registerRun(
        agent,
        {
          runId: 'active-run',
          status: 'running',
          _waitUntilFinished: () => new Promise<any>(() => {}),
        } as any,
        options,
        pubsub,
      );

      // Send a signal while the run is still active.
      const result = runtime.sendSignal(
        agent,
        {
          type: 'user-message',
          contents: 'while-active test',
        },
        {
          resourceId: 'delivery-resource',
          threadId: 'delivery-thread',
          ifActive: { attributes: { delivery: 'while-active' } },
          ifIdle: {
            attributes: { delivery: 'message' },
            streamOptions: {
              memory: { thread: 'delivery-thread', resource: 'delivery-resource' },
            },
          },
        },
        pubsub,
      );

      // Active run → ifActive.attributes → delivery: 'while-active'
      expect(result.signal.attributes).toEqual({ delivery: 'while-active' });
    });

    it('thread-stream-runtime resolves ifIdle.attributes as message on idle signal delivery', () => {
      const runtime = new AgentThreadStreamRuntime();
      const pubsub = new EventEmitterPubSub();
      const agent = { id: 'delivery-idle-agent', stream: () => new Promise(() => {}) } as any;

      // No run registered → thread is idle.
      const result = runtime.sendSignal(
        agent,
        {
          type: 'user-message',
          contents: 'idle test',
        },
        {
          resourceId: 'idle-resource',
          threadId: 'idle-thread',
          ifActive: { attributes: { delivery: 'while-active' } },
          ifIdle: {
            attributes: { delivery: 'message' },
            streamOptions: {
              memory: { thread: 'idle-thread', resource: 'idle-resource' },
            },
          },
        },
        pubsub,
      );

      // No active run → ifIdle.attributes → delivery: 'message'
      expect(result.signal.attributes).toEqual({ delivery: 'message' });
    });
  });
});
