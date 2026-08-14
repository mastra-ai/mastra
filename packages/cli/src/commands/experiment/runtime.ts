import { createHash, randomUUID } from 'node:crypto';
import { once } from 'node:events';

export const EXPERIMENT_WORKER_PROTOCOL_VERSION = '1' as const;
export const EXPERIMENT_DATASET_CANONICALIZATION_VERSION = '1' as const;
export const EXPERIMENT_WORKER_MAX_FRAME_BYTES = 1024 * 1024;
export const EXPERIMENT_WORKER_MAX_PENDING_OUTPUT_BYTES = 4 * EXPERIMENT_WORKER_MAX_FRAME_BYTES;

const MAX_TIMER_DELAY_MS = 2_147_483_647;

export const EXPERIMENT_WORKER_EXIT_CODES = {
  completed: 0,
  completedWithErrors: 10,
  fatal: 20,
  retryable: 21,
  cancelled: 30,
  timedOut: 31,
  protocol: 70,
} as const;

class ProtocolOutputError extends Error {
  readonly frameAccepted: boolean;

  constructor(message: string, frameAccepted: boolean) {
    super(message);
    this.frameAccepted = frameAccepted;
  }
}

type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };
type Target = { type: 'agent' | 'workflow'; id: string };
type Correlation = {
  protocolVersion: typeof EXPERIMENT_WORKER_PROTOCOL_VERSION;
  experimentId: string;
  jobId: string;
  attempt: number;
  idempotencyKey: string;
};

type DatasetToolMock = {
  toolId: string;
  args: Record<string, JsonValue>;
  output: JsonValue;
  matchArgs?: 'strict' | 'ignore';
};

type DatasetItem = {
  id?: string;
  input: JsonValue;
  groundTruth?: JsonValue;
  metadata?: Record<string, JsonValue>;
  requestContext?: Record<string, JsonValue>;
  expectedTrajectory?: JsonValue;
  source?: JsonValue;
  toolMocks?: DatasetToolMock[];
};

type ExperimentPacket = {
  protocolVersion: string;
  experimentId: string;
  tenant: Record<string, JsonValue>;
  environment: Record<string, JsonValue>;
  artifacts: {
    buildId: string;
    [key: string]: JsonValue;
  };
  target: Target;
  dataset: {
    itemCount: number;
    digest: string;
    canonicalizationVersion: string;
    items: DatasetItem[];
  };
  scorers: Array<{ id: string; version: string }>;
  limits: { concurrency: number; timeoutMs: number };
  policies: { allowedToolIds: string[]; allowedNetworkHosts: string[] };
  secretReferences: JsonValue[];
  requestContext?: Record<string, JsonValue>;
  metadata?: Record<string, JsonValue>;
  requestedAt?: string;
};

type RunRequest = Correlation & {
  type: 'run';
  protocolVersion: string;
  supportedProtocolVersions: string[];
  deadlineAt: string;
  datasetAttestation: { itemCount: number; digest: string; canonicalizationVersion: string };
  packet: ExperimentPacket;
};

type CancelRequest = Correlation & {
  type: 'cancel';
  protocolVersion: string;
  requestedAt: string;
  reason: string;
};

type ExperimentEvent = {
  type: string;
  version: number;
  experimentId: string;
  sequence: number;
  timestamp: string;
  target: Target;
  outcome?: 'completed' | 'failed' | 'cancelled';
  completedWithErrors?: boolean;
  itemId?: string;
  itemIndex?: number;
  [key: string]: unknown;
};

type Completion = {
  status: 'completed' | 'completed-with-errors' | 'failed' | 'cancelled' | 'timed-out';
  semanticEvent: ExperimentEvent;
  exitCode: number;
  retryable?: boolean;
};

type RunExperiment = (
  mastra: MastraLike,
  config: {
    data: Array<Record<string, unknown>>;
    targetType: Target['type'];
    targetId: string;
    scorers: string[];
    maxConcurrency: number;
    itemTimeout: number;
    signal: AbortSignal;
    unmockedToolPolicy: 'deny';
    requestContext?: Record<string, JsonValue>;
    metadata: Record<string, unknown>;
    persistence: { experiments: 'none'; scores: 'none' };
    experimentId: string;
    onEvent: (event: ExperimentEvent) => Promise<void>;
  },
) => Promise<unknown>;

type MastraLike = { shutdown(): Promise<void> };

export interface ExperimentWorkerBuildIdentity {
  buildId: string;
  protocolVersion: typeof EXPERIMENT_WORKER_PROTOCOL_VERSION;
  datasetCanonicalizationVersion: typeof EXPERIMENT_DATASET_CANONICALIZATION_VERSION;
}

export interface ExperimentWorkerDependencies {
  mastra: MastraLike;
  runExperiment: RunExperiment;
  build: ExperimentWorkerBuildIdentity;
  stdin?: NodeJS.ReadableStream;
  stdout?: NodeJS.WritableStream;
  stderr?: NodeJS.WritableStream;
  workerId?: string;
  createEventId?: () => string;
  now?: () => Date;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(item => typeof item === 'string');
}

function isPositiveInteger(value: unknown): value is number {
  return Number.isInteger(value) && Number(value) > 0;
}

function canonicalize(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(',')}]`;
  return `{${Object.keys(value)
    .sort()
    .map(key => `${JSON.stringify(key)}:${canonicalize((value as Record<string, unknown>)[key])}`)
    .join(',')}}`;
}

function datasetDigest(items: DatasetItem[]): string {
  return createHash('sha256').update(canonicalize(items)).digest('hex');
}

function isValidFinishedEvent(event: ExperimentEvent): boolean {
  return (
    event.type === 'experiment.run.finished' &&
    ['completed', 'failed', 'cancelled'].includes(event.outcome ?? '') &&
    typeof event.completedWithErrors === 'boolean'
  );
}

function validateRunRequest(value: unknown, build: ExperimentWorkerBuildIdentity): string | undefined {
  if (!isRecord(value) || value.type !== 'run') return 'expected run request';
  const request = value as unknown as RunRequest;
  if (
    request.protocolVersion !== build.protocolVersion ||
    request.packet?.protocolVersion !== build.protocolVersion ||
    !isStringArray(request.supportedProtocolVersions) ||
    !request.supportedProtocolVersions.includes(build.protocolVersion)
  ) {
    return 'unsupported protocol version';
  }
  if (
    typeof request.experimentId !== 'string' ||
    request.experimentId !== request.packet?.experimentId ||
    typeof request.jobId !== 'string' ||
    !isPositiveInteger(request.attempt) ||
    typeof request.idempotencyKey !== 'string'
  ) {
    return 'invalid correlation';
  }
  if (typeof request.deadlineAt !== 'string' || !Number.isFinite(Date.parse(request.deadlineAt))) {
    return 'invalid deadline';
  }
  const packet = request.packet;
  const dataset = packet?.dataset;
  if (
    !isRecord(packet) ||
    !isRecord(dataset) ||
    !Array.isArray(dataset.items) ||
    !dataset.items.every(
      item =>
        isRecord(item) &&
        typeof item.id === 'string' &&
        'input' in item &&
        (item.metadata === undefined || isRecord(item.metadata)) &&
        (item.requestContext === undefined || isRecord(item.requestContext)) &&
        (item.toolMocks === undefined ||
          (Array.isArray(item.toolMocks) &&
            item.toolMocks.every(
              mock =>
                isRecord(mock) &&
                typeof mock.toolId === 'string' &&
                isRecord(mock.args) &&
                'output' in mock &&
                (mock.matchArgs === undefined || mock.matchArgs === 'strict' || mock.matchArgs === 'ignore'),
            ))),
    ) ||
    dataset.itemCount !== dataset.items.length
  ) {
    return 'invalid dataset';
  }
  if (
    dataset.canonicalizationVersion !== build.datasetCanonicalizationVersion ||
    request.datasetAttestation?.canonicalizationVersion !== build.datasetCanonicalizationVersion
  ) {
    return 'unsupported dataset canonicalization version';
  }
  const digest = datasetDigest(dataset.items);
  if (
    dataset.digest !== digest ||
    request.datasetAttestation?.digest !== digest ||
    request.datasetAttestation?.itemCount !== dataset.items.length
  ) {
    return 'dataset attestation mismatch';
  }
  if (!isRecord(packet.artifacts) || packet.artifacts.buildId !== build.buildId)
    return 'worker build identity mismatch';
  if (!isRecord(packet.tenant) || !isRecord(packet.environment)) return 'invalid artifact provenance';
  if (
    !isRecord(packet.target) ||
    !['agent', 'workflow'].includes(packet.target.type) ||
    typeof packet.target.id !== 'string'
  ) {
    return 'invalid target';
  }
  if (
    !Array.isArray(packet.scorers) ||
    !packet.scorers.every(
      scorer => isRecord(scorer) && typeof scorer.id === 'string' && typeof scorer.version === 'string',
    ) ||
    !isPositiveInteger(packet.limits?.concurrency) ||
    !isPositiveInteger(packet.limits?.timeoutMs)
  ) {
    return 'invalid experiment configuration';
  }
  if (
    !isStringArray(packet.policies?.allowedToolIds) ||
    !isStringArray(packet.policies?.allowedNetworkHosts) ||
    !Array.isArray(packet.secretReferences)
  ) {
    return 'invalid execution policy';
  }
  if (packet.policies.allowedNetworkHosts.length > 0 || packet.secretReferences.length > 0) {
    return 'unsupported network or secret policy';
  }
  const mockedToolIds = new Set(
    dataset.items.flatMap(item => (Array.isArray(item.toolMocks) ? item.toolMocks.map(mock => mock.toolId) : [])),
  );
  const allowedToolIds = new Set(packet.policies.allowedToolIds);
  if (packet.target.type !== 'agent' && (mockedToolIds.size > 0 || allowedToolIds.size > 0)) {
    return 'tool policies are supported only for agent targets';
  }
  if (
    packet.policies.allowedToolIds.some(toolId => !mockedToolIds.has(toolId)) ||
    [...mockedToolIds].some(toolId => !allowedToolIds.has(toolId))
  ) {
    return 'allowed tools and deterministic mocks must match';
  }
}

function validateCancelRequest(value: unknown, correlation: Correlation): value is CancelRequest {
  if (!isRecord(value)) return false;
  return (
    value.type === 'cancel' &&
    value.protocolVersion === EXPERIMENT_WORKER_PROTOCOL_VERSION &&
    value.experimentId === correlation.experimentId &&
    value.jobId === correlation.jobId &&
    value.attempt === correlation.attempt &&
    value.idempotencyKey === correlation.idempotencyKey &&
    typeof value.requestedAt === 'string' &&
    Number.isFinite(Date.parse(value.requestedAt)) &&
    typeof value.reason === 'string'
  );
}

export async function runExperimentWorker({
  mastra,
  runExperiment,
  build,
  stdin = process.stdin,
  stdout = process.stdout,
  stderr = process.stderr,
  workerId = randomUUID(),
  createEventId = randomUUID,
  now = () => new Date(),
}: ExperimentWorkerDependencies): Promise<number> {
  let correlation: Correlation | undefined;
  let controller: AbortController | undefined;
  let runPromise: Promise<void> | undefined;
  let completion: Completion | undefined;
  let activeRequest: RunRequest | undefined;
  let protocolFailure: Error | undefined;
  let terminal = false;
  let finishing = false;
  let sequence = 0;
  let heartbeat: NodeJS.Timeout | undefined;
  let clearDeadlineTimer: (() => void) | undefined;
  let deadlineAt = Number.POSITIVE_INFINITY;
  let writeTail = Promise.resolve();
  let pendingOutputBytes = 0;
  let heartbeatQueued = false;

  const report = (message: string) => stderr.write(`[mastra experiment worker] ${message}\n`);
  const scheduleAtDeadline = (callback: () => void) => {
    let timer: NodeJS.Timeout | undefined;
    let cleared = false;
    let fired = false;
    const schedule = () => {
      if (cleared || fired) return;
      const remaining = deadlineAt - Date.now();
      timer = setTimeout(
        remaining <= 0
          ? () => {
              if (cleared || fired) return;
              fired = true;
              callback();
            }
          : schedule,
        remaining <= 0 ? 0 : Math.min(remaining, MAX_TIMER_DELAY_MS),
      );
    };
    schedule();
    return () => {
      cleared = true;
      clearTimeout(timer);
    };
  };
  const abortForProtocolFailure = (message: string) => {
    if (protocolFailure || terminal) return;
    protocolFailure = new Error(message);
    report(message);
    controller?.abort(protocolFailure);
  };
  const waitForDrain = async () => {
    const drainController = new AbortController();
    let deadlineExceeded = false;
    const clearTimer = scheduleAtDeadline(() => {
      deadlineExceeded = true;
      drainController.abort();
    });
    try {
      await once(stdout, 'drain', { signal: drainController.signal });
    } catch (error) {
      if (deadlineExceeded) throw new Error('stdout backpressure exceeded the experiment deadline');
      throw error;
    } finally {
      clearTimer();
      drainController.abort();
    }
  };
  const writeEvent = (type: string, payload: Record<string, unknown>) => {
    if (!correlation || terminal || (finishing && type !== 'terminal') || (type === 'heartbeat' && heartbeatQueued)) {
      return writeTail;
    }
    const event = {
      ...correlation,
      eventId: createEventId(),
      sequence,
      emittedAt: now().toISOString(),
      type,
      payload,
    };
    const frame = `${JSON.stringify(event)}\n`;
    const frameBytes = Buffer.byteLength(frame);
    if (frameBytes > EXPERIMENT_WORKER_MAX_FRAME_BYTES) {
      return Promise.reject(new Error('output frame exceeds maximum size'));
    }
    if (pendingOutputBytes + frameBytes > EXPERIMENT_WORKER_MAX_PENDING_OUTPUT_BYTES) {
      return Promise.reject(new Error('pending protocol output exceeds maximum size'));
    }
    sequence += 1;
    pendingOutputBytes += frameBytes;
    if (type === 'heartbeat') heartbeatQueued = true;
    const queuedWrite = writeTail.then(async () => {
      try {
        if (!stdout.write(frame)) {
          try {
            await waitForDrain();
          } catch (error) {
            throw new ProtocolOutputError(error instanceof Error ? error.message : String(error), true);
          }
        }
      } finally {
        pendingOutputBytes -= frameBytes;
        if (type === 'heartbeat') heartbeatQueued = false;
      }
    });
    writeTail = queuedWrite.catch(error => {
      if (type === 'heartbeat') abortForProtocolFailure(error instanceof Error ? error.message : String(error));
    });
    return queuedWrite;
  };
  const finish = async (
    status: 'completed' | 'completed-with-errors' | 'failed' | 'cancelled' | 'timed-out',
    semanticEvent: ExperimentEvent,
    exitCode: number,
    retryable = false,
  ) => {
    if (terminal || finishing) return;
    finishing = true;
    clearInterval(heartbeat);
    try {
      await writeTail;
      if (protocolFailure) throw protocolFailure;
      await writeEvent('terminal', {
        status,
        ...(status === 'failed' ? { retryable } : {}),
        semanticEvent,
      });
      terminal = true;
      return exitCode;
    } finally {
      clearInterval(heartbeat);
      clearDeadlineTimer?.();
    }
  };
  const emitCompletion = async (value: Completion) => {
    try {
      return (await finish(value.status, value.semanticEvent, value.exitCode, value.retryable)) ?? value.exitCode;
    } catch (error) {
      clearInterval(heartbeat);
      clearDeadlineTimer?.();
      const failure = error instanceof Error ? error : new Error(String(error));
      report(`terminal protocol output failed: ${failure.message}`);
      if (failure instanceof ProtocolOutputError && failure.frameAccepted) {
        terminal = true;
        return value.exitCode;
      }
      try {
        await writeEvent('terminal', {
          status: 'failed',
          retryable: false,
          semanticEvent: {
            type: 'experiment.run.finished',
            version: 1,
            experimentId: correlation?.experimentId ?? value.semanticEvent.experimentId,
            sequence: 0,
            timestamp: now().toISOString(),
            target: value.semanticEvent.target,
            outcome: 'failed',
            completedWithErrors: false,
            error: { name: failure.name, message: failure.message },
          },
        });
      } catch (fallbackError) {
        report(
          `fallback terminal protocol output failed: ${fallbackError instanceof Error ? fallbackError.message : String(fallbackError)}`,
        );
      }
      terminal = true;
      return EXPERIMENT_WORKER_EXIT_CODES.protocol;
    }
  };
  const failedSemanticEvent = (
    request: RunRequest,
    error: Error,
    outcome: 'failed' | 'cancelled' = 'failed',
  ): ExperimentEvent => ({
    type: 'experiment.run.finished',
    version: 1,
    experimentId: request.experimentId,
    sequence: 0,
    timestamp: now().toISOString(),
    target: request.packet.target,
    outcome,
    completedWithErrors: false,
    error: { name: error.name, message: error.message },
  });

  const executeRun = async (request: RunRequest) => {
    const packet = request.packet;
    let finishedEvent: ExperimentEvent | undefined;
    let runError: Error | undefined;
    let runErrorRetryable = false;
    await writeEvent('accepted', {
      workerId,
      negotiatedProtocolVersion: request.protocolVersion,
    });
    heartbeat = setInterval(() => {
      void writeEvent('heartbeat', {}).catch(error => abortForProtocolFailure(String(error)));
    }, 5_000);
    let rejectDeadline: ((error: Error) => void) | undefined;
    const deadlinePromise = new Promise<never>((_, reject) => {
      rejectDeadline = reject;
    });
    clearDeadlineTimer = scheduleAtDeadline(() => {
      const error = new Error('Experiment deadline exceeded');
      controller?.abort(error);
      rejectDeadline?.(error);
    });
    try {
      await Promise.race([
        runExperiment(mastra, {
          data: packet.dataset.items.map(item => ({
            ...item,
            metadata: {
              ...item.metadata,
              ...(item.expectedTrajectory !== undefined ? { expectedTrajectory: item.expectedTrajectory } : {}),
              ...(item.source !== undefined ? { source: item.source } : {}),
            },
            ...(item.toolMocks
              ? {
                  toolMocks: item.toolMocks.map(mock => ({
                    toolName: mock.toolId,
                    args: mock.args,
                    output: mock.output,
                    ...(mock.matchArgs ? { matchArgs: mock.matchArgs } : {}),
                  })),
                }
              : {}),
          })),
          targetType: packet.target.type,
          targetId: packet.target.id,
          scorers: packet.scorers.map(scorer => scorer.id),
          maxConcurrency: packet.limits.concurrency,
          itemTimeout: packet.limits.timeoutMs,
          signal: controller!.signal,
          unmockedToolPolicy: 'deny',
          requestContext: packet.requestContext,
          metadata: {
            ...packet.metadata,
            tenant: packet.tenant,
            environment: packet.environment,
            artifacts: packet.artifacts,
            scorerVersions: Object.fromEntries(packet.scorers.map(scorer => [scorer.id, scorer.version])),
            policies: packet.policies,
            requestedAt: packet.requestedAt,
          },
          persistence: { experiments: 'none', scores: 'none' },
          experimentId: request.experimentId,
          onEvent: async event => {
            if (event.type === 'experiment.run.started') await writeEvent('run-started', { semanticEvent: event });
            else if (event.type === 'experiment.item.completed') {
              await writeEvent('item-completed', {
                itemId: event.itemId,
                itemIndex: event.itemIndex,
                semanticEvent: event,
              });
            } else if (event.type === 'experiment.run.finished') {
              if (finishedEvent) throw new Error('Experiment emitted multiple terminal semantic events');
              finishedEvent = event;
            }
          },
        }),
        deadlinePromise,
      ]);
    } catch (error) {
      runErrorRetryable = isRecord(error) && error.retryable === true;
      runError = error instanceof Error ? error : new Error(String(error));
    } finally {
      clearDeadlineTimer?.();
      clearDeadlineTimer = undefined;
    }
    try {
      let clearTimer: (() => void) | undefined;
      await Promise.race([
        mastra.shutdown(),
        new Promise((_, reject) => {
          clearTimer = scheduleAtDeadline(() => reject(new Error('Mastra shutdown exceeded the experiment deadline')));
        }),
      ]).finally(() => clearTimer?.());
    } catch (error) {
      runError = error instanceof Error ? error : new Error(String(error));
    }

    if (protocolFailure) {
      await writeEvent('process-failure', { error: { name: protocolFailure.name, message: protocolFailure.message } });
      return {
        status: 'failed',
        semanticEvent: failedSemanticEvent(request, protocolFailure),
        exitCode: EXPERIMENT_WORKER_EXIT_CODES.protocol,
        retryable: false,
      } satisfies Completion;
    }
    if (runError || !finishedEvent || !isValidFinishedEvent(finishedEvent)) {
      const error =
        runError ??
        new Error(
          finishedEvent
            ? 'Experiment emitted an invalid terminal semantic event'
            : 'Experiment completed without a terminal semantic event',
        );
      const timedOut = Date.now() >= deadlineAt;
      const cancelled = controller?.signal.aborted && !timedOut;
      return {
        status: timedOut ? 'timed-out' : cancelled ? 'cancelled' : 'failed',
        semanticEvent: failedSemanticEvent(request, error, cancelled ? 'cancelled' : 'failed'),
        exitCode: timedOut
          ? EXPERIMENT_WORKER_EXIT_CODES.timedOut
          : cancelled
            ? EXPERIMENT_WORKER_EXIT_CODES.cancelled
            : runErrorRetryable
              ? EXPERIMENT_WORKER_EXIT_CODES.retryable
              : EXPERIMENT_WORKER_EXIT_CODES.fatal,
        retryable: !timedOut && !cancelled && runErrorRetryable,
      } satisfies Completion;
    }
    const status =
      finishedEvent.outcome === 'cancelled'
        ? 'cancelled'
        : finishedEvent.completedWithErrors
          ? 'completed-with-errors'
          : finishedEvent.outcome === 'failed'
            ? 'failed'
            : 'completed';
    return {
      status,
      semanticEvent: finishedEvent,
      exitCode:
        status === 'cancelled'
          ? EXPERIMENT_WORKER_EXIT_CODES.cancelled
          : status === 'completed-with-errors'
            ? EXPERIMENT_WORKER_EXIT_CODES.completedWithErrors
            : status === 'failed'
              ? EXPERIMENT_WORKER_EXIT_CODES.fatal
              : EXPERIMENT_WORKER_EXIT_CODES.completed,
    } satisfies Completion;
  };

  const handleFrame = async (frame: Uint8Array) => {
    let text: string;
    try {
      text = new TextDecoder('utf-8', { fatal: true }).decode(frame);
    } catch {
      abortForProtocolFailure('frame is not valid UTF-8');
      return;
    }
    let value: unknown;
    try {
      value = JSON.parse(text);
    } catch {
      abortForProtocolFailure('malformed JSON frame');
      return;
    }
    if (!correlation) {
      const validationError = validateRunRequest(value, build);
      if (validationError) {
        abortForProtocolFailure(validationError);
        return;
      }
      const request = value as RunRequest;
      correlation = {
        protocolVersion: request.protocolVersion,
        experimentId: request.experimentId,
        jobId: request.jobId,
        attempt: request.attempt,
        idempotencyKey: request.idempotencyKey,
      };
      controller = new AbortController();
      activeRequest = request;
      deadlineAt = Date.parse(request.deadlineAt);
      runPromise = executeRun(request)
        .then(result => {
          completion = result;
        })
        .catch(error => {
          const failure = error instanceof Error ? error : new Error(String(error));
          report(`protocol output failed: ${failure.message}`);
          completion = {
            status: 'failed',
            semanticEvent: failedSemanticEvent(request, failure),
            exitCode: EXPERIMENT_WORKER_EXIT_CODES.protocol,
            retryable: false,
          };
        });
      return;
    }
    if (!validateCancelRequest(value, correlation)) {
      abortForProtocolFailure('unexpected or invalid request');
      return;
    }
    controller?.abort(new Error((value as CancelRequest).reason));
  };

  let pending = Buffer.alloc(0);
  const iterator = stdin[Symbol.asyncIterator]();
  while (!terminal && !protocolFailure) {
    let nextChunk: Promise<IteratorResult<Buffer | string>>;
    let result: { type: 'input'; input: IteratorResult<Buffer | string> } | { type: 'run-complete' };
    try {
      nextChunk = iterator.next();
      result = runPromise
        ? await Promise.race([
            nextChunk.then(input => ({ type: 'input' as const, input })),
            runPromise.then(() => ({ type: 'run-complete' as const })),
          ])
        : { type: 'input' as const, input: await nextChunk };
    } catch (error) {
      abortForProtocolFailure(`stdin read failed: ${error instanceof Error ? error.message : String(error)}`);
      break;
    }
    if (result.type === 'run-complete') {
      void nextChunk.catch(() => undefined);
      (stdin as NodeJS.ReadableStream & { destroy?(): void }).destroy?.();
      if (pending.byteLength > 0 && activeRequest) {
        abortForProtocolFailure('truncated frame: final newline is required');
        const error = protocolFailure ?? new Error('truncated frame: final newline is required');
        await writeEvent('process-failure', { error: { name: error.name, message: error.message } });
        completion = {
          status: 'failed',
          semanticEvent: failedSemanticEvent(activeRequest, error),
          exitCode: EXPERIMENT_WORKER_EXIT_CODES.protocol,
          retryable: false,
        };
      }
      if (!completion) return EXPERIMENT_WORKER_EXIT_CODES.fatal;
      return emitCompletion(completion);
    }
    if (result.input.done) break;
    const chunk = result.input.value;
    pending = Buffer.concat([pending, Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)]);
    while (!protocolFailure) {
      const newline = pending.indexOf(0x0a);
      if (newline === -1) break;
      if (newline > EXPERIMENT_WORKER_MAX_FRAME_BYTES) abortForProtocolFailure('frame exceeds maximum size');
      else await handleFrame(pending.subarray(0, newline));
      pending = pending.subarray(newline + 1);
    }
    if (pending.byteLength > EXPERIMENT_WORKER_MAX_FRAME_BYTES) {
      abortForProtocolFailure('frame exceeds maximum size');
    }
  }
  const hasTruncatedFrame = pending.byteLength > 0;
  if (!protocolFailure && hasTruncatedFrame) abortForProtocolFailure('truncated frame: final newline is required');
  if (!correlation) {
    report(protocolFailure?.message ?? 'stdin closed before run request');
    return EXPERIMENT_WORKER_EXIT_CODES.protocol;
  }
  await runPromise;
  if (hasTruncatedFrame && activeRequest) {
    const error = protocolFailure ?? new Error('truncated frame: final newline is required');
    await writeEvent('process-failure', { error: { name: error.name, message: error.message } });
    completion = {
      status: 'failed',
      semanticEvent: failedSemanticEvent(activeRequest, error),
      exitCode: EXPERIMENT_WORKER_EXIT_CODES.protocol,
      retryable: false,
    };
  }
  if (!completion) return EXPERIMENT_WORKER_EXIT_CODES.fatal;
  return emitCompletion(completion);
}
