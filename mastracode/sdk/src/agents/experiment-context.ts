import type { AgentControllerRequestContext, AgentControllerRequestStateUpdater } from '@mastra/core/agent-controller';
import { MASTRA_RESOURCE_ID_KEY } from '@mastra/core/request-context';
import type { RequestContext } from '@mastra/core/request-context';
import type { Middleware } from '@mastra/core/server';
import type { MastraCodeState } from '../schema.js';

/**
 * Serializable `controller` value a dataset experiment caller can send over
 * HTTP. Only the model and mode selection are read from it. Everything else
 * the Code Agent needs (project path, plugin paths, config dir) comes from the
 * server's own controller state, so a caller can never point the agent at a
 * folder of their choosing.
 */
export interface ControllerSnapshot {
  session?: { modelId?: string; modeId?: string };
}

function isLiveControllerContext(value: unknown): value is AgentControllerRequestContext<MastraCodeState> {
  return (
    typeof value === 'object' && value !== null && typeof (value as { getState?: unknown }).getState === 'function'
  );
}

/**
 * Build an experiment-local controller context from a JSON snapshot.
 *
 * Mastra Code's dynamic model, instructions, workspace, tools and memory all
 * read `requestContext.get('controller')` and expect the live object a session
 * installs (`getState()`, `session.modelId`, …). JSON cannot carry functions, so
 * a dataset experiment run over HTTP arrives with plain data and crashes with
 * `getState is not a function` before any model call. This turns that data
 * into the shape those readers expect.
 *
 * Returns `undefined` when `snapshot` is already a live context (a real session
 * run) or is not an object, so callers can leave such values untouched.
 *
 * The returned state lives for this request only: nothing is persisted to a
 * session or thread. A missing `session.modelId` is passed through as `''`, so
 * the model resolver still fails closed with its own "No model available" error
 * instead of running on a guessed model.
 */
export function createExperimentControllerContext(
  snapshot: unknown,
  options: {
    controllerId: string;
    initialState: Partial<MastraCodeState>;
    defaultModeId: string;
    resourceId?: string;
  },
): AgentControllerRequestContext<MastraCodeState> | undefined {
  if (typeof snapshot !== 'object' || snapshot === null || isLiveControllerContext(snapshot)) return undefined;

  const session = (snapshot as ControllerSnapshot).session;
  const modelId = typeof session?.modelId === 'string' ? session.modelId : '';
  const modeId = typeof session?.modeId === 'string' && session.modeId ? session.modeId : options.defaultModeId;
  const resourceId = options.resourceId ?? '';
  const sessionId = `experiment-${globalThis.crypto.randomUUID()}`;

  // ponytail: caller state is ignored on purpose; add an allow-list when a run needs per-item knobs.
  let state = structuredClone(options.initialState) as MastraCodeState;
  const setState = (updates: Partial<MastraCodeState>) => {
    state = { ...state, ...updates };
    return Promise.resolve();
  };
  const updateState = <TResult>(updater: AgentControllerRequestStateUpdater<MastraCodeState, TResult>) =>
    Promise.resolve(updater(state as Readonly<MastraCodeState>)).then(result => {
      if (result.updates) state = { ...state, ...result.updates };
      return result.result;
    });

  return {
    controllerId: options.controllerId,
    harnessId: options.controllerId,
    get state() {
      return state;
    },
    getState: () => state,
    setState,
    updateState,
    threadId: null,
    resourceId,
    sessionId,
    session: {
      id: sessionId,
      ownerId: resourceId,
      modeId,
      modelId,
      state: { get: () => state, set: setState, update: updateState },
    },
  };
}

/**
 * Server middleware for the dataset experiment routes. When the request's
 * `controller` is a JSON snapshot, replace it with an experiment-local live
 * context so the Code Agent can run. Live contexts and requests without a
 * `controller` are left as they are.
 */
export function createExperimentControllerContextMiddleware(options: {
  controllerId: string;
  initialState: Partial<MastraCodeState>;
  defaultModeId: string;
}): Middleware {
  return {
    path: '/api/datasets/*',
    handler: async (c, next) => {
      const requestContext = c.get('requestContext') as RequestContext | undefined;
      const snapshot = requestContext?.get('controller');
      if (requestContext && snapshot !== undefined) {
        const resource = requestContext.get(MASTRA_RESOURCE_ID_KEY);
        const live = createExperimentControllerContext(snapshot, {
          ...options,
          resourceId: typeof resource === 'string' ? resource : undefined,
        });
        if (live) requestContext.set('controller', live);
      }
      await next();
    },
  };
}
