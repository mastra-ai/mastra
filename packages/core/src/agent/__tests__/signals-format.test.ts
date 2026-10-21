import { beforeEach, describe, expect, it } from 'vitest';

import { withMessageAuthor } from '../../agent-controller/message-author';
import { EventEmitterPubSub } from '../../events/event-emitter';
import {
  createMessageSignal,
  createSignal,
  dataPartToSignal,
  getMessageAuthor,
  mastraDBMessageToSignal,
  resolveDeliveryAttributes,
  signalToDataPartFormat,
  signalToMastraDBMessage,
} from '../signals';
import { AgentThreadStreamRuntime, agentThreadStreamRuntime } from '../thread-stream-runtime';

describe('Agent signals: message formats', () => {
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
      content: '<user priority="high">Signal contents</user>',
    });
    expect(signal.toDataPart()).toEqual({
      type: 'data-user-message',
      data: {
        id: 'signal-1',
        type: 'user',
        tagName: 'user',
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
        type: 'user',
        tagName: 'user',
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
        '<system-reminder enabled="true" path="/tmp/AGENTS.md" type="dynamic-agents-md">Use &lt;safe&gt; content &amp; continue</system-reminder>',
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

  it('normalizes message signals and legacy signal types', () => {
    const messageSignal = createMessageSignal({
      contents: 'Hello',
      attributes: { sentFrom: 'test' },
    });
    expect(messageSignal.type).toBe('user');
    expect(messageSignal.tagName).toBe('user');
    expect(messageSignal.toLLMMessage()).toEqual({ role: 'user', content: '<user sentFrom="test">Hello</user>' });

    const legacyMessage = createSignal({ type: 'user-message', contents: 'Legacy message' });
    expect(legacyMessage.type).toBe('user');
    expect(legacyMessage.tagName).toBe('user');
    expect(legacyMessage.toLLMMessage()).toEqual({ role: 'user', content: 'Legacy message' });

    const legacyReminder = createSignal({ type: 'system-reminder', contents: 'Remember this' });
    expect(legacyReminder.type).toBe('reactive');
    expect(legacyReminder.tagName).toBe('system-reminder');
    expect(legacyReminder.toLLMMessage()).toEqual({
      role: 'user',
      content: '<system-reminder>Remember this</system-reminder>',
    });

    const reactiveReminder = createSignal({ type: 'reactive', contents: 'Default reminder tag' });
    expect(reactiveReminder.type).toBe('reactive');
    expect(reactiveReminder.tagName).toBe('system-reminder');
    expect(reactiveReminder.toLLMMessage()).toEqual({
      role: 'user',
      content: '<system-reminder>Default reminder tag</system-reminder>',
    });

    const customTaggedReminder = createSignal({
      type: 'reactive',
      tagName: 'custom-reminder',
      contents: 'Custom tag',
    });
    expect(customTaggedReminder.type).toBe('reactive');
    expect(customTaggedReminder.tagName).toBe('custom-reminder');
    expect(() => createSignal({ type: 'custom-reminder' as any, contents: 'Legacy custom' })).toThrow(
      'Invalid signal type: custom-reminder',
    );
  });

  it('renders user-message attributes inline-wrapped for text and multimodal contents', () => {
    const stringSignal = createSignal({
      type: 'user-message',
      contents: 'Hello',
      attributes: { messageId: 'm-1', userId: 'u-1' },
    });
    expect(stringSignal.toLLMMessage()).toEqual({
      role: 'user',
      content: '<user messageId="m-1" userId="u-1">Hello</user>',
    });

    const partsTextSignal = createSignal({
      type: 'user-message',
      contents: [{ type: 'text', text: 'Hello again' }],
      attributes: { messageId: 'm-1b' },
    });
    expect(partsTextSignal.toLLMMessage()).toEqual({
      role: 'user',
      content: '<user messageId="m-1b">Hello again</user>',
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
          text: '<user messageId="m-2">Look at this</user>',
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
      expect.objectContaining({ type: 'text', text: '<user messageId="m-2d" />' }),
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
    expect(signalMeta).toMatchObject({ type: 'user', tagName: 'user', attributes: { messageId: 'm-1' } });

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
    expect(rehydrated.type).toBe('reactive');
    expect(rehydrated.tagName).toBe('system-reminder');
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

  it('round-trips message author without replacing provider metadata', () => {
    const providerOptions = {
      mastra: { traceId: 'trace-1' },
      openai: { reasoningEffort: 'high' },
    };
    const author = { id: 'user-1', name: 'Ada', avatarUrl: 'https://example.com/ada.png' };
    const authorProviderOptions = withMessageAuthor(providerOptions, author);
    const signal = createSignal({
      type: 'user-message',
      contents: 'hello',
      author,
      providerOptions: authorProviderOptions,
    });

    const db = signal.toDBMessage();
    expect(getMessageAuthor(db)).toEqual(author);
    expect(db.content.providerMetadata).toEqual({
      mastra: { traceId: 'trace-1', author },
      openai: { reasoningEffort: 'high' },
    });

    const rehydrated = mastraDBMessageToSignal(db);
    expect(rehydrated.author).toEqual(author);
    expect(rehydrated.providerOptions).toEqual(authorProviderOptions);
    expect(getMessageAuthor(rehydrated.toDBMessage())).toEqual(author);

    delete (db.content.metadata!.signal as Record<string, unknown>).author;
    expect(getMessageAuthor(db)).toEqual(author);
    expect(mastraDBMessageToSignal(db).author).toEqual(author);
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
        type: 'reactive',
        tagName: 'system reminder',
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
        content: '<user delivery="while-active">fix the bug</user>',
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
