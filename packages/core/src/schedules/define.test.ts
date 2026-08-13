import { describe, expect, it } from 'vitest';
import {
  defineSchedule,
  assertValidScheduleDefinition,
  fsAgentScheduleRowId,
  parseFsAgentScheduleRowId,
  FS_AGENT_SCHEDULE_PREFIX,
} from './define';
import { AGENT_SCHEDULE_PREFIX, SCHEDULE_SIGNAL_TYPES, WORKFLOW_SCHEDULE_PREFIX } from './types';

describe('defineSchedule', () => {
  it('returns the definition unchanged (identity)', () => {
    const definition = { cron: '0 9 * * *', prompt: 'Send the daily digest.' };
    expect(defineSchedule(definition)).toBe(definition);
  });

  it('accepts handler mode without a prompt', () => {
    const definition = { cron: '*/5 * * * *', handler: async () => ({ prompt: 'computed' }) };
    expect(defineSchedule(definition)).toBe(definition);
  });

  it('rejects a definition with both a prompt and a handler', () => {
    expect(() => defineSchedule({ cron: '0 9 * * *', prompt: 'hi', handler: () => undefined } as any)).toThrowError(
      /exactly one execution mode/,
    );
  });

  it('rejects a definition with neither a prompt nor a handler', () => {
    expect(() => defineSchedule({ cron: '0 9 * * *' } as any)).toThrowError(/exactly one execution mode/);
  });

  it('treats a whitespace-only prompt as missing', () => {
    expect(() => defineSchedule({ cron: '0 9 * * *', prompt: '   ' })).toThrowError(/exactly one execution mode/);
  });

  it('rejects an invalid cron expression', () => {
    expect(() => defineSchedule({ cron: 'not a cron', prompt: 'hi' })).toThrowError(/cron/i);
  });

  it('rejects an invalid timezone', () => {
    expect(() => defineSchedule({ cron: '0 9 * * *', prompt: 'hi', timezone: 'Mars/Olympus' })).toThrowError();
  });

  it('rejects an unknown signalType', () => {
    expect(() => defineSchedule({ cron: '0 9 * * *', prompt: 'hi', signalType: 'bogus' as any })).toThrowError(
      /unknown signalType "bogus"/,
    );
  });

  it('rejects an unknown status', () => {
    expect(() => defineSchedule({ cron: '0 9 * * *', prompt: 'hi', status: 'pausd' as any })).toThrowError(
      /unknown status "pausd"/,
    );
  });

  it('accepts every supported signalType', () => {
    for (const signalType of SCHEDULE_SIGNAL_TYPES) {
      expect(() => defineSchedule({ cron: '0 9 * * *', prompt: 'hi', signalType })).not.toThrow();
    }
  });

  it('rejects a threadId without a resourceId', () => {
    expect(() => defineSchedule({ cron: '0 9 * * *', prompt: 'hi', threadId: 'thread-1' })).toThrowError(
      /'resourceId' is required/,
    );
  });

  it('accepts a threadId paired with a resourceId', () => {
    expect(() =>
      defineSchedule({ cron: '0 9 * * *', prompt: 'hi', threadId: 'thread-1', resourceId: 'user-1' }),
    ).not.toThrow();
  });
});

describe('assertValidScheduleDefinition', () => {
  it('names the offending schedule in the error text', () => {
    expect(() =>
      assertValidScheduleDefinition({ cron: '0 9 * * *' } as any, 'agents/support/schedules/x'),
    ).toThrowError(/agents\/support\/schedules\/x/);
  });

  it('rejects a non-object definition', () => {
    expect(() => assertValidScheduleDefinition(null as any, 'agents/support/schedules/x')).toThrowError(
      /expected a schedule definition object/,
    );
  });
});

describe('fs agent schedule row ids', () => {
  it('round-trips the agent id and path-derived key', () => {
    const rowId = fsAgentScheduleRowId('support', 'billing/sweep');
    expect(parseFsAgentScheduleRowId(rowId)?.agentId).toBe('support');
    expect(parseFsAgentScheduleRowId(rowId)?.key).toBe('billing/sweep');
  });

  it('round-trips ids containing the delimiter', () => {
    const rowId = fsAgentScheduleRowId('a__b', 'c__d/e');
    expect(parseFsAgentScheduleRowId(rowId)?.agentId).toBe('a__b');
    expect(parseFsAgentScheduleRowId(rowId)?.key).toBe('c__d/e');
  });

  it('produces distinct ids for agents whose names would otherwise collide', () => {
    expect(fsAgentScheduleRowId('a', 'b/c')).not.toBe(fsAgentScheduleRowId('a/b', 'c'));
  });

  it('uses a prefix no other schedule source claims', () => {
    const rowId = fsAgentScheduleRowId('support', 'heartbeat');
    expect(rowId.startsWith(FS_AGENT_SCHEDULE_PREFIX)).toBe(true);
    expect(rowId.startsWith(AGENT_SCHEDULE_PREFIX)).toBe(false);
    expect(rowId.startsWith(WORKFLOW_SCHEDULE_PREFIX)).toBe(false);
    expect(rowId.startsWith('wf_')).toBe(false);
  });

  it('returns undefined for rows owned by another schedule source', () => {
    expect(parseFsAgentScheduleRowId('agent_nightly')?.agentId).toBeUndefined();
    expect(parseFsAgentScheduleRowId('wf_my-workflow')?.agentId).toBeUndefined();
    expect(parseFsAgentScheduleRowId('agent_nightly')?.key).toBeUndefined();
  });

  it('returns undefined for a malformed row id missing the delimiter', () => {
    expect(parseFsAgentScheduleRowId(`${FS_AGENT_SCHEDULE_PREFIX}support`)?.agentId).toBeUndefined();
    expect(parseFsAgentScheduleRowId(`${FS_AGENT_SCHEDULE_PREFIX}support`)?.key).toBeUndefined();
  });
});
