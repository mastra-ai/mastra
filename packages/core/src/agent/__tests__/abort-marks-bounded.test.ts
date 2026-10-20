import { describe, expect, it } from 'vitest';

import { EventEmitterPubSub } from '../../events/event-emitter';
import { AgentThreadStreamRuntime } from '../thread-stream-runtime';

describe('abort marks for runs without a prepared run', () => {
  // Parked and durable runs have no prepared run, so no run cleanup ever clears their abort
  // marks. They must stay bounded for the life of the process.
  it('keeps the newest abort marks and drops the oldest past the cap', () => {
    const runtime = new AgentThreadStreamRuntime();
    const pubsub = new EventEmitterPubSub();

    for (let i = 0; i < 1001; i++) runtime.abortRun(`run-${i}`, pubsub);

    expect(runtime.isRunAborted('run-0', pubsub)).toBe(false);
    expect(runtime.isResumeFenced('run-0', pubsub)).toBe(false);
    expect(runtime.isRunAborted('run-1', pubsub)).toBe(true);
    expect(runtime.isRunAborted('run-1000', pubsub)).toBe(true);
    expect(runtime.isResumeFenced('run-1000', pubsub)).toBe(true);
  });

  it('keeps the abort mark of a run that is not fenced by the abort', () => {
    const runtime = new AgentThreadStreamRuntime();
    const pubsub = new EventEmitterPubSub();

    runtime.abortRun('detached', pubsub, { fenceResume: false });

    expect(runtime.isRunAborted('detached', pubsub)).toBe(true);
    expect(runtime.isResumeFenced('detached', pubsub)).toBe(false);
  });
});
