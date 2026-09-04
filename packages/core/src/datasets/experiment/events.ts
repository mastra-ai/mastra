import { MastraError } from '../../error/index.js';
import type { TargetType } from '../../storage/types';
import type { ItemWithScores } from './types';

export type ExperimentJsonValue =
  | null
  | boolean
  | number
  | string
  | ExperimentJsonValue[]
  | { [key: string]: ExperimentJsonValue };

export interface ExperimentEventBase {
  version: 1;
  experimentId: string;
  sequence: number;
  timestamp: string;
  target: {
    type: TargetType | 'task';
    id: string;
  };
}

export interface ExperimentRunStartedEvent extends ExperimentEventBase {
  type: 'experiment.run.started';
  status: 'running';
  datasetId: string | null;
  datasetVersion: number | null;
  totalItems: number;
}

export interface ExperimentItemCompletedEvent extends ExperimentEventBase {
  type: 'experiment.item.completed';
  itemIndex: number;
  itemId: string;
  itemVersion: number;
  status: 'succeeded' | 'failed';
  input: ExperimentJsonValue;
  output: ExperimentJsonValue;
  groundTruth: ExperimentJsonValue;
  metadata: ExperimentJsonValue;
  error: ExperimentJsonValue;
  persistenceError: ExperimentJsonValue;
  scores: ExperimentJsonValue;
  toolMockReport: ExperimentJsonValue;
  retryCount: number;
  startedAt: string;
  completedAt: string;
  traceId: string | null;
}

export interface ExperimentRunFinishedEvent extends ExperimentEventBase {
  type: 'experiment.run.finished';
  status: 'completed' | 'failed';
  outcome: 'completed' | 'failed' | 'cancelled';
  error: ExperimentJsonValue;
  totalItems: number;
  succeededCount: number;
  failedCount: number;
  skippedCount: number;
  persistenceFailures: number;
  completedWithErrors: boolean;
  startedAt: string;
  completedAt: string;
}

export type ExperimentEvent = ExperimentRunStartedEvent | ExperimentItemCompletedEvent | ExperimentRunFinishedEvent;

export type ExperimentEventObserver = (event: ExperimentEvent) => void | Promise<void>;

type EventInput = ExperimentEvent extends infer Event
  ? Event extends ExperimentEvent
    ? Omit<Event, 'version' | 'sequence' | 'timestamp'>
    : never
  : never;

export class ExperimentEventDispatcher {
  readonly abortController = new AbortController();
  readonly #observer: ExperimentEventObserver;
  readonly #experimentId: string;
  #sequence = 0;
  #tail = Promise.resolve();
  #failure: MastraError | undefined;

  get failure(): MastraError | undefined {
    return this.#failure;
  }

  constructor(experimentId: string, observer: ExperimentEventObserver) {
    this.#experimentId = experimentId;
    this.#observer = observer;
  }

  emit(input: EventInput): Promise<void> {
    const event = {
      ...input,
      version: 1,
      sequence: ++this.#sequence,
      timestamp: new Date().toISOString(),
    } as ExperimentEvent;

    const delivery = this.#tail.then(async () => {
      if (this.#failure) throw this.#failure;

      try {
        await this.#observer(event);
      } catch (error) {
        this.#failure = new MastraError(
          {
            id: 'EXPERIMENT_EVENT_OBSERVER_FAILED',
            domain: 'EVAL',
            category: 'USER',
            details: {
              experimentId: this.#experimentId,
              eventType: event.type,
              eventSequence: event.sequence,
            },
            text: `Experiment event observer failed while handling "${event.type}".`,
          },
          error,
        );
        this.abortController.abort(this.#failure);
        throw this.#failure;
      }
    });

    this.#tail = delivery.catch(() => {});
    return delivery;
  }
}

export function toExperimentJsonValue(value: unknown, seen = new WeakSet<object>()): ExperimentJsonValue {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'bigint') return value.toString();
  if (typeof value === 'undefined' || typeof value === 'function' || typeof value === 'symbol') return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value.toISOString();
  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
    };
  }
  if (typeof value !== 'object') return String(value);
  if (seen.has(value)) return null;

  seen.add(value);
  if (Array.isArray(value)) {
    const result = value.map(entry => toExperimentJsonValue(entry, seen));
    seen.delete(value);
    return result;
  }

  const result: Record<string, ExperimentJsonValue> = {};
  for (const [key, entry] of Object.entries(value)) {
    result[key] = toExperimentJsonValue(entry, seen);
  }
  seen.delete(value);
  return result;
}

export function createItemCompletedEvent(
  base: Pick<ExperimentEventBase, 'experimentId' | 'target'>,
  itemIndex: number,
  result: ItemWithScores,
  traceId: string | null,
): EventInput {
  return {
    ...base,
    type: 'experiment.item.completed',
    itemIndex,
    itemId: result.itemId,
    itemVersion: result.itemVersion,
    status: result.error ? 'failed' : 'succeeded',
    input: toExperimentJsonValue(result.input),
    output: toExperimentJsonValue(result.output),
    groundTruth: toExperimentJsonValue(result.groundTruth),
    metadata: toExperimentJsonValue(result.metadata ?? null),
    error: toExperimentJsonValue(result.error),
    persistenceError: toExperimentJsonValue(result.persistenceError ?? null),
    scores: toExperimentJsonValue(result.scores),
    toolMockReport: toExperimentJsonValue(result.toolMockReport ?? null),
    retryCount: result.retryCount,
    startedAt: result.startedAt.toISOString(),
    completedAt: result.completedAt.toISOString(),
    traceId,
  };
}
