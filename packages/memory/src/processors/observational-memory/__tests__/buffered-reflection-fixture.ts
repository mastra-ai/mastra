/**
 * Fixture and race scenarios for buffered reflection extracted values (#27262), shared by the
 * InMemory unit tests (`buffered-reflection-values.test.ts`) and the file-backed LibSQL
 * integration test (`integration-tests/src/om-buffered-reflection-values-libsql.test.ts`).
 *
 * Scenarios use only real storage calls. "Another writer" is a second process sharing the store:
 * its writes go straight to storage, timed by wrapping one storage method.
 */
import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { MessageList } from '@mastra/core/agent';
import type { MastraDBMessage } from '@mastra/core/agent';
import { getThreadOMMetadata, setThreadOMMetadata } from '@mastra/core/memory';
import type { ProcessorStreamWriter } from '@mastra/core/processors';
import type { MastraCompositeStore, MemoryStorage, ObservationalMemoryRecord } from '@mastra/core/storage';

/** The OM engine surface the scenarios drive (source build in unit tests, dist in integration tests). */
export interface FixtureOM {
  beginTurn(opts: { threadId: string; resourceId: string; messageList: MessageList }): {
    writer?: ProcessorStreamWriter;
    start(memory: unknown): Promise<unknown>;
    step(index: number): { prepare(): Promise<unknown> };
  };
  settled(): Promise<void>;
  clear(threadId: string, resourceId?: string): Promise<void>;
  getOrCreateRecord(threadId: string, resourceId: string): Promise<ObservationalMemoryRecord>;
  getRecord(threadId: string, resourceId: string): Promise<ObservationalMemoryRecord | null>;
  buffering: { cleanupStaticMaps(threadId: string, resourceId?: string | null): void };
}

export interface FixtureMemory {
  omEngine: Promise<FixtureOM | null | undefined>;
  createThread(opts: {
    threadId: string;
    resourceId: string;
    title: string;
    metadata: Record<string, unknown>;
  }): Promise<unknown>;
  getThreadById(opts: { threadId: string }): Promise<{ metadata?: Record<string, unknown> } | null>;
}

export interface BufferedReflectionEnv {
  /** `Memory` from source (unit tests) or from the built package (integration tests). */
  Memory: new (config: any) => FixtureMemory;
  /** `ObservationalMemory` from the same build as `Memory`. */
  ObservationalMemory: new (config: any) => FixtureOM;
  /** `Extractor` from the same build as `Memory`. */
  Extractor: new (config: { name: string; instructions: string; metadataKeyPath?: string }) => unknown;
  createStorage(): Promise<MastraCompositeStore>;
}

/**
 * Options for scenarios that drive a standalone `ObservationalMemory` processor on the store.
 * `Memory` does not pass `hookExecution` or `reflection.activateAfterIdle` to its engine.
 */
export interface StandaloneOptions {
  /** Config-level `onReflectionEnd`, awaited by the pipeline (`hookExecution: 'await'`). */
  onReflectionEnd: () => Promise<void>;
  /** Reflection `activateAfterIdle`; idle turns then activate a buffer below the threshold. */
  activateAfterIdle: number;
  onReflectorCall?: () => void;
}

export function scriptedModel(reply: () => string | Promise<string>, onCall?: () => void) {
  return new MockLanguageModelV2({
    doStream: async () => {
      onCall?.();
      return {
        stream: convertArrayToReadableStream([
          { type: 'text-start', id: 'text' },
          { type: 'text-delta', id: 'text', delta: await reply() },
          { type: 'text-end', id: 'text' },
          { type: 'finish', finishReason: 'stop', usage: { inputTokens: 100, outputTokens: 30, totalTokens: 130 } },
        ]),
      };
    },
  });
}

export function reflection(value: string) {
  return `<observations>* condensed ${value}</observations><current-task>${value} task</current-task><thread-title>${value} title</thread-title><extracted-values>{"priority":"${value}","task":"${value} task","title":"${value} title"}</extracted-values>`;
}

function observationOptions() {
  return { model: scriptedModel(() => '<observations>* observed</observations>'), messageTokens: 1000 };
}

function reflectionOptions(env: BufferedReflectionEnv, reply: () => string | Promise<string>, onCall?: () => void) {
  return {
    model: scriptedModel(reply, onCall),
    observationTokens: 1000,
    bufferActivation: 0.5,
    extract: [
      new env.Extractor({ name: 'Priority', instructions: 'Extract the priority.' }),
      new env.Extractor({ name: 'Task', instructions: 'Extract the task.', metadataKeyPath: 'currentTask' }),
      new env.Extractor({ name: 'Title', instructions: 'Extract the title.', metadataKeyPath: 'threadTitle' }),
    ],
  };
}

export function createFixtureMemory(
  env: BufferedReflectionEnv,
  storage: MastraCompositeStore,
  reply: () => string | Promise<string>,
) {
  return new env.Memory({
    storage,
    options: {
      semanticRecall: false,
      observationalMemory: {
        scope: 'thread',
        observation: observationOptions(),
        reflection: reflectionOptions(env, reply),
      },
    },
  });
}

async function engine(memory: FixtureMemory): Promise<FixtureOM> {
  const om = await memory.omEngine;
  if (!om) throw new Error('OM must be enabled');
  return om;
}

interface TurnOptions {
  /** With `false`, background work started by the turn keeps running. */
  settle?: boolean;
  /** Messages already in the conversation, as loaded from memory. */
  messages?: MastraDBMessage[];
}

/** Run one turn's first step on `om`; `memory` loads conversation context when given. */
async function runTurn(
  om: FixtureOM,
  memory: FixtureMemory | undefined,
  threadId: string,
  resourceId: string,
  writer?: ProcessorStreamWriter,
  { settle = true, messages = [] }: TurnOptions = {},
) {
  const messageList = new MessageList({ threadId, resourceId });
  if (messages.length) messageList.add(messages, 'memory');
  const turn = om.beginTurn({ threadId, resourceId, messageList });
  turn.writer = writer;
  await turn.start(memory);
  await turn.step(0).prepare();
  if (settle) await om.settled();
  return om;
}

/** Run one turn's first step through `memory`'s OM engine. */
export async function prepare(
  memory: FixtureMemory,
  threadId: string,
  resourceId: string,
  writer?: ProcessorStreamWriter,
  options?: TurnOptions,
) {
  return runTurn(await engine(memory), memory, threadId, resourceId, writer, options);
}

export async function setup(
  env: BufferedReflectionEnv,
  reply: () => string | Promise<string>,
  initialTokens = 800,
  standalone?: StandaloneOptions,
) {
  const storage = await env.createStorage();
  const memory = createFixtureMemory(env, storage, reply);
  const store = await storage.getStore('memory');
  if (!store) throw new Error('Memory store must exist');
  const threadId = crypto.randomUUID();
  const resourceId = crypto.randomUUID();
  await memory.createThread({
    threadId,
    resourceId,
    title: 'Original',
    metadata: setThreadOMMetadata(
      { unrelated: 'preserved' },
      {
        currentTask: 'original task',
        threadTitle: 'original title',
        extracted: { priority: 'original' },
      },
    ),
  });
  const om = standalone
    ? new env.ObservationalMemory({
        storage: store,
        scope: 'thread',
        hookExecution: 'await',
        hooks: { onReflectionEnd: standalone.onReflectionEnd },
        observation: observationOptions(),
        reflection: {
          ...reflectionOptions(env, reply, standalone.onReflectorCall),
          activateAfterIdle: standalone.activateAfterIdle,
        },
      })
    : await engine(memory);
  // Turns through the standalone processor run without Memory, as a processor-only setup does.
  const turnMemory = standalone ? undefined : memory;
  const record = await om.getOrCreateRecord(threadId, resourceId);
  await store.updateActiveObservations({
    id: record.id,
    observations: '* original fact',
    tokenCount: initialTokens,
    lastObservedAt: new Date(),
  });
  const turn = (writer?: ProcessorStreamWriter, options?: TurnOptions) =>
    runTurn(om, turnMemory, threadId, resourceId, writer, options);
  return { env, storage, memory, om, store, threadId, resourceId, turn };
}

export type Fixture = Awaited<ReturnType<typeof setup>>;

export async function values(memory: FixtureMemory, threadId: string) {
  return getThreadOMMetadata((await memory.getThreadById({ threadId }))?.metadata);
}

/** Grow observations past the reflection threshold and run a turn (through `memory` if given). */
export async function reachActivation(
  fixture: Fixture,
  memory?: FixtureMemory,
  { tail = '\n* later fact', writer }: { tail?: string; writer?: ProcessorStreamWriter } = {},
) {
  const head = await fixture.om.getRecord(fixture.threadId, fixture.resourceId);
  if (!head) throw new Error('Missing head');
  await fixture.store.updateActiveObservations({
    id: head.id,
    observations: head.activeObservations + tail,
    tokenCount: 1100,
    lastObservedAt: new Date(),
  });
  return memory ? prepare(memory, fixture.threadId, fixture.resourceId, writer) : fixture.turn(writer);
}

export function recordingWriter() {
  const chunks: Array<{ type: string; data?: unknown }> = [];
  const writer = {
    custom: async (chunk: { type: string; data?: unknown }) => {
      chunks.push(chunk);
    },
  } as unknown as ProcessorStreamWriter;
  const reflectionMarkers = (type: string) =>
    chunks
      .filter(
        chunk =>
          chunk.type === type && (chunk.data as { operationType?: string } | undefined)?.operationType === 'reflection',
      )
      .map(chunk => chunk.data as { cycleId?: string });
  const reflectionActivations = () => reflectionMarkers('data-om-activation');
  const reflectionBufferingStarts = () => reflectionMarkers('data-om-buffering-start');
  return { writer, reflectionActivations, reflectionBufferingStarts };
}

/**
 * Runs `write` as another writer whose storage write lands after the activation's head check but
 * before its swap reads storage. Only real storage calls run, so the adapter's swap logic is used.
 * With `legacy`, the adapter behaves like one that predates `newRecordId`: it ignores the id and
 * never reports `supersededBy`. Applies to the next swap only.
 */
export function writeDuringSwap(
  f: Fixture,
  write: (snapshot: ObservationalMemoryRecord) => Promise<unknown>,
  { legacy = false }: { legacy?: boolean } = {},
) {
  const store: MemoryStorage = f.store;
  const swap = store.swapBufferedReflectionToActive;
  store.swapBufferedReflectionToActive = async input => {
    store.swapBufferedReflectionToActive = swap;
    await write(input.currentRecord);
    if (!legacy) return swap.call(store, input);
    const result = { ...(await swap.call(store, { ...input, newRecordId: undefined })) };
    delete result.supersededBy;
    return result;
  };
}

function gate() {
  let release!: () => void;
  let entered!: () => void;
  const released = new Promise<void>(resolve => {
    release = resolve;
  });
  const reached = new Promise<void>(resolve => {
    entered = resolve;
  });
  return { release, entered, released, reached };
}

/** Lets the hook's caller finish the synchronous work it does after the hook resolves. */
const drainMicrotasks = () => new Promise<void>(resolve => setTimeout(resolve, 0));

/** Reflection idle TTL used by the hook scenarios. */
const IDLE_TTL_MS = 10;

/**
 * An assistant reply the reflection idle TTL has expired for. It is newer than the observation
 * cursor, so the turn keeps it as unobserved context.
 */
async function idleReply(threadId: string, resourceId: string): Promise<MastraDBMessage> {
  const reply: MastraDBMessage = {
    id: crypto.randomUUID(),
    role: 'assistant',
    threadId,
    resourceId,
    createdAt: new Date(),
    content: { format: 2, parts: [{ type: 'text', text: 'Earlier reply.' }] },
  };
  await new Promise(resolve => setTimeout(resolve, IDLE_TTL_MS * 3));
  return reply;
}

/**
 * Another writer extends this activation's buffer between the head check and the swap. The
 * extension repeats the snapshot's unreflected tail and moves the reflected line count past it,
 * so storage would build exactly the text the snapshot's buffer would have produced.
 * Returns what the user can observe after that turn and after the next one.
 */
export async function runBufferExtendedWithUnreflectedTail(env: BufferedReflectionEnv) {
  const f = await setup(env, () => reflection('stale'), 500);
  await prepare(f.memory, f.threadId, f.resourceId);
  const prepared = await f.om.getRecord(f.threadId, f.resourceId);
  // Copy it now: some stores return live records, which the swap clears.
  const preparedBuffer = prepared?.bufferedReflection;
  const preparedLineCount = prepared?.reflectedObservationLineCount;
  const tail = '* later fact';
  writeDuringSwap(f, snapshot =>
    f.store.updateBufferedReflection({
      id: snapshot.id,
      reflection: tail,
      tokenCount: 5,
      inputTokenCount: 10,
      reflectedObservationLineCount: (snapshot.reflectedObservationLineCount ?? 0) + 1,
    }),
  );
  const { writer, reflectionActivations } = recordingWriter();
  await reachActivation(f, f.memory, { tail: `\n${tail}`, writer });
  const afterRace = await f.om.getRecord(f.threadId, f.resourceId);
  const race = {
    activations: reflectionActivations().length,
    generationCount: afterRace?.generationCount,
    bufferedReflection: afterRace?.bufferedReflection,
    reflectedObservationLineCount: afterRace?.reflectedObservationLineCount,
    values: (await values(f.memory, f.threadId))?.extracted,
  };

  // The next turn activates the buffer the other writer extended, which is not the one the
  // staged values were prepared for.
  await prepare(f.memory, f.threadId, f.resourceId, writer);
  const afterNext = await f.om.getRecord(f.threadId, f.resourceId);
  const next = {
    activations: reflectionActivations().length,
    generationCount: afterNext?.generationCount,
    activeObservations: afterNext?.activeObservations,
    values: (await values(f.memory, f.threadId))?.extracted,
  };
  return { preparedBuffer, preparedLineCount, tail, race, next };
}

export function expectedBufferExtendedWithUnreflectedTail(outcome: { preparedBuffer?: string; tail: string }) {
  const extended = `${outcome.preparedBuffer}\n\n${outcome.tail}`;
  return {
    preparedBuffer: outcome.preparedBuffer,
    preparedLineCount: 1,
    tail: outcome.tail,
    // The swap read a buffer the activation never saw, so it activates nothing.
    race: {
      activations: 0,
      generationCount: 0,
      bufferedReflection: extended,
      reflectedObservationLineCount: 2,
      values: { priority: 'original' },
    },
    // The extended buffer activates, without the values staged for the shorter one.
    next: { activations: 1, generationCount: 1, activeObservations: extended, values: { priority: 'original' } },
  };
}

/** Observation lines long enough that an idle activation passes the early-activation size guards. */
function factLines(from: number, count: number) {
  return Array.from(
    { length: count },
    (_, i) =>
      `* Fact ${from + i}: the customer asked about the refund for order ${1000 + from + i} and wants an answer today.`,
  ).join('\n');
}

/**
 * Buffers a reflection whose config-level `onReflectionEnd` hook is then held. While it is held,
 * observations grow (still below the reflection threshold) and an idle (TTL) turn activates the
 * buffer; another writer retires the generation between that activation's head check and swap,
 * so the activation applies nothing. Returns with the hook still held.
 */
async function retireDuringIdleActivation(f: Fixture, hookReached: Promise<void>) {
  const initial = await f.om.getRecord(f.threadId, f.resourceId);
  if (!initial) throw new Error('Missing head');
  await f.store.updateActiveObservations({
    id: initial.id,
    observations: factLines(0, 40),
    tokenCount: 800,
    lastObservedAt: new Date(),
  });
  await f.turn(undefined, { settle: false });
  await hookReached;
  const retired = await f.om.getRecord(f.threadId, f.resourceId);
  if (!retired) throw new Error('Missing head');
  await f.store.updateActiveObservations({
    id: retired.id,
    observations: `${retired.activeObservations}\n${factLines(40, 20)}`,
    tokenCount: 950,
    lastObservedAt: new Date(),
  });

  let winnerId: string | undefined;
  writeDuringSwap(f, async snapshot => {
    winnerId = (
      await f.store.createReflectionGeneration({
        currentRecord: snapshot,
        reflection: '* winning fact',
        tokenCount: 800,
      })
    ).id;
  });
  const { writer, reflectionActivations } = recordingWriter();
  await f.turn(writer, { settle: false, messages: [await idleReply(f.threadId, f.resourceId)] });
  return {
    retiredBufferedLosing: retired.bufferedReflection?.includes('condensed losing') ?? false,
    idleSwapRan: winnerId !== undefined,
    idleActivations: reflectionActivations().length,
    winnerId,
  };
}

/**
 * A config-level `onReflectionEnd` hook is still running after a buffered reflection was saved,
 * and its generation is retired by another writer during an idle activation (see
 * {@link retireDuringIdleActivation}). Once the hook resolves, the generation that won is below
 * the reflection threshold and must still get a buffered reflection.
 */
export async function runRetiredWhileReflectionEndHookHeld(env: BufferedReflectionEnv) {
  const hook = gate();
  let hold = true;
  let reply = 'losing';
  const f = await setup(env, () => reflection(reply), 800, {
    activateAfterIdle: IDLE_TTL_MS,
    onReflectionEnd: async () => {
      if (!hold) return;
      hold = false;
      hook.entered();
      await hook.released;
    },
  });
  const { winnerId, ...race } = await retireDuringIdleActivation(f, hook.reached);

  hook.release();
  await f.om.settled();

  reply = 'next';
  await f.turn();
  const winner = await f.om.getRecord(f.threadId, f.resourceId);
  return {
    ...race,
    winnerIsHead: winner?.id === winnerId,
    winnerObservations: winner?.activeObservations,
    winnerBuffersNext: winner?.bufferedReflection?.includes('condensed next') ?? false,
    values: (await values(f.memory, f.threadId))?.extracted,
  };
}

export const expectedRetiredWhileReflectionEndHookHeld = {
  retiredBufferedLosing: true,
  idleSwapRan: true,
  idleActivations: 0,
  winnerIsHead: true,
  winnerObservations: '* winning fact',
  winnerBuffersNext: true,
  values: { priority: 'original' },
};

/**
 * Another writer retires the generation while `onReflectionEnd` is held and BEFORE the idle
 * activation's first storage read, so that read immediately sees the winning generation with no
 * buffer (`no-buffer`) rather than hitting `not-applied`. Once the hook settles (resolving or
 * rejecting), the winning generation below the reflection threshold must still buffer.
 */
export async function runRetiredBeforeIdleActivationReadsWinner(
  env: BufferedReflectionEnv,
  { rejectHook = false }: { rejectHook?: boolean } = {},
) {
  const hook = gate();
  let hold = true;
  let reply = 'losing';
  const f = await setup(env, () => reflection(reply), 800, {
    activateAfterIdle: IDLE_TTL_MS,
    onReflectionEnd: async () => {
      if (!hold) return;
      hold = false;
      hook.entered();
      await hook.released;
      if (rejectHook) throw new Error('hook failed');
    },
  });
  await f.turn(undefined, { settle: false });
  await hook.reached;

  const retired = await f.om.getRecord(f.threadId, f.resourceId);
  if (!retired) throw new Error('Missing record');
  // Another writer retires `retired` BEFORE the idle turn begins, so the idle turn's first read
  // sees the winning generation with no buffered reflection.
  const winnerId = (
    await f.store.createReflectionGeneration({
      currentRecord: retired,
      reflection: '* winning fact',
      tokenCount: 800,
    })
  ).id;

  const { writer, reflectionActivations } = recordingWriter();
  await f.turn(writer, { settle: false, messages: [await idleReply(f.threadId, f.resourceId)] });

  hook.release();
  await f.om.settled();

  reply = 'next';
  await f.turn();
  const winner = await f.om.getRecord(f.threadId, f.resourceId);
  return {
    retiredBufferedLosing: retired.bufferedReflection?.includes('condensed losing') ?? false,
    idleActivations: reflectionActivations().length,
    winnerIsHead: winner?.id === winnerId,
    winnerObservations: winner?.activeObservations,
    winnerBuffersNext: winner?.bufferedReflection?.includes('condensed next') ?? false,
    values: (await values(f.memory, f.threadId))?.extracted,
  };
}

export const expectedRetiredBeforeIdleActivationReadsWinner = {
  retiredBufferedLosing: true,
  idleActivations: 0,
  winnerIsHead: true,
  winnerObservations: '* winning fact',
  winnerBuffersNext: true,
  values: { priority: 'original' },
};

/**
 * Like {@link runRetiredWhileReflectionEndHookHeld}, but the memory is cleared and a newer
 * buffered reflection starts (and holds its own hook) before the retired one's hook resolves.
 * The retired operation finishing must leave the newer operation's buffering state alone: no
 * second buffered reflection starts while it runs, and its activation reports its own cycle.
 */
export async function runNewerReflectionBufferSurvivesRetiredHook(env: BufferedReflectionEnv) {
  const retiredHook = gate();
  const newerHook = gate();
  const holds = [retiredHook, newerHook];
  let reply = 'losing';
  let reflectorCalls = 0;
  const f = await setup(env, () => reflection(reply), 800, {
    activateAfterIdle: IDLE_TTL_MS,
    onReflectionEnd: async () => {
      const held = holds.shift();
      if (!held) return;
      held.entered();
      await held.released;
    },
    onReflectorCall: () => {
      reflectorCalls++;
    },
  });
  const { winnerId: _winnerId, ...race } = await retireDuringIdleActivation(f, retiredHook.reached);

  // Start over on the same thread while the retired operation's hook is still running.
  await f.om.clear(f.threadId, f.resourceId);
  const fresh = await f.om.getOrCreateRecord(f.threadId, f.resourceId);
  await f.store.updateActiveObservations({
    id: fresh.id,
    observations: factLines(100, 40),
    tokenCount: 800,
    lastObservedAt: new Date(),
  });
  reply = 'newer';
  const { writer, reflectionActivations, reflectionBufferingStarts } = recordingWriter();
  await f.turn(writer, { settle: false });
  await newerHook.reached;

  retiredHook.release();
  await drainMicrotasks();
  // A turn while the newer operation is still running must not start another one.
  await f.turn(writer, { settle: false });
  newerHook.release();
  await f.om.settled();

  // Copy it now: some stores return live records, which the swap clears.
  const buffered = (await f.om.getRecord(f.threadId, f.resourceId))?.bufferedReflection;
  await reachActivation(f, undefined, { writer, tail: '' });
  const bufferingStartCycleIds = reflectionBufferingStarts().map(marker => marker.cycleId);
  return {
    ...race,
    reflectorCalls,
    newerReflectionsBuffered: buffered?.match(/condensed newer/g)?.length ?? 0,
    bufferedOnlyNewer: !(buffered?.includes('losing') ?? true),
    bufferingStarts: bufferingStartCycleIds.length,
    activationCycleIds: reflectionActivations().map(marker => marker.cycleId),
    newerCycleId: bufferingStartCycleIds[0],
    values: (await values(f.memory, f.threadId))?.extracted,
  };
}

export function expectedNewerReflectionBufferSurvivesRetiredHook(outcome: { newerCycleId?: string }) {
  return {
    retiredBufferedLosing: true,
    idleSwapRan: true,
    idleActivations: 0,
    reflectorCalls: 2,
    newerReflectionsBuffered: 1,
    bufferedOnlyNewer: true,
    bufferingStarts: 1,
    activationCycleIds: [outcome.newerCycleId],
    newerCycleId: outcome.newerCycleId,
    values: { priority: 'newer' },
  };
}
