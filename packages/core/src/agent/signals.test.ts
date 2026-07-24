import { describe, expect, expectTypeOf, it } from 'vitest';
import type { CreatedNonStateAgentSignal, CreatedStateAgentSignal } from './signals';
import { createSignal, isCreatedAgentSignal, isTransientSignalMessage, mastraDBMessageToSignal } from './signals';

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

    expectTypeOf(stateSignal).toEqualTypeOf<CreatedStateAgentSignal>();
    expectTypeOf(legacySignal).toEqualTypeOf<CreatedNonStateAgentSignal>();
    expect(legacySignal.type).toBe('reactive');
    expect(isCreatedAgentSignal({ ...legacySignal, toLLMMessage: undefined })).toBe(false);
  });

  it('rejects transient state signals (state tracking is rebuilt from persisted history)', () => {
    expect(() =>
      // @ts-expect-error — the union forbids transient on state signals; verify the runtime guard too
      createSignal({
        type: 'state',
        contents: 'full state snapshot',
        transient: true,
      }),
    ).toThrow('state signals cannot be transient');

    const stateSignal = createSignal({ type: 'state', contents: 'full state snapshot' });
    expect(stateSignal.transient).toBeUndefined();

    const corruptPersistedMessage = stateSignal.toDBMessage();
    const signalMetadata = corruptPersistedMessage.content.metadata?.signal as Record<string, unknown>;
    signalMetadata.transient = true;
    expect(() => mastraDBMessageToSignal(corruptPersistedMessage)).toThrow('state signals cannot be transient');
  });
});
