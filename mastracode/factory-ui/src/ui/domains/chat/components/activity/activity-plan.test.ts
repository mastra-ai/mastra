import { describe, expect, it } from 'vitest';

import type { MessageEntry, NoticeEntry, SuspensionPrompt } from '../../services/transcript';
import type { MessagePart } from '../transcript-parts';
import { planTurnActivity, sameEntryActivity } from './activity-plan';
import type { EntryActivity } from './activity-plan';

const NO_SUSPENSIONS: ReadonlyMap<string, SuspensionPrompt> = new Map();

const assistant = (id: string, parts: MessagePart[], streaming = false): MessageEntry => ({
  kind: 'message',
  id,
  streaming,
  message: { id, role: 'assistant', createdAt: new Date(0), content: { format: 2, parts } },
});

const tool = (toolCallId: string, toolName = 'view', settled = true): MessagePart => ({
  type: 'tool-invocation',
  toolInvocation: settled
    ? { state: 'result', toolCallId, toolName, args: { path: `${toolCallId}.ts` }, result: 'ok' }
    : { state: 'call', toolCallId, toolName, args: { path: `${toolCallId}.ts` } },
});

const text = (value: string): MessagePart => ({ type: 'text', text: value });
const reasoning = (value: string): MessagePart => ({ type: 'reasoning', reasoning: value, details: [] });
const notice = (id: string): NoticeEntry => ({ kind: 'notice', id, level: 'info', text: 'Compacted' });
const suspension = (toolCallId: string): SuspensionPrompt => ({
  kind: 'suspension',
  id: `prompt-${toolCallId}`,
  toolCallId,
  toolName: 'ask_user',
  args: {},
  suspendPayload: { question: 'Which branch?' },
});

/** The member keys of every stretch, in turn order. */
function stretches(plan: ReadonlyMap<string, EntryActivity>): string[][] {
  return [...plan.values()].flatMap(activity =>
    [...activity.hosts.values()].map(stretch => stretch.members.map(member => member.key)),
  );
}

describe('planTurnActivity', () => {
  it('draws a reloaded turn split into one step per call as a single stretch, hosted by the first step', () => {
    const plan = planTurnActivity(
      [assistant('s1', [tool('a')]), assistant('s2', [tool('b')]), assistant('s3', [tool('c')])],
      NO_SUSPENSIONS,
      false,
    );

    expect(stretches(plan)).toEqual([['a', 'b', 'c']]);
    expect([...(plan.get('s1')?.hosts.keys() ?? [])]).toEqual(['a']);
    expect(plan.get('s2')).toEqual({ hosts: new Map(), hidden: new Set(['b']) });
    expect(plan.get('s3')).toEqual({ hosts: new Map(), hidden: new Set(['c']) });
  });

  it('splits stretches at visible prose', () => {
    const plan = planTurnActivity([assistant('s1', [tool('a'), text('Found it.'), tool('b')])], NO_SUSPENSIONS, false);
    expect(stretches(plan)).toEqual([['a'], ['b']]);
  });

  it('keeps a stretch together across text that draws nothing', () => {
    const plan = planTurnActivity(
      [assistant('s1', [tool('a')]), assistant('s2', [text('\u200B'), tool('b')])],
      NO_SUSPENSIONS,
      false,
    );
    expect(stretches(plan)).toEqual([['a', 'b']]);
  });

  it('keeps a stretch together across empty settled reasoning', () => {
    const plan = planTurnActivity([assistant('s1', [tool('a'), reasoning(''), tool('b')])], NO_SUSPENSIONS, false);
    expect(stretches(plan)).toEqual([['a', 'b']]);
  });

  it('folds visible reasoning into the stretch', () => {
    const plan = planTurnActivity([assistant('s1', [reasoning('Check the parser'), tool('a')])], NO_SUSPENSIONS, false);
    expect(stretches(plan)).toEqual([['s1:0', 'a']]);
  });

  it('splits around a question, before and after the question is suspended', () => {
    const entries = [assistant('s1', [tool('a'), tool('ask', 'ask_user', false), tool('b')])];

    expect(stretches(planTurnActivity(entries, NO_SUSPENSIONS, true))).toEqual([['a'], ['b']]);
    expect(stretches(planTurnActivity(entries, new Map([['ask', suspension('ask')]]), true))).toEqual([['a'], ['b']]);
  });

  it('splits at a notice between steps', () => {
    const plan = planTurnActivity(
      [assistant('s1', [tool('a')]), notice('n1'), assistant('s2', [tool('b')])],
      NO_SUSPENSIONS,
      false,
    );
    expect(stretches(plan)).toEqual([['a'], ['b']]);
  });

  it('keeps a stretch together across a signal that draws nothing', () => {
    const hiddenSignal: MessageEntry = {
      kind: 'message',
      id: 'sig',
      message: {
        id: 'sig',
        role: 'signal',
        createdAt: new Date(0),
        content: {
          format: 2,
          parts: [text('- [ ] task')],
          metadata: { signal: { type: 'state', tagName: 'tasks' } },
        },
      },
    };
    const plan = planTurnActivity(
      [assistant('s1', [tool('a')]), hiddenSignal, assistant('s2', [tool('b')])],
      NO_SUSPENSIONS,
      false,
    );
    expect(stretches(plan)).toEqual([['a', 'b']]);
  });

  describe('live', () => {
    const liveness = (plan: ReadonlyMap<string, EntryActivity>) =>
      [...plan.values()].flatMap(activity => [...activity.hosts.values()].map(stretch => stretch.live));

    it('marks only the stretch the running turn is still in', () => {
      const entries = [assistant('s1', [tool('a'), text('Next.'), tool('b')], true)];
      expect(liveness(planTurnActivity(entries, NO_SUSPENSIONS, true))).toEqual([false, true]);
      expect(liveness(planTurnActivity(entries, NO_SUSPENSIONS, false))).toEqual([false, false]);
    });

    it('marks an earlier stretch whose call is still running', () => {
      const entries = [assistant('s1', [tool('a', 'execute_command', false), text('Meanwhile.')], true)];
      expect(liveness(planTurnActivity(entries, NO_SUSPENSIONS, true))).toEqual([true]);
    });
  });

  describe('elapsed time', () => {
    const elapsed = (plan: ReadonlyMap<string, EntryActivity>) =>
      [...plan.values()].flatMap(activity => [...activity.hosts.values()].map(stretch => stretch.elapsedMs));
    const at = (part: MessagePart, createdAt: number): MessagePart => ({ ...part, createdAt });
    const steps = [
      assistant('s1', [at(reasoning('Check the parser'), 1_000), tool('a')]),
      assistant('s2', [tool('b'), at(text('Found it.'), 37_000)]),
    ];

    it('measures a settled stretch from its first member to the prose that ends it, across steps', () => {
      expect(elapsed(planTurnActivity(steps, NO_SUSPENSIONS, false))).toEqual([36_000]);
    });

    it('leaves a stretch unmeasured while it is live or when nothing came after it', () => {
      expect(elapsed(planTurnActivity([assistant('s1', [at(tool('a'), 1_000)])], NO_SUSPENSIONS, false))).toEqual([
        undefined,
      ]);
      expect(elapsed(planTurnActivity([steps[0]], NO_SUSPENSIONS, true))).toEqual([undefined]);
    });
  });
});

describe('sameEntryActivity', () => {
  it('matches plans built from the same entries, so settled entries skip re-rendering', () => {
    const entries = [assistant('s1', [tool('a')]), assistant('s2', [reasoning('Hmm'), tool('b')])];
    const first = planTurnActivity(entries, NO_SUSPENSIONS, true);
    const second = planTurnActivity(entries, NO_SUSPENSIONS, true);

    expect(sameEntryActivity(first.get('s1'), second.get('s1'))).toBe(true);
    expect(sameEntryActivity(first.get('s2'), second.get('s2'))).toBe(true);
  });

  it('tells the host apart once a later member changes', () => {
    const before = [assistant('s1', [tool('a')]), assistant('s2', [tool('b', 'view', false)])];
    const after = [before[0], assistant('s2', [tool('b')])];

    expect(
      sameEntryActivity(
        planTurnActivity(before, NO_SUSPENSIONS, true).get('s1'),
        planTurnActivity(after, NO_SUSPENSIONS, true).get('s1'),
      ),
    ).toBe(false);
  });
});
