import { describe, expect, it, vi } from 'vitest';
import type { ActorSignal } from '../../auth/ee';
import { PUBSUB_SYMBOL, STREAM_FORMAT_SYMBOL } from '../constants';
import { runAgentEntry } from './run-agent-entry';
import { runToolEntry } from './run-tool-entry';
import type { EntryExecuteContext } from './types';

/**
 * Pins the opt-in contract for propagating a run's FGA `actor` into the
 * agent/tool calls the framework makes for declarative `.then(agent)` /
 * `.then(tool)` steps. Propagation must never be implicit: only an object-form
 * actor carrying `propagate: true` is inherited, and per-step options always win.
 */

function makeRecordingAgent(record: (opts: any) => void) {
  return {
    name: 'agent-1',
    getModel: async () => ({ specificationVersion: 'v1' }),
    streamLegacy: async (_prompt: string, opts: any) => {
      record(opts);
      return {
        fullStream: (async function* () {
          opts.onFinish?.({ text: 'done' });
        })(),
      };
    },
  };
}

function makeCtx(actor: ActorSignal | undefined): EntryExecuteContext {
  return {
    inputData: { prompt: 'hi' },
    runId: 'run-1',
    workflowId: 'wf-1',
    [PUBSUB_SYMBOL]: { publish: async () => {} },
    [STREAM_FORMAT_SYMBOL]: 'legacy',
    requestContext: {},
    actor,
    abortSignal: new AbortController().signal,
    abort: () => {},
    writer: undefined,
  } as unknown as EntryExecuteContext;
}

async function agentActorFor(ctxActor: ActorSignal | undefined, options?: Record<string, unknown>) {
  const record = vi.fn();
  await runAgentEntry(
    { type: 'agent', id: 'step-1', agentId: 'agent-1', agent: makeRecordingAgent(record), options },
    makeCtx(ctxActor),
  );
  return record.mock.calls[0]![0].actor;
}

async function toolActorFor(ctxActor: ActorSignal | undefined, options?: Record<string, unknown>) {
  const execute = vi.fn(async () => ({ ok: true }));
  await runToolEntry(
    { type: 'tool', id: 'step-1', toolId: 'tool-1', tool: { id: 'tool-1', execute }, options },
    makeCtx(ctxActor),
  );
  return (execute.mock.calls[0]! as any[])[1].actor;
}

describe.each([
  ['agent step', agentActorFor],
  ['tool step', toolActorFor],
])('declarative %s actor propagation', (_label, actorFor) => {
  const propagating: ActorSignal = { actorKind: 'system', propagate: true };

  it('forwards the run actor when it opts in with propagate: true', async () => {
    expect(await actorFor(propagating)).toEqual(propagating);
  });

  it('does not forward a system actor that has not opted in', async () => {
    expect(await actorFor({ actorKind: 'system' })).toBeUndefined();
  });

  it('never forwards the `true` shorthand', async () => {
    expect(await actorFor(true)).toBeUndefined();
  });

  it('lets an explicit step actor override a propagating run actor', async () => {
    const stepActor: ActorSignal = { actorKind: 'system', agentId: 'step-scoped' };
    expect(await actorFor(propagating, { actor: stepActor })).toEqual(stepActor);
  });

  it('treats an explicit `actor: undefined` step option as the escape hatch', async () => {
    expect(await actorFor(propagating, { actor: undefined })).toBeUndefined();
  });

  it('leaves the actor unset when the run has none', async () => {
    expect(await actorFor(undefined)).toBeUndefined();
  });

  it('cannot be triggered from ambient request context', async () => {
    // Only a run-level actor signal is trusted; request context is caller-shaped
    // data and must never be able to grant or widen system trust.
    const ctx = makeCtx(undefined);
    (ctx as any).requestContext = {
      get: (key: string) => (key === 'actor' ? { actorKind: 'system', propagate: true } : undefined),
    };

    const record = vi.fn();
    if (actorFor === agentActorFor) {
      await runAgentEntry({ type: 'agent', id: 's', agentId: 'agent-1', agent: makeRecordingAgent(record) }, ctx);
      expect(record.mock.calls[0]![0].actor).toBeUndefined();
    } else {
      const execute = vi.fn(async () => ({ ok: true }));
      await runToolEntry({ type: 'tool', id: 's', toolId: 'tool-1', tool: { id: 'tool-1', execute } }, ctx);
      expect((execute.mock.calls[0]! as any[])[1].actor).toBeUndefined();
    }
  });
});
