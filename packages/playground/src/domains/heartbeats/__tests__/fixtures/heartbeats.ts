import type {
  Heartbeat,
  HeartbeatTrigger,
  ListHeartbeatsResponse,
  ListHeartbeatTriggersResponse,
} from '@mastra/client-js';

export function makeHeartbeat(overrides: Partial<Heartbeat> = {}): Heartbeat {
  const now = Date.now();
  return {
    id: 'hb_chef_thread-1',
    agentId: 'chef',
    threadId: 'thread-1',
    prompt: 'check in with the user',
    cron: '*/30 * * * * *',
    timezone: 'UTC',
    status: 'active',
    nextFireAt: now + 30_000,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

export function makeHeartbeatList(heartbeats: Heartbeat[]): ListHeartbeatsResponse {
  return { heartbeats };
}

export function makeHeartbeatTrigger(overrides: Partial<HeartbeatTrigger> = {}): HeartbeatTrigger {
  const fired = Date.now() - 60_000;
  return {
    id: `trg_${fired}`,
    scheduleId: 'hb_chef_thread-1',
    runId: `sched_hb_chef_thread-1_${fired}`,
    scheduledFireAt: fired,
    actualFireAt: fired,
    outcome: 'succeeded',
    run: {
      status: 'success',
      startedAt: fired,
      completedAt: fired + 1500,
      durationMs: 1500,
    },
    ...overrides,
  };
}

export function makeHeartbeatTriggersResponse(triggers: HeartbeatTrigger[]): ListHeartbeatTriggersResponse {
  return { triggers };
}
