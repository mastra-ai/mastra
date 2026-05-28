import type { ScheduleResponse } from '@mastra/client-js';
import type { HeartbeatInput } from '@mastra/core/agent';

export type HeartbeatMode = 'threaded' | 'threadless';

export interface ParsedHeartbeat {
  agentId: string;
  prompt: string;
  threadId?: string;
  resourceId?: string;
  mode: HeartbeatMode;
  signalType?: string;
  ifActive?: HeartbeatInput['ifActive'];
  ifIdle?: HeartbeatInput['ifIdle'];
  activeHours?: HeartbeatInput['activeHours'];
  idleThresholdMs?: number;
}

/**
 * Best-effort parse of `Schedule.target.inputData` into the heartbeat
 * payload shape. Returns `null` when the payload is missing required
 * heartbeat fields (e.g. a non-heartbeat schedule row).
 */
export function parseHeartbeatInput(schedule: ScheduleResponse): ParsedHeartbeat | null {
  const input = schedule.target?.inputData;
  if (!input || typeof input !== 'object') return null;

  const record = input as Record<string, unknown>;
  const agentId = typeof record.agentId === 'string' ? record.agentId : undefined;
  const prompt = typeof record.prompt === 'string' ? record.prompt : undefined;
  if (!agentId || prompt === undefined) return null;

  const threadId = typeof record.threadId === 'string' ? record.threadId : undefined;
  const resourceId = typeof record.resourceId === 'string' ? record.resourceId : undefined;

  return {
    agentId,
    prompt,
    threadId,
    resourceId,
    mode: threadId ? 'threaded' : 'threadless',
    signalType: typeof record.signalType === 'string' ? record.signalType : undefined,
    ifActive: record.ifActive as HeartbeatInput['ifActive'],
    ifIdle: record.ifIdle as HeartbeatInput['ifIdle'],
    activeHours: record.activeHours as HeartbeatInput['activeHours'],
    idleThresholdMs: typeof record.idleThresholdMs === 'number' ? record.idleThresholdMs : undefined,
  };
}
