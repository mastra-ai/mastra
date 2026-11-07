import { resolveGenUILimits } from './accumulator';
import { validateSchema } from './standard-schema';
import type { StandardSchemaV1, InferSchemaOutput } from './standard-schema';
import type { GenUILimits, GenUISurface, JSONValue } from './types';
import { toSafeJSONValue } from './validate';

/**
 * A user interaction raised by a rendered GenUI element.
 *
 * @experimental Generative UI is in beta and may change without notice.
 */
export interface GenUIAction {
  /** Idempotency key. Dispatching the same id twice never runs the handler twice. */
  actionId: string;
  surfaceId: string;
  /**
   * Element that raised the action. Omitted for surface-level actions, such as those bound through a
   * spec element's `on` field; those are only checked against the surface's status.
   */
  elementId?: string;
  name: string;
  payload: JSONValue;
  /** Revision of the element the user was looking at when they acted. Required with `elementId`. */
  sourceRevision?: number;
}

/** @experimental Generative UI is in beta and may change without notice. */
export type GenUIActionInput = Omit<GenUIAction, 'actionId' | 'payload'> & { actionId?: string; payload?: unknown };

/** @experimental Generative UI is in beta and may change without notice. */
export type GenUIActionResult =
  | { status: 'success'; value?: unknown }
  | { status: 'error'; error: string }
  /** Payload failed validation; the handler did not run. */
  | { status: 'invalid'; error: string }
  /** The element changed or disappeared after it was rendered; the handler did not run. */
  | { status: 'stale'; error: string }
  /** No handler is registered for this action name. */
  | { status: 'unhandled'; error: string }
  /** Another dispatch of the same action on the same element is still running. */
  | { status: 'busy'; error: string }
  | { status: 'cancelled' };

/** @experimental Generative UI is in beta and may change without notice. */
export interface GenUIActionContext {
  action: GenUIAction;
  /** Surface at dispatch time, if it still exists. */
  surface: GenUISurface | undefined;
  /** Aborted when the action is cancelled or the dispatcher is disposed. */
  signal: AbortSignal;
}

/** @experimental Generative UI is in beta and may change without notice. */
export interface GenUIActionHandler<S extends StandardSchemaV1 | undefined = StandardSchemaV1 | undefined> {
  /** Validates `payload` before the handler runs. */
  schema?: S;
  /** Run even if the element changed after it was rendered. Defaults to false. */
  allowStale?: boolean;
  /** Allow concurrent runs for the same surface/element/action. Defaults to false (second dispatch is `busy`). */
  allowConcurrent?: boolean;
  handle(
    payload: S extends StandardSchemaV1 ? InferSchemaOutput<S> : JSONValue,
    context: GenUIActionContext,
  ): unknown | Promise<unknown>;
}

/**
 * Helper that preserves the payload type inferred from `schema`.
 *
 * @experimental Generative UI is in beta and may change without notice.
 */
export function defineGenUIAction<S extends StandardSchemaV1 | undefined = undefined>(
  handler: GenUIActionHandler<S>,
): GenUIActionHandler<S> {
  return handler;
}

/** @experimental Generative UI is in beta and may change without notice. */
export interface GenUIActionDispatcherOptions {
  handlers?: Record<string, GenUIActionHandler<any>>;
  /** Used for stale-action detection. */
  getSurface?: (surfaceId: string) => GenUISurface | undefined;
  limits?: Partial<GenUILimits>;
  /** Completed results kept for idempotent re-dispatch. Defaults to 200. */
  maxCompletedResults?: number;
  generateId?: () => string;
}

/** @experimental Generative UI is in beta and may change without notice. */
export interface GenUIActionDispatcher {
  dispatch(input: GenUIActionInput): Promise<GenUIActionResult>;
  register(name: string, handler: GenUIActionHandler<any>): () => void;
  cancel(actionId: string): void;
  /** Whether any dispatch matching the filter is still running. */
  isPending(filter: { surfaceId?: string; elementId?: string; name?: string }): boolean;
  /** Last result for an action id, if it completed. */
  getResult(actionId: string): GenUIActionResult | undefined;
  /** Fires whenever the set of pending actions changes. */
  subscribe(listener: () => void): () => void;
  dispose(): void;
}

const defaultId = () =>
  typeof globalThis.crypto?.randomUUID === 'function'
    ? globalThis.crypto.randomUUID()
    : `act_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;

const errorMessage = (error: unknown) => (error instanceof Error ? error.message : String(error));

/** @experimental Generative UI is in beta and may change without notice. */
export function createGenUIActionDispatcher(options: GenUIActionDispatcherOptions = {}): GenUIActionDispatcher {
  const limits = resolveGenUILimits(options.limits);
  const maxCompleted = options.maxCompletedResults ?? 200;
  const generateId = options.generateId ?? defaultId;
  const handlers = new Map<string, GenUIActionHandler<any>>(Object.entries(options.handlers ?? {}));
  const completed = new Map<string, GenUIActionResult>();
  const inFlight = new Map<
    string,
    { action: GenUIAction; promise: Promise<GenUIActionResult>; controller: AbortController }
  >();
  const listeners = new Set<() => void>();
  let disposed = false;

  const notify = () => listeners.forEach(listener => listener());

  const remember = (actionId: string, result: GenUIActionResult) => {
    completed.set(actionId, result);
    if (completed.size > maxCompleted) completed.delete(completed.keys().next().value!);
    return result;
  };

  const run = async (action: GenUIAction, handler: GenUIActionHandler<any>, controller: AbortController) => {
    const surface = options.getSurface?.(action.surfaceId);
    let payload: unknown = action.payload;
    if (handler.schema) {
      const validated = await validateSchema(handler.schema, action.payload);
      if (!validated.ok) return { status: 'invalid', error: validated.error } as const;
      payload = validated.value;
    }
    if (controller.signal.aborted) return { status: 'cancelled' } as const;
    try {
      const value = await handler.handle(payload as never, { action, surface, signal: controller.signal });
      if (controller.signal.aborted) return { status: 'cancelled' } as const;
      return { status: 'success', value } as const;
    } catch (error) {
      if (controller.signal.aborted) return { status: 'cancelled' } as const;
      return { status: 'error', error: errorMessage(error) } as const;
    }
  };

  const staleReason = (action: GenUIAction): string | undefined => {
    if (!options.getSurface) return undefined;
    const surface = options.getSurface(action.surfaceId);
    if (!surface) return `surface "${action.surfaceId}" no longer exists`;
    if (surface.status === 'aborted' || surface.status === 'failed')
      return `surface "${action.surfaceId}" is ${surface.status}`;
    if (action.elementId === undefined) return undefined;
    const revision = surface.elementRevisions[action.elementId];
    if (revision === undefined) return `element "${action.elementId}" no longer exists`;
    if (revision > (action.sourceRevision ?? 0)) return `element "${action.elementId}" changed after it was rendered`;
    return undefined;
  };

  return {
    dispatch(input) {
      const actionId = input.actionId ?? generateId();
      const done = completed.get(actionId);
      if (done) return Promise.resolve(done);
      const running = inFlight.get(actionId);
      if (running) return running.promise;
      if (disposed) return Promise.resolve({ status: 'cancelled' });

      let action: GenUIAction;
      try {
        action = {
          actionId,
          surfaceId: String(input.surfaceId),
          name: String(input.name),
          payload: toSafeJSONValue(input.payload ?? null, limits.maxValueDepth, 'payload'),
        };
        if (input.elementId !== undefined) {
          action.elementId = String(input.elementId);
          action.sourceRevision = Number(input.sourceRevision) || 0;
        }
      } catch (error) {
        return Promise.resolve(remember(actionId, { status: 'invalid', error: errorMessage(error) }));
      }

      const handler = handlers.get(action.name);
      if (!handler) {
        return Promise.resolve(
          remember(actionId, { status: 'unhandled', error: `no handler registered for action "${action.name}"` }),
        );
      }
      if (!handler.allowStale) {
        const reason = staleReason(action);
        if (reason) return Promise.resolve(remember(actionId, { status: 'stale', error: reason }));
      }
      if (!handler.allowConcurrent) {
        for (const other of inFlight.values()) {
          if (
            other.action.surfaceId === action.surfaceId &&
            other.action.elementId === action.elementId &&
            other.action.name === action.name
          ) {
            // Busy results are not cached so the user can retry once the first run finishes.
            return Promise.resolve({ status: 'busy', error: `action "${action.name}" is already running` });
          }
        }
      }

      const controller = new AbortController();
      const promise = run(action, handler, controller).then(result => {
        inFlight.delete(actionId);
        // Failed and cancelled runs are retryable under the same id; everything else is final.
        if (result.status !== 'error' && result.status !== 'cancelled') remember(actionId, result);
        notify();
        return result as GenUIActionResult;
      });
      inFlight.set(actionId, { action, promise, controller });
      notify();
      return promise;
    },
    register(name, handler) {
      handlers.set(name, handler);
      return () => {
        if (handlers.get(name) === handler) handlers.delete(name);
      };
    },
    cancel(actionId) {
      inFlight.get(actionId)?.controller.abort();
    },
    isPending(filter) {
      for (const { action } of inFlight.values()) {
        if (
          (filter.surfaceId === undefined || action.surfaceId === filter.surfaceId) &&
          (filter.elementId === undefined || action.elementId === filter.elementId) &&
          (filter.name === undefined || action.name === filter.name)
        ) {
          return true;
        }
      }
      return false;
    },
    getResult: actionId => completed.get(actionId),
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    dispose() {
      disposed = true;
      inFlight.forEach(entry => entry.controller.abort());
      listeners.clear();
    },
  };
}
