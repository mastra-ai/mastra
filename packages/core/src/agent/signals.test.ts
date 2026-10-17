import { describe, expect, expectTypeOf, it } from 'vitest';
import { MessageList } from './message-list';
import type { CreatedAgentSignal } from './signals';
import {
  createSignal,
  dataPartToSignal,
  isTransientSignalMessage,
  mastraDBMessageToSignal,
  signalToDataPartFormat,
  signalToMastraDBMessage,
  signalToMessage,
} from './signals';

describe('transient signals (transient: true)', () => {
  it('marks the DB message with content.metadata.signal.transient when transient is true', () => {
    const dbMessage = createSignal({
      type: 'reactive',
      contents: 'steering reminder',
      transient: true,
    }).toDBMessage();

    const signalMeta = dbMessage.content.metadata?.signal as Record<string, unknown> | undefined;
    expect(signalMeta?.transient).toBe(true);
    expect(isTransientSignalMessage(dbMessage)).toBe(true);
  });

  it('does not mark the DB message when transient is omitted (default) or false', () => {
    const defaultMessage = createSignal({ type: 'reactive', contents: 'kept' }).toDBMessage();
    const explicitMessage = createSignal({ type: 'reactive', contents: 'kept', transient: false }).toDBMessage();

    const defaultMeta = defaultMessage.content.metadata?.signal as Record<string, unknown> | undefined;
    const explicitMeta = explicitMessage.content.metadata?.signal as Record<string, unknown> | undefined;

    expect(defaultMeta?.transient).toBeUndefined();
    expect(explicitMeta?.transient).toBeUndefined();
    expect(isTransientSignalMessage(defaultMessage)).toBe(false);
    expect(isTransientSignalMessage(explicitMessage)).toBe(false);
  });

  it('still projects a transient signal into the LLM message (delivery is unaffected)', () => {
    const signal = createSignal({ type: 'reactive', contents: 'remember the rules', transient: true });
    const llmMessage = signal.toLLMMessage();

    const text = typeof llmMessage.content === 'string' ? llmMessage.content : JSON.stringify(llmMessage.content);
    expect(text).toContain('remember the rules');
  });

  it('round-trips transient: true through mastraDBMessageToSignal', () => {
    const dbMessage = createSignal({ type: 'reactive', contents: 'ephemeral', transient: true }).toDBMessage();
    const restored = mastraDBMessageToSignal(dbMessage);
    expect(restored.transient).toBe(true);
    expect(isTransientSignalMessage(restored.toDBMessage())).toBe(true);
  });

  it('isTransientSignalMessage returns false for non-signal messages', () => {
    expect(
      isTransientSignalMessage({
        id: 'u1',
        role: 'user',
        content: { format: 2, parts: [{ type: 'text', text: 'hi' }] },
        createdAt: new Date(),
      }),
    ).toBe(false);
  });

  it('preserves the state/non-state invariant on created signals', () => {
    const stateSignal = createSignal({ type: 'state', contents: 'state' });
    const legacySignal = createSignal({ type: 'system-reminder', contents: 'reminder' });

    expectTypeOf(stateSignal).toEqualTypeOf<Extract<CreatedAgentSignal, { type: 'state' }>>();
    expectTypeOf(legacySignal).toEqualTypeOf<Exclude<CreatedAgentSignal, { type: 'state' }>>();
    expect(legacySignal.type).toBe('reactive');
  });

  it('projects current fields from a spread created signal', () => {
    const original = createSignal({ type: 'reactive', contents: 'stale contents' });
    const updated = { ...original, contents: 'updated contents' };

    expect(signalToMessage(updated).content).toContain('updated contents');
    expect(signalToMastraDBMessage(updated).content.parts).toContainEqual(
      expect.objectContaining({ type: 'text', text: 'updated contents' }),
    );
    expect(signalToDataPartFormat(updated).data.contents).toBe('updated contents');
  });

  it('round-trips the signal retention flag separately from the stream marker', () => {
    const part = signalToDataPartFormat(
      createSignal({ type: 'reactive', contents: 'current-call only', transient: true }),
    );

    expect(part.transient).toBe(true);
    expect(part.data.transient).toBe(true);
    expect(dataPartToSignal(part).transient).toBe(true);
  });

  it('rejects transient state signals (state tracking is rebuilt from persisted history)', () => {
    for (const transient of [true, false]) {
      expect(() =>
        // @ts-expect-error — the union forbids transient on state signals; verify the runtime guard too
        createSignal({
          type: 'state',
          contents: 'full state snapshot',
          transient,
        }),
      ).toThrow('state signals cannot be transient');
    }

    const stateSignal = createSignal({ type: 'state', contents: 'full state snapshot' });
    expect(stateSignal.transient).toBeUndefined();

    const corruptPersistedMessage = stateSignal.toDBMessage();
    const signalMetadata = corruptPersistedMessage.content.metadata?.signal as Record<string, unknown>;
    signalMetadata.transient = true;
    expect(() => mastraDBMessageToSignal(corruptPersistedMessage)).toThrow('state signals cannot be transient');
  });
});

describe('signal attribute rendering', () => {
  it('renders the same markup after storage reorders the attribute keys', () => {
    const attributes = {
      userId: 'u1',
      name: 'jane',
      turnId: 't1',
      messageId: 'm1',
      attempt: '1',
      expectsTerminal: 'true',
    };
    const fresh = createSignal({ type: 'user', contents: 'hello', attributes });

    // Postgres jsonb returns object keys sorted by length, then bytewise.
    const dbMessage = fresh.toDBMessage();
    const signalMeta = dbMessage.content.metadata!.signal as { attributes: Record<string, unknown> };
    const reorderedAttributes = Object.fromEntries(
      Object.keys(signalMeta.attributes)
        .sort((a, b) => a.length - b.length || (a < b ? -1 : a > b ? 1 : 0))
        .map(key => [key, signalMeta.attributes[key]]),
    );
    const reloaded = mastraDBMessageToSignal({
      ...dbMessage,
      content: {
        ...dbMessage.content,
        metadata: { ...dbMessage.content.metadata, signal: { ...signalMeta, attributes: reorderedAttributes } },
      },
    });

    expect(Object.keys(reloaded.attributes!)).not.toEqual(Object.keys(attributes));
    expect(reloaded.toLLMMessage()).toEqual(fresh.toLLMMessage());
    expect(fresh.toLLMMessage().content).toBe(
      '<user attempt="1" expectsTerminal="true" messageId="m1" name="jane" turnId="t1" userId="u1">hello</user>',
    );
  });
});

describe('signal content escaping (escapeContents)', () => {
  const contents = 'Run `pnpm build && pnpm test 2>&1` and open ?a=1&b=2.\n\n<work-item-feed>\nfeed\n</work-item-feed>';
  const skill = { type: 'reactive', tagName: 'skill', attributes: { name: 'triage' }, contents } as const;

  it('escapes contents by default', () => {
    expect(createSignal(skill).toLLMMessage().content).toBe(
      '<skill name="triage">Run `pnpm build &amp;&amp; pnpm test 2&gt;&amp;1` and open ?a=1&amp;b=2.\n\n&lt;work-item-feed&gt;\nfeed\n&lt;/work-item-feed&gt;</skill>',
    );
  });

  it('renders contents as written when escapeContents is false', () => {
    expect(createSignal({ ...skill, escapeContents: false }).toLLMMessage().content).toBe(
      `<skill name="triage">${contents}</skill>`,
    );
  });

  it('still escapes the closing tag so contents cannot end the signal early', () => {
    const content = createSignal({
      ...skill,
      escapeContents: false,
      contents: 'before </skill> after <skill>',
    }).toLLMMessage().content;
    expect(content).toBe('<skill name="triage">before &lt;/skill&gt; after <skill></skill>');
  });

  it('escapes closing tags that have whitespace before the bracket', () => {
    const content = createSignal({
      ...skill,
      escapeContents: false,
      contents: 'a </skill > b </skill\n\t> c </skills> d',
    }).toLLMMessage().content;
    expect(content).toBe('<skill name="triage">a &lt;/skill &gt; b &lt;/skill\n\t&gt; c </skills> d</skill>');
  });

  it('matches a dotted tag name literally', () => {
    const content = createSignal({
      type: 'reactive',
      tagName: 'my.skill',
      escapeContents: false,
      contents: '</myXskill> </my.skill >',
    }).toLLMMessage().content;
    expect(content).toBe('<my.skill></myXskill> &lt;/my.skill &gt;</my.skill>');
  });

  it('still escapes attributes when escapeContents is false', () => {
    const content = createSignal({
      ...skill,
      escapeContents: false,
      attributes: { name: 'a"&<b' },
      contents: 'x',
    }).toLLMMessage().content;
    expect(content).toBe('<skill name="a&quot;&amp;&lt;b">x</skill>');
  });

  it('applies to the inline marker for multimodal contents', () => {
    const message = createSignal({
      ...skill,
      escapeContents: false,
      contents: [
        { type: 'text', text: 'a && b' },
        { type: 'file', data: 'aGVsbG8=', mediaType: 'text/plain' },
      ],
    }).toLLMMessage();
    expect(message.content).toEqual([
      { type: 'text', text: '<skill name="triage">a && b</skill>' },
      expect.objectContaining({ type: 'file' }),
    ]);
  });

  it('persists the opt-out and replays it from storage', () => {
    const fresh = createSignal({ ...skill, escapeContents: false });
    const dbMessage = fresh.toDBMessage();

    expect(dbMessage.content.metadata?.signal).toMatchObject({ escapeContents: false });
    expect(mastraDBMessageToSignal(dbMessage).toLLMMessage()).toEqual(fresh.toLLMMessage());
  });

  it('does not persist the flag for default signals', () => {
    const dbMessage = createSignal({ ...skill, escapeContents: true }).toDBMessage();
    expect(dbMessage.content.metadata?.signal).not.toHaveProperty('escapeContents');
    expect(mastraDBMessageToSignal(dbMessage).escapeContents).toBeUndefined();
  });

  it('round-trips the opt-out through the data part', () => {
    const fresh = createSignal({ ...skill, escapeContents: false });
    const part = fresh.toDataPart();

    expect(part.data.escapeContents).toBe(false);
    expect(dataPartToSignal(part).toLLMMessage()).toEqual(fresh.toLLMMessage());
  });

  it('keeps the opt-out when the signal is added to a message list and replayed', () => {
    const list = new MessageList({ threadId: 't1', resourceId: 'r1' });
    list.add(createSignal({ ...skill, escapeContents: false }), 'input');

    const stored = list.get.all.db().at(-1)!;
    expect(stored.content.metadata?.signal).toMatchObject({ escapeContents: false });

    const replayed = new MessageList({ threadId: 't1', resourceId: 'r1' });
    replayed.add(stored, 'memory');
    expect(replayed.get.all.aiV5.model()).toEqual([
      expect.objectContaining({
        role: 'user',
        content: [expect.objectContaining({ type: 'text', text: `<skill name="triage">${contents}</skill>` })],
      }),
    ]);
  });
});
