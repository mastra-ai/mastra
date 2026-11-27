import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  nextAttemptStart,
  suspendedAttempt,
  suspendEnvelope,
  toolSuspendPayload,
  unwrapSuspendData,
} from './workflow-id';

afterEach(() => {
  vi.restoreAllMocks();
});

const attempt = { ownerId: 'worker-a', startedAt: 1234 };

describe('background-task suspend data', () => {
  it.each([
    ['an array', ['A', 'B']],
    ['an empty object', {}],
    ['a string', 'Approve?'],
    ['null', null],
    ['nothing', undefined],
  ])('gives the tool back %s as it suspended with it', (_name, payload) => {
    const data = suspendEnvelope(payload, attempt);
    expect(toolSuspendPayload(data)).toEqual(payload);
    expect(unwrapSuspendData(data)).toEqual(payload);
    expect(suspendedAttempt(data)).toEqual(attempt);
  });

  it('strips the sub-agent bridge inside an envelope as without one', () => {
    const saved = { question: 'Approve?', suspendedToolRunId: 'run' };
    expect(toolSuspendPayload(suspendEnvelope(saved, attempt))).toEqual({ question: 'Approve?' });
    expect(toolSuspendPayload(saved)).toEqual({ question: 'Approve?' });
    expect(toolSuspendPayload(suspendEnvelope({ suspendedToolRunId: 'run' }, attempt))).toBeUndefined();
  });

  it('reads data saved without an envelope as before', () => {
    expect(unwrapSuspendData({ question: 'Approve?' })).toEqual({ question: 'Approve?' });
    expect(toolSuspendPayload('Approve?')).toBe('Approve?');
    expect(suspendedAttempt({ question: 'Approve?' })).toBeUndefined();
  });
});

describe('nextAttemptStart', () => {
  it('names a later attempt behind a skewed clock and never repeats one within a millisecond', () => {
    const frozenNow = Date.now();
    vi.spyOn(Date, 'now').mockReturnValue(frozenNow);
    const first = nextAttemptStart(undefined).getTime();
    expect(first).toBeGreaterThanOrEqual(frozenNow);
    expect(nextAttemptStart(undefined).getTime()).toBe(first + 1);
    expect(nextAttemptStart(new Date(first + 5000)).getTime()).toBe(first + 5001);
    expect(nextAttemptStart(new Date(0)).getTime()).toBe(first + 5002);
  });
});
