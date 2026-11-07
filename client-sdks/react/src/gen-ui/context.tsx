import type {
  GenUIContextEntry,
  GenUIEdits,
  GenUISurface,
  GenUIValidationResult,
  JSONObject,
  JSONValue,
} from '@mastra/client-js/gen-ui';
import { rebaseGenUIEdit } from '@mastra/client-js/gen-ui';
import { createContext, useContext, useEffect, useSyncExternalStore } from 'react';
import type { ReactNode } from 'react';
import type { GenUIController } from './controller';
import type { GenUIToolApproval } from './registry';
import { readSurfaceEdits, surfaceEditsScope } from './surface-store';
import type { GenUISurfaceStore } from './surface-store';

const ControllerContext = createContext<GenUIController | undefined>(undefined);
const ToolCallContext = createContext<string | undefined>(undefined);

/** The surface a declarative component is rendered in, and its state store. */
export interface GenUISurfaceScope {
  surfaceId: string;
  store: GenUISurfaceStore;
}

export const SurfaceScopeContext = createContext<GenUISurfaceScope | undefined>(undefined);

/** @experimental Generative UI is in beta and may change without notice. */
export function GenUIProvider({ controller, children }: { controller: GenUIController; children?: ReactNode }) {
  return <ControllerContext.Provider value={controller}>{children}</ControllerContext.Provider>;
}

export function GenUIToolCallScope({ toolCallId, children }: { toolCallId: string; children?: ReactNode }) {
  return <ToolCallContext.Provider value={toolCallId}>{children}</ToolCallContext.Provider>;
}

/** @experimental Generative UI is in beta and may change without notice. */
export function useGenUIController(): GenUIController {
  const controller = useContext(ControllerContext);
  if (!controller) throw new Error('GenUI hooks must be used inside <GenUIProvider> or a GenUI renderer');
  return controller;
}

/**
 * Subscribe to one surface. Only re-renders when that surface object changes.
 *
 * @experimental Generative UI is in beta and may change without notice.
 */
export function useGenUISurface(surfaceId: string): GenUISurface | undefined {
  const controller = useGenUIController();
  const get = () => controller.getState().surfaces[surfaceId];
  return useSyncExternalStore(controller.subscribe, get, get);
}

/**
 * Ids of every surface with the given placement, in creation order.
 *
 * @experimental Generative UI is in beta and may change without notice.
 */
export function useGenUISurfaceIds(placement?: GenUISurface['placement']): readonly string[] {
  const controller = useGenUIController();
  const get = () => controller.getSurfaceIds(placement);
  return useSyncExternalStore(controller.subscribe, get, get);
}

/** @experimental Generative UI is in beta and may change without notice. */
export interface GenUISurfaceState {
  surfaceId: string;
  /** The agent's surface state with the user's edits on top; what `$state` bindings read. */
  value: JSONObject;
  /** The agent's surface state without local edits, e.g. to show what the agent changed in a conflict. */
  agentValue: JSONObject;
  /** State paths (JSON pointers) the user changed locally. */
  edited: readonly string[];
  /** Edited paths the agent changed after the user edited them. Local values keep winning until resolved. */
  conflicts: readonly string[];
  /** Write a value at a state path, like a `$bindState` binding or a `setState` action does. */
  set(path: string, value: unknown): void;
  /** Keep the local value at `path` and accept the agent's change underneath it, clearing the conflict. */
  keepLocal(path: string): void;
  /** Drop the local edit at `path` (or every edit) and show the agent's value again. */
  discard(path?: string): void;
}

/**
 * State of the surface the calling component was rendered in: the agent's `spec.state` with the user's
 * edits on top, plus conflicts when the agent changes a value the user already edited. Edits stay in the
 * browser; send them to the agent explicitly (an action, a message, or published context).
 *
 * @experimental Generative UI is in beta and may change without notice.
 */
export function useGenUISurfaceState(): GenUISurfaceState {
  const controller = useGenUIController();
  const scope = useContext(SurfaceScopeContext);
  if (!scope) throw new Error('useGenUISurfaceState must be used inside a component rendered by a GenUI surface');
  const { surfaceId, store } = scope;
  const merged = useSyncExternalStore(store.subscribe, store.getMerged, store.getMerged);
  const writeEdits = (edits: GenUIEdits) => controller.state.set(surfaceEditsScope(surfaceId), edits as JSONObject);
  return {
    surfaceId,
    value: merged.value,
    agentValue: store.getAgentState(),
    edited: Object.keys(merged.edits),
    conflicts: merged.conflicts,
    set: (path, value) => store.set(path, value),
    keepLocal: path =>
      writeEdits(rebaseGenUIEdit(readSurfaceEdits(controller.state, surfaceId), store.getAgentState(), path)),
    discard(path) {
      if (path === undefined) return controller.state.reset(surfaceEditsScope(surfaceId));
      const { [path]: _dropped, ...rest } = readSurfaceEdits(controller.state, surfaceId);
      writeEdits(rest);
    },
  };
}

/**
 * Publish a value for the agent while the calling component is mounted. Published values are sent
 * with the next message `useGenUIChat` sends, as additional system context. Nothing is sent eagerly.
 *
 * @experimental Generative UI is in beta and may change without notice.
 */
export function useGenUIPublishedContext(
  key: string,
  value: JSONValue | undefined,
  options: { description?: string; enabled?: boolean } = {},
) {
  const { context } = useGenUIController();
  const { description, enabled = true } = options;
  const serialized = value === undefined ? undefined : JSON.stringify(value);
  useEffect(() => {
    if (!enabled || serialized === undefined) return;
    const parsed: JSONValue = JSON.parse(serialized);
    const entry: GenUIContextEntry = { value: parsed };
    if (description) entry.description = description;
    context.publish(key, entry);
    return () => context.unpublish(key);
  }, [context, key, serialized, description, enabled]);
}

function useToolSubscription<T>(get: () => T): T {
  const controller = useGenUIController();
  return useSyncExternalStore(controller.subscribeTools, get, get);
}

/**
 * Approval or suspension state for a tool call, with approve/decline actions and their loading status.
 *
 * @experimental Generative UI is in beta and may change without notice.
 */
export function useGenUIToolApproval(toolCallId: string): GenUIToolApproval | undefined {
  const controller = useGenUIController();
  return useToolSubscription(() => controller.getToolApproval(toolCallId));
}

/** @experimental Generative UI is in beta and may change without notice. */
export interface GenUIToolResponse {
  /** `false` when the call already resolved, or the run that waited for it is gone (e.g. after a reload). */
  canRespond: boolean;
  respond(value: unknown): Promise<GenUIValidationResult<unknown>>;
}

/**
 * Answer an interactive frontend tool call. Defaults to the tool call the component was rendered for.
 *
 * @experimental Generative UI is in beta and may change without notice.
 */
export function useGenUIToolResponse(toolCallId?: string): GenUIToolResponse {
  const controller = useGenUIController();
  const scoped = useContext(ToolCallContext);
  const id = toolCallId ?? scoped;
  if (!id) throw new Error('useGenUIToolResponse needs a tool call id outside a GenUI tool renderer');
  const canRespond = useToolSubscription(() => controller.hasPendingResponse(id));
  return { canRespond, respond: value => controller.respond(id, value) };
}
