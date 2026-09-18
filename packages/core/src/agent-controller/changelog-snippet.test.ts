import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect } from 'vitest';
import type { MastraDBMessage, MastraMessagePart } from '../agent/message-list/state/types';
import { applyUpdate } from './apply-update';
import type { AgentControllerEvent } from './types';

/**
 * Regression for the published migration guidance in `.changeset/fresh-parrots-fix.md`.
 *
 * The snippet tells consumers to fold compact `message_update` deltas with
 * `applyUpdate` and store the result. That fold is total: a delta that does not
 * apply returns `undefined`, so the snippet only works with the `if (updated)`
 * guard. This file replays a captured compact sequence for one assistant turn
 * through the verbatim snippet and pins the guard by asserting what the
 * unguarded form does. It also reads the changeset itself, because the copies
 * below are re-typed and would not otherwise notice a change to the published
 * text.
 */

const MESSAGE_ID = 'm1';

function assistantMessage(parts: MastraMessagePart[]): MastraDBMessage {
  return { id: MESSAGE_ID, role: 'assistant', content: { format: 2, parts }, createdAt: new Date() };
}

/**
 * One assistant turn, as captured from the emitter: an opening `message_start`
 * whose text part is empty, two text deltas, then a `reasoning-delta` that does
 * not address a reasoning part (the mitigated case — a consumer folding a
 * partial stream sees this), and an id-only `message_end`.
 */
function capturedSequence(): AgentControllerEvent[] {
  return [
    { type: 'message_start', message: assistantMessage([{ type: 'text', text: '' }]) },
    { type: 'message_update', id: MESSAGE_ID, event: { type: 'text-delta', delta: 'Hello' } },
    { type: 'message_update', id: MESSAGE_ID, event: { type: 'text-delta', delta: ' world' } },
    {
      type: 'message_update',
      id: MESSAGE_ID,
      event: { type: 'reasoning-delta', index: 0, delta: 'not a reasoning part' },
    },
    { type: 'message_end', id: MESSAGE_ID },
  ];
}

function textOf(message: MastraDBMessage | undefined): string {
  if (!message || typeof message.content === 'string') return '';
  return message.content.parts
    .filter((part): part is Extract<MastraMessagePart, { type: 'text' }> => part.type === 'text')
    .map(part => part.text)
    .join('');
}

describe('changelog migration snippet', () => {
  it('recovers the full turn text with the published guarded snippet', () => {
    const messages = new Map<string, MastraDBMessage | undefined>();

    for (const event of capturedSequence()) {
      // The snippet verbatim, including its `if (updated)` guard.
      if (event.type === 'message_start') messages.set(event.message.id, event.message);
      if (event.type === 'message_update') {
        const updated = applyUpdate(messages.get(event.id), event.event);
        if (updated) messages.set(event.id, updated);
      }
    }

    expect(textOf(messages.get(MESSAGE_ID))).toBe('Hello world');
  });

  it('loses the text when the guard is dropped', () => {
    const messages = new Map<string, MastraDBMessage | undefined>();

    for (const event of capturedSequence()) {
      if (event.type === 'message_start') messages.set(event.message.id, event.message);
      // Unguarded form: the non-applying reasoning delta overwrites the entry with undefined.
      if (event.type === 'message_update') messages.set(event.id, applyUpdate(messages.get(event.id), event.event));
    }

    const stored = messages.get(MESSAGE_ID);
    expect(stored).toBeUndefined();
    // Reading the entry the snippet stored is what a consumer does next, and that throws.
    expect(() => stored!.content.parts).toThrow(TypeError);
  });

  it('recovers only the opening part when the deltas are never folded', () => {
    const messages = new Map<string, MastraDBMessage | undefined>();

    for (const event of capturedSequence()) {
      if (event.type === 'message_start') messages.set(event.message.id, event.message);
    }

    // The naive read this segment exists to fix: message_start alone is not the turn's text.
    expect(textOf(messages.get(MESSAGE_ID))).toBe('');
  });

  const changesetPath = resolve(import.meta.dirname, '../../../../.changeset/fresh-parrots-fix.md');

  // `changeset version` deletes a changeset once it ships and moves its text
  // into the released CHANGELOG, so this only applies while the guidance is
  // still pending. Skipped, not failed, after that.
  it.skipIf(!existsSync(changesetPath))(
    'publishes a Migration snippet that carries the fold, the guard, and the Session alternative',
    () => {
      // The changeset is the published guidance; this file is its executable form.
      // Reading the block here is what keeps the two from drifting: the snippets
      // above are a re-typed copy, so without this check a change to the changeset
      // would leave every test above green.
      const changeset = readFileSync(changesetPath, 'utf8');
      const migration = changeset.slice(changeset.indexOf('**Migration**'));
      const snippet = migration.match(/```ts\n([\s\S]*?)```/)?.[1] ?? '';

      expect(snippet).toContain("import { applyUpdate } from '@mastra/core/agent-controller'");
      expect(snippet).toContain('applyUpdate(messages.get(event.id), event.event)');
      expect(snippet).toContain('if (updated) messages.set(event.id, updated)');
      expect(migration).toContain('session.displayState.get().currentMessage');
    },
  );
});
