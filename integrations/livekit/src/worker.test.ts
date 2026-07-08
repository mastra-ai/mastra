import { InferenceRunner, voice } from '@livekit/agents';
import type { JobContext, JobProcess } from '@livekit/agents';
import type { Mastra } from '@mastra/core/mastra';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createLiveKitWorker,
  DEFAULT_END_CALL_REASON,
  resolveGreetingConfig,
  resolveGreetingText,
  resolveMemoryInstance,
  resolveSessionComponent,
  runEndCall,
  speakGreeting,
  waitForAgentDoneSpeaking,
} from './worker';
import type { GreetingContext, ResolveMastraAgentArgs, VoiceCallContext } from './worker';
import { workerSetupComplete } from './worker-setup';

function fakeMastra(overrides: Partial<Record<'getAgentById' | 'getAgent' | 'getLogger', unknown>> = {}): Mastra {
  return {
    getAgentById: vi.fn(() => {
      throw new Error('not found');
    }),
    getAgent: vi.fn(() => {
      throw new Error('not found');
    }),
    getLogger: vi.fn(() => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() })),
    ...overrides,
  } as unknown as Mastra;
}

function fakeJobContext(metadata?: string): JobContext {
  return {
    job: { metadata },
    proc: { userData: {} },
    room: { name: 'room-1' },
    connect: vi.fn(async () => {}),
  } as unknown as JobContext;
}

describe('createLiveKitWorker', () => {
  // createLiveKitWorker prunes InferenceRunner.registeredRunners (a process-global), so
  // snapshot and restore it around each test to keep registry state from leaking between tests.
  let runnerSnapshot: Record<string, unknown>;
  beforeEach(() => {
    runnerSnapshot = { ...InferenceRunner.registeredRunners };
  });
  afterEach(() => {
    for (const key of Object.keys(InferenceRunner.registeredRunners)) {
      delete InferenceRunner.registeredRunners[key];
    }
    Object.assign(InferenceRunner.registeredRunners, runnerSnapshot);
  });

  it('registers only the requested turn detector inference runner before the server starts', async () => {
    createLiveKitWorker({ mastra: fakeMastra(), vad: false, turnDetection: 'multilingual' });
    // runLiveKitWorker awaits this before booting the agent server; the server only
    // spawns its inference process for runners registered by that point.
    await workerSetupComplete();
    const runners = Object.keys(InferenceRunner.registeredRunners);
    expect(runners).toContain('lk_end_of_utterance_multilingual');
    // The unused language model is pruned so the inference process doesn't demand its files.
    expect(runners).not.toContain('lk_end_of_utterance_en');
  });

  it('returns a LiveKit agent definition', () => {
    const definition = createLiveKitWorker({ mastra: fakeMastra(), vad: false });
    expect(typeof definition.entry).toBe('function');
    expect(typeof definition.prewarm).toBe('function');
  });

  it('rejects `generate` combined with `agent`', () => {
    expect(() => createLiveKitWorker({ mastra: fakeMastra(), generate: vi.fn(), agent: 'callCenter' })).toThrow(
      /exactly one reply generator/,
    );
  });

  it('rejects `generate` combined with `workflow`', () => {
    expect(() =>
      createLiveKitWorker({ mastra: fakeMastra(), generate: vi.fn(), workflow: 'phone', workflowInput: () => ({}) }),
    ).toThrow(/exactly one reply generator/);
  });

  it('rejects `agent` combined with `workflow`', () => {
    expect(() =>
      createLiveKitWorker({ mastra: fakeMastra(), agent: 'callCenter', workflow: 'phone', workflowInput: () => ({}) }),
    ).toThrow(/mutually exclusive/);
  });

  it('rejects `configuration.endCall` combined with `generate`', () => {
    expect(() =>
      createLiveKitWorker({
        mastra: fakeMastra(),
        generate: vi.fn(),
        configuration: { endCall: {} },
      }),
    ).toThrow(/`configuration.endCall` has no effect with `generate`/);
  });

  it('does not load a VAD during prewarm when vad is disabled', async () => {
    const definition = createLiveKitWorker({ mastra: fakeMastra(), vad: false });
    const proc = { userData: {} } as JobProcess<Record<string, unknown>>;
    await definition.prewarm?.(proc);
    expect(proc.userData.vad).toBeUndefined();
  });

  it('fails with a helpful error when no Mastra agent is specified', async () => {
    const definition = createLiveKitWorker({ mastra: fakeMastra(), vad: false });
    await expect(definition.entry(fakeJobContext())).rejects.toThrow(/no Mastra agent specified/);
  });

  it('resolves the agent by id and falls back to the registered key', async () => {
    const getAgent = vi.fn(() => {
      // Resolution succeeded; abort the session setup that follows.
      throw new Error('STOP_TEST');
    });
    const mastra = fakeMastra({ getAgent });
    const definition = createLiveKitWorker({ mastra, vad: false });
    const ctx = fakeJobContext(JSON.stringify({ agentId: 'support' }));
    await expect(definition.entry(ctx)).rejects.toThrow('STOP_TEST');
    expect(mastra.getAgentById).toHaveBeenCalledWith('support');
    expect(getAgent).toHaveBeenCalledWith('support');
  });

  it('registers an onCallEnd shutdown callback that runs the hook with the call context', async () => {
    const onCallEnd = vi.fn();
    const agent = { id: 'support', name: 'support', hasOwnMemory: () => false };
    const mastra = fakeMastra({ getAgentById: vi.fn(() => agent) });
    const shutdownCallbacks: Array<() => Promise<void>> = [];
    const ctx = {
      job: { metadata: JSON.stringify({ agentId: 'support' }) },
      proc: { userData: {} },
      room: { name: 'room-9' },
      connect: vi.fn(async () => {}),
      addShutdownCallback: vi.fn((cb: () => Promise<void>) => shutdownCallbacks.push(cb)),
    } as unknown as JobContext;

    const definition = createLiveKitWorker({ mastra, vad: false, observability: false, onCallEnd });
    // Session start fails without a real LiveKit room — but that's AFTER the shutdown callback is
    // registered up front, which is exactly what we assert. Memory is off (agent has none), so the
    // callback carries `memory: false` / `memoryInstance: null`.
    await definition.entry(ctx).catch(() => {});

    expect(shutdownCallbacks).toHaveLength(1);
    expect(onCallEnd).not.toHaveBeenCalled();
    await shutdownCallbacks[0]!();
    expect(onCallEnd).toHaveBeenCalledTimes(1);
    expect(onCallEnd.mock.calls[0]![0]).toMatchObject({ roomName: 'room-9', memory: false, memoryInstance: null });
  });

  it('resolves per-call STT/TTS from the configuration resolvers with the call context', async () => {
    const agent = { id: 'support', name: 'support', hasOwnMemory: () => false };
    const mastra = fakeMastra({ getAgentById: vi.fn(() => agent) });
    const stt = vi.fn(() => 'deepgram/nova-3' as const);
    const tts = vi.fn(async () => 'cartesia/sonic-3' as const);
    const definition = createLiveKitWorker({
      mastra,
      vad: false,
      observability: false,
      configuration: { stt, tts },
    });
    const ctx = fakeJobContext(JSON.stringify({ agentId: 'support', requestContext: { tenant: 'meridian' } }));
    // Session start fails without a real LiveKit room; STT/TTS resolution happens before that.
    await definition.entry(ctx).catch(() => {});

    expect(stt).toHaveBeenCalledTimes(1);
    expect(tts).toHaveBeenCalledTimes(1);
    const context = stt.mock.calls[0]![0] as VoiceCallContext;
    expect(context.roomName).toBe('room-1');
    expect(context.ctx).toBe(ctx);
    expect(context.metadata.requestContext).toEqual({ tenant: 'meridian' });
    expect(context.requestContext).toBeDefined();
    // Both resolvers receive the same per-call context.
    expect(tts.mock.calls[0]![0]).toBe(context);
  });
});

describe('resolveMemoryInstance', () => {
  const args = { metadata: {}, ctx: fakeJobContext() } as unknown as ResolveMastraAgentArgs;
  type Agent = Parameters<typeof resolveMemoryInstance>[1];
  type Options = Parameters<typeof resolveMemoryInstance>[0];
  type MemoryInstanceOption = NonNullable<Options['memoryInstance']>;

  const fakeStorage = { id: 'mastra-store' };
  const mastra = { getStorage: vi.fn(() => fakeStorage) } as unknown as Options['mastra'];
  // A storage-less Memory mirrors the real shape resolveMemoryInstance touches.
  const makeMemory = (hasOwnStorage: boolean) =>
    ({ hasOwnStorage, setStorage: vi.fn(), __registerMastra: vi.fn() }) as unknown as MemoryInstanceOption & {
      setStorage: ReturnType<typeof vi.fn>;
      __registerMastra: ReturnType<typeof vi.fn>;
    };

  it('sources the instance from the agent on the agent path', async () => {
    const memory = { id: 'agent-mem' };
    const agent = { getMemory: vi.fn(async () => memory) } as unknown as Agent;
    // The agent path leaves storage to agent.getMemory(); no injection here.
    expect(await resolveMemoryInstance({ mastra }, agent, args, undefined)).toBe(memory);
  });

  it('injects Mastra storage into a storage-less memoryInstance (instance form)', async () => {
    const memory = makeMemory(false);
    const result = await resolveMemoryInstance({ mastra, memoryInstance: memory }, undefined, args, undefined);
    expect(result).toBe(memory);
    expect(memory.__registerMastra).toHaveBeenCalledWith(mastra);
    expect(memory.setStorage).toHaveBeenCalledWith(fakeStorage);
  });

  it('does not override storage when the memory already has its own', async () => {
    const memory = makeMemory(true);
    await resolveMemoryInstance({ mastra, memoryInstance: memory }, undefined, args, undefined);
    expect(memory.setStorage).not.toHaveBeenCalled();
  });

  it('uses the memoryInstance option (resolver form) when there is no agent', async () => {
    const memory = makeMemory(false);
    const resolver = vi.fn(async () => memory) as unknown as MemoryInstanceOption;
    expect(await resolveMemoryInstance({ mastra, memoryInstance: resolver }, undefined, args, undefined)).toBe(memory);
  });

  it('returns null when there is no agent and no memoryInstance', async () => {
    expect(await resolveMemoryInstance({ mastra }, undefined, args, undefined)).toBeNull();
  });
});

describe('resolveGreetingConfig (backwards compatibility)', () => {
  it('honors the deprecated top-level `greeting` string', () => {
    expect(resolveGreetingConfig({ greeting: 'Hello there' })).toEqual({
      text: 'Hello there',
      persist: undefined,
    });
  });

  it('honors the deprecated top-level `persistGreeting`', () => {
    expect(resolveGreetingConfig({ greeting: 'Hi', persistGreeting: false })).toEqual({
      text: 'Hi',
      persist: false,
    });
  });

  it('uses configuration.greeting when set', () => {
    const greeting = { text: 'Welcome', allowInterruptions: false, awaitPlayout: true };
    expect(resolveGreetingConfig({ configuration: { greeting } })).toEqual(greeting);
  });

  it('lets configuration.greeting.text take precedence over the deprecated top-level greeting', () => {
    const resolved = resolveGreetingConfig({
      greeting: 'legacy',
      persistGreeting: true,
      configuration: { greeting: { text: 'canonical' } },
    });
    expect(resolved.text).toBe('canonical');
    // Legacy fields still fill gaps the canonical config leaves open (additive merge).
    expect(resolved.persist).toBe(true);
  });

  it('merges: legacy provides the text, configuration adds the new behavior fields', () => {
    const resolved = resolveGreetingConfig({
      greeting: 'Disclosure line',
      configuration: { greeting: { allowInterruptions: false, repeatEvery: 180000 } },
    });
    expect(resolved).toEqual({
      text: 'Disclosure line',
      persist: undefined,
      allowInterruptions: false,
      repeatEvery: 180000,
    });
  });

  it('returns no greeting text when nothing is configured', () => {
    expect(resolveGreetingConfig({}).text).toBeUndefined();
  });
});

describe('resolveGreetingText', () => {
  const context: GreetingContext = {
    metadata: { requestContext: { tenant: 'meridian' } },
    roomName: 'room-1',
    ctx: fakeJobContext(),
  };

  it('returns a fixed string greeting as-is', async () => {
    expect(await resolveGreetingText('Hello there', context)).toBe('Hello there');
  });

  it('invokes the resolver form with the call context for a per-tenant greeting', async () => {
    const resolver = vi.fn((c: GreetingContext) => `Welcome to ${c.metadata.requestContext?.tenant}`);
    expect(await resolveGreetingText(resolver, context)).toBe('Welcome to meridian');
    expect(resolver).toHaveBeenCalledWith(context);
  });

  it('awaits an async resolver', async () => {
    expect(await resolveGreetingText(async () => 'async greeting', context)).toBe('async greeting');
  });

  it('normalizes an undefined / empty resolver result to undefined (no greeting)', async () => {
    expect(await resolveGreetingText(() => undefined, context)).toBeUndefined();
    expect(await resolveGreetingText(() => '', context)).toBeUndefined();
  });

  it('treats undefined text as no greeting', async () => {
    expect(await resolveGreetingText(undefined, context)).toBeUndefined();
  });
});

describe('resolveSessionComponent', () => {
  const context: VoiceCallContext = {
    metadata: { requestContext: { tenant: 'meridian' } },
    roomName: 'room-1',
    ctx: fakeJobContext(),
  };

  it('invokes the resolver with the call context and uses its result', async () => {
    const resolver = vi.fn((c: VoiceCallContext) => `stt-for-${c.metadata.requestContext?.tenant}`);
    expect(await resolveSessionComponent(resolver, 'static-stt', context)).toBe('stt-for-meridian');
    expect(resolver).toHaveBeenCalledWith(context);
  });

  it('awaits an async resolver', async () => {
    expect(await resolveSessionComponent(async () => 'async-tts', undefined, context)).toBe('async-tts');
  });

  it('falls back to the static option when the resolver returns undefined', async () => {
    expect(await resolveSessionComponent<string>(() => undefined, 'static', context)).toBe('static');
  });

  it('uses the static option when there is no resolver', async () => {
    expect(await resolveSessionComponent(undefined, 'static', context)).toBe('static');
  });
});

describe('speakGreeting', () => {
  // A fake AgentSession.say: records the options it was called with and returns a SpeechHandle
  // whose waitForPlayout resolution is controllable per test.
  function fakeSession(playout: Promise<void> = Promise.resolve()) {
    const waitForPlayout = vi.fn(() => playout);
    const say = vi.fn(() => ({ waitForPlayout }) as unknown as ReturnType<Parameters<typeof speakGreeting>[0]['say']>);
    return { session: { say } as unknown as Parameters<typeof speakGreeting>[0], say, waitForPlayout };
  }

  it('speaks the greeting with LiveKit defaults when only text is given', async () => {
    const { session, say, waitForPlayout } = fakeSession();
    await speakGreeting(session, { text: 'hello there' });
    // No override: undefined options object, so LiveKit keeps its own interruption default.
    expect(say).toHaveBeenCalledWith('hello there', undefined);
    expect(waitForPlayout).not.toHaveBeenCalled();
  });

  it('stays silent and returns undefined when there is no greeting text', async () => {
    const { session, say } = fakeSession();
    expect(await speakGreeting(session, {})).toBeUndefined();
    expect(say).not.toHaveBeenCalled();
  });

  it('passes allowInterruptions:false so a disclosure greeting plays through', async () => {
    const { session, say } = fakeSession();
    await speakGreeting(session, { text: 'you are speaking with an AI', allowInterruptions: false });
    expect(say).toHaveBeenCalledWith('you are speaking with an AI', { allowInterruptions: false });
  });

  it('passes allowInterruptions:true through explicitly when set', async () => {
    const { session, say } = fakeSession();
    await speakGreeting(session, { text: 'hi', allowInterruptions: true });
    expect(say).toHaveBeenCalledWith('hi', { allowInterruptions: true });
  });

  it('awaits playout only when awaitPlayout is set', async () => {
    const { session, waitForPlayout } = fakeSession();
    await speakGreeting(session, { text: 'hi', allowInterruptions: false, awaitPlayout: true });
    expect(waitForPlayout).toHaveBeenCalledTimes(1);
  });

  it('does not reject when an awaited greeting is interrupted mid-playout', async () => {
    // waitForPlayout rejects when the greeting is interrupted; speakGreeting must swallow it.
    const { session } = fakeSession(Promise.reject(new Error('interrupted')));
    await expect(speakGreeting(session, { text: 'hi', awaitPlayout: true })).resolves.toBeDefined();
  });
});

// A fake AgentSession that exposes a mutable agentState + AgentStateChanged emitter, plus `say`.
function fakeSpeakingSession(initialState: voice.AgentState = 'speaking', playout: Promise<void> = Promise.resolve()) {
  const listeners = new Set<(ev: voice.AgentStateChangedEvent) => void>();
  let state = initialState;
  const say = vi.fn(() => ({ waitForPlayout: vi.fn(() => playout) }));
  const session = {
    get agentState() {
      return state;
    },
    on: vi.fn((event: string, cb: (ev: voice.AgentStateChangedEvent) => void) => {
      if (event === voice.AgentSessionEventTypes.AgentStateChanged) listeners.add(cb);
      return session;
    }),
    off: vi.fn((event: string, cb: (ev: voice.AgentStateChangedEvent) => void) => {
      listeners.delete(cb);
      return session;
    }),
    say,
  };
  const setState = (newState: voice.AgentState) => {
    const oldState = state;
    state = newState;
    for (const cb of [...listeners]) cb({ type: 'agent_state_changed', oldState, newState, createdAt: 0 });
  };
  return {
    session: session as unknown as Parameters<typeof runEndCall>[0],
    setState,
    say,
    listenerCount: () => listeners.size,
  };
}

function fakeEndCallCtx() {
  return {
    deleteRoom: vi.fn(async () => {}),
    shutdown: vi.fn(),
  } as unknown as Parameters<typeof runEndCall>[1] & {
    deleteRoom: ReturnType<typeof vi.fn>;
    shutdown: ReturnType<typeof vi.fn>;
  };
}

const fakeLogger = () => ({ warn: vi.fn() });

describe('waitForAgentDoneSpeaking', () => {
  it('resolves immediately when the agent is already idle', async () => {
    const { session, listenerCount } = fakeSpeakingSession('listening');
    await expect(waitForAgentDoneSpeaking(session)).resolves.toBeUndefined();
    // No subscription needed since it was already idle.
    expect(listenerCount()).toBe(0);
  });

  it('waits while the agent is speaking, then resolves when it stops', async () => {
    const { session, setState, listenerCount } = fakeSpeakingSession('speaking');
    let resolved = false;
    const done = waitForAgentDoneSpeaking(session).then(() => {
      resolved = true;
    });
    await Promise.resolve();
    expect(resolved).toBe(false);
    setState('speaking'); // still busy — must not resolve
    await Promise.resolve();
    expect(resolved).toBe(false);
    setState('listening'); // done speaking
    await done;
    expect(resolved).toBe(true);
    // Listener is cleaned up after resolving.
    expect(listenerCount()).toBe(0);
  });

  it('keeps waiting through the thinking state', async () => {
    const { session, setState } = fakeSpeakingSession('thinking');
    let resolved = false;
    const done = waitForAgentDoneSpeaking(session).then(() => {
      resolved = true;
    });
    setState('speaking');
    await Promise.resolve();
    expect(resolved).toBe(false);
    setState('idle');
    await done;
    expect(resolved).toBe(true);
  });

  it('resolves via the maxWait safety cap even if the state never clears', async () => {
    vi.useFakeTimers();
    try {
      const { session } = fakeSpeakingSession('speaking');
      let resolved = false;
      const done = waitForAgentDoneSpeaking(session, 5000).then(() => {
        resolved = true;
      });
      await vi.advanceTimersByTimeAsync(4999);
      expect(resolved).toBe(false);
      await vi.advanceTimersByTimeAsync(1);
      await done;
      expect(resolved).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('runEndCall', () => {
  it('waits for the agent to finish, then deletes the room and shuts down with the default reason', async () => {
    const { session, say } = fakeSpeakingSession('listening'); // already idle
    const ctx = fakeEndCallCtx();
    await runEndCall(session, ctx, {}, fakeLogger());
    expect(say).not.toHaveBeenCalled(); // no closing message configured
    expect(ctx.deleteRoom).toHaveBeenCalledTimes(1);
    expect(ctx.shutdown).toHaveBeenCalledWith(DEFAULT_END_CALL_REASON);
    // deleteRoom is awaited before the shutdown that triggers onCallEnd.
    expect(ctx.deleteRoom.mock.invocationCallOrder[0]!).toBeLessThan(ctx.shutdown.mock.invocationCallOrder[0]!);
  });

  it('speaks a non-interruptible closing message before hanging up', async () => {
    const { session, say } = fakeSpeakingSession('listening');
    const ctx = fakeEndCallCtx();
    await runEndCall(session, ctx, { message: 'Thanks for calling, goodbye.' }, fakeLogger());
    expect(say).toHaveBeenCalledWith('Thanks for calling, goodbye.', { allowInterruptions: false });
    expect(ctx.deleteRoom).toHaveBeenCalledTimes(1);
    expect(ctx.shutdown).toHaveBeenCalledTimes(1);
  });

  it('uses the configured shutdown reason', async () => {
    const { session } = fakeSpeakingSession('listening');
    const ctx = fakeEndCallCtx();
    await runEndCall(session, ctx, { reason: 'resolved' }, fakeLogger());
    expect(ctx.shutdown).toHaveBeenCalledWith('resolved');
  });

  it('still shuts down when deleteRoom rejects', async () => {
    const { session } = fakeSpeakingSession('listening');
    const ctx = fakeEndCallCtx();
    ctx.deleteRoom.mockRejectedValueOnce(new Error('no room'));
    const logger = fakeLogger();
    await runEndCall(session, ctx, {}, logger);
    expect(ctx.shutdown).toHaveBeenCalledTimes(1);
    expect(logger.warn).toHaveBeenCalled();
  });

  it('still hangs up when the closing message playout rejects', async () => {
    const { session } = fakeSpeakingSession('listening', Promise.reject(new Error('interrupted')));
    const ctx = fakeEndCallCtx();
    await runEndCall(session, ctx, { message: 'bye' }, fakeLogger());
    expect(ctx.deleteRoom).toHaveBeenCalledTimes(1);
    expect(ctx.shutdown).toHaveBeenCalledTimes(1);
  });

  it('logs and does not throw when ctx.shutdown() throws synchronously', async () => {
    const { session } = fakeSpeakingSession('listening');
    const ctx = fakeEndCallCtx();
    ctx.shutdown.mockImplementationOnce(() => {
      throw new Error('already shutting down');
    });
    const logger = fakeLogger();
    await expect(runEndCall(session, ctx, {}, logger)).resolves.toBeUndefined();
    expect(ctx.deleteRoom).toHaveBeenCalledTimes(1);
    expect(logger.warn).toHaveBeenCalledWith(
      '@mastra/livekit: shutdown while ending the call failed',
      expect.any(Error),
    );
  });
});

describe('buildTurnHandling', () => {
  it('disables preemptive generation by default to avoid duplicate persisted messages', async () => {
    const { buildTurnHandling } = await import('./worker');
    expect(buildTurnHandling({}, undefined)).toEqual({ preemptiveGeneration: { enabled: false } });
  });

  it('lets callers opt back into preemptive generation', async () => {
    const { buildTurnHandling } = await import('./worker');
    const turnHandling = buildTurnHandling(
      { turnHandling: { preemptiveGeneration: { enabled: true }, endpointing: { minDelay: 300 } } },
      undefined,
    );
    expect(turnHandling).toEqual({
      preemptiveGeneration: { enabled: true },
      endpointing: { minDelay: 300 },
    });
  });
});
