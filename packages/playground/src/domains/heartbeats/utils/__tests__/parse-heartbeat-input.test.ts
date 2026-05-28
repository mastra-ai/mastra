import type { ScheduleResponse } from '@mastra/client-js';
import { describe, expect, it } from 'vitest';
import { parseHeartbeatInput } from '../parse-heartbeat-input';

function makeSchedule(inputData: unknown): ScheduleResponse {
  return {
    id: 'hb',
    cron: '* * * * *',
    status: 'active',
    target: { type: 'workflow', workflowId: '__mastra_heartbeat__', inputData },
  } as unknown as ScheduleResponse;
}

describe('parseHeartbeatInput', () => {
  it('parses a threaded heartbeat payload', () => {
    const parsed = parseHeartbeatInput(
      makeSchedule({ agentId: 'chef', threadId: 't1', resourceId: 'r1', prompt: 'tick' }),
    );
    expect(parsed).toEqual(
      expect.objectContaining({ agentId: 'chef', threadId: 't1', resourceId: 'r1', prompt: 'tick', mode: 'threaded' }),
    );
  });

  it('parses a threadless heartbeat payload', () => {
    const parsed = parseHeartbeatInput(makeSchedule({ agentId: 'chef', prompt: 'tick' }));
    expect(parsed?.mode).toBe('threadless');
    expect(parsed?.threadId).toBeUndefined();
  });

  it('returns null when inputData is missing required fields', () => {
    expect(parseHeartbeatInput(makeSchedule(null))).toBeNull();
    expect(parseHeartbeatInput(makeSchedule({ agentId: 'chef' }))).toBeNull();
    expect(parseHeartbeatInput(makeSchedule({ prompt: 'tick' }))).toBeNull();
  });
});
