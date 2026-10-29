import { describe, expect, expectTypeOf, it } from 'vitest';
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

describe('signal contents', () => {
  const skill = (contents: string, tagName = 'skill') =>
    createSignal({ type: 'reactive', tagName, attributes: { name: 'a&"<b>' }, contents }).toLLMMessage().content;

  it('reaches the model as written inside its tag', () => {
    const contents = 'Run `pnpm build && pnpm test 2>&1`.\n\n<work-item-feed>\nfeed\n</work-item-feed>';
    expect(skill(contents)).toBe(`<skill name="a&amp;&quot;&lt;b&gt;">${contents}</skill>`);
  });

  it("escapes the signal's own closing tag in any whitespace or case form", () => {
    expect(skill('a </skill> b </skill >c</SKILL\n\t> </skills> <system-reminder>x</system-reminder>')).toBe(
      '<skill name="a&amp;&quot;&lt;b&gt;">a &lt;/skill&gt; b &lt;/skill &gt;c&lt;/SKILL\n\t&gt; </skills> <system-reminder>x</system-reminder></skill>',
    );
  });

  it('matches a dotted tag name literally', () => {
    expect(skill('</myXskill> </my.skill >', 'my.skill')).toBe(
      '<my.skill name="a&amp;&quot;&lt;b&gt;"></myXskill> &lt;/my.skill &gt;</my.skill>',
    );
  });

  it('applies the same rule to the inline marker of multimodal contents', () => {
    const content = createSignal({
      type: 'reactive',
      tagName: 'skill',
      contents: [
        { type: 'text', text: 'a && b </skill>' },
        { type: 'file', data: 'aGVsbG8=', mediaType: 'image/png' },
      ],
    }).toLLMMessage().content;
    expect(Array.isArray(content) && content[0]).toMatchObject({
      type: 'text',
      text: '<skill>a && b &lt;/skill&gt;</skill>',
    });
  });
});
