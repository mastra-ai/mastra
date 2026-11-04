import type {
  GenUIActionResult,
  GenUIContextEntry,
  GenUIEdits,
  GenUINode,
  GenUIStateEntry,
  GenUIStateScope,
  GenUISurface,
  GenUISetOptions,
  GenUISetResult,
  GenUIStateUpdater,
  GenUIValidationResult,
  JSONObject,
  JSONValue,
} from '@mastra/client-js/gen-ui';
import { editGenUIData, mergeGenUIData, rebaseGenUIEdit } from '@mastra/client-js/gen-ui';
import { createContext, useContext, useEffect, useState, useSyncExternalStore } from 'react';
import type { ReactNode } from 'react';
import type { GenUIController } from './controller';
import type { GenUIToolApproval } from './registry';

export interface GenUINodeScopeValue {
  surfaceId: string;
  nodeId: string;
}

const ControllerContext = createContext<GenUIController | undefined>(undefined);
const NodeContext = createContext<GenUINodeScopeValue | undefined>(undefined);
const ToolCallContext = createContext<string | undefined>(undefined);

export function GenUIProvider({ controller, children }: { controller: GenUIController; children?: ReactNode }) {
  return <ControllerContext.Provider value={controller}>{children}</ControllerContext.Provider>;
}

export function GenUINodeScope({
  surfaceId,
  nodeId,
  children,
}: {
  surfaceId: string;
  nodeId: string;
  children?: ReactNode;
}) {
  return <NodeContext.Provider value={{ surfaceId, nodeId }}>{children}</NodeContext.Provider>;
}

export function GenUIToolCallScope({ toolCallId, children }: { toolCallId: string; children?: ReactNode }) {
  return <ToolCallContext.Provider value={toolCallId}>{children}</ToolCallContext.Provider>;
}

export function useGenUIController(): GenUIController {
  const controller = useContext(ControllerContext);
  if (!controller) throw new Error('GenUI hooks must be used inside <GenUIProvider> or a GenUI renderer');
  return controller;
}

/** The surface and node the calling component was rendered for, or `undefined` outside a declarative surface. */
export function useGenUINodeScope(): GenUINodeScopeValue | undefined {
  return useContext(NodeContext);
}

/** Subscribe to one surface. Only re-renders when that surface object changes. */
export function useGenUISurface(surfaceId: string): GenUISurface | undefined {
  const controller = useGenUIController();
  const get = () => controller.getState().surfaces[surfaceId];
  return useSyncExternalStore(controller.subscribe, get, get);
}

/** Subscribe to one node. Unchanged nodes keep their identity, so this skips token-level re-renders. */
export function useGenUINode(surfaceId: string, nodeId: string): GenUINode | undefined {
  const controller = useGenUIController();
  const get = () => controller.getState().surfaces[surfaceId]?.nodes[nodeId];
  return useSyncExternalStore(controller.subscribe, get, get);
}

/** Ids of every surface with the given placement, in creation order. */
export function useGenUISurfaceIds(placement?: GenUISurface['placement']): readonly string[] {
  const controller = useGenUIController();
  const get = () => controller.getSurfaceIds(placement);
  return useSyncExternalStore(controller.subscribe, get, get);
}

function useCurrentNodeScope(hook: string) {
  const scope = useContext(NodeContext);
  if (!scope) throw new Error(`${hook} must be used inside a component rendered by a GenUI surface`);
  return scope;
}

/** Agent-owned data of the surface the calling component belongs to. Read-only on the client. */
export function useGenUISurfaceData(): JSONObject {
  const { surfaceId } = useCurrentNodeScope('useGenUISurfaceData');
  return useGenUISurface(surfaceId)?.data ?? EMPTY;
}

const EMPTY: JSONObject = {};

export interface GenUILocalState {
  value: JSONObject;
  revision: number;
  set(update: GenUIStateUpdater, options?: GenUISetOptions): GenUISetResult;
  patch(values: JSONObject, options?: GenUISetOptions): GenUISetResult;
  reset(): void;
}

/**
 * Client-local state scoped to the current surface (default) or the chat thread. Updates re-render
 * subscribers immediately and are never sent to the agent unless you send them explicitly.
 */
export function useGenUILocalState(scope: 'surface' | 'thread' | GenUIStateScope = 'surface'): GenUILocalState {
  const controller = useGenUIController();
  const node = useContext(NodeContext);
  let resolved: GenUIStateScope;
  if (typeof scope === 'object') resolved = scope;
  else if (scope === 'thread') resolved = controller.threadScope();
  else {
    if (!node) throw new Error('useGenUILocalState("surface") must be used inside a GenUI surface');
    resolved = { kind: 'surface', id: node.surfaceId };
  }
  const { kind, id } = resolved;
  const store = controller.state;
  const entry = useStateEntry(store, { kind, id });
  return {
    value: entry.value,
    revision: entry.revision,
    set: (update, options) => store.set({ kind, id }, update, options),
    patch: (values, options) => store.patch({ kind, id }, values, options),
    reset: () => store.reset({ kind, id }),
  };
}

function useStateEntry(store: GenUIController['state'], scope: GenUIStateScope): GenUIStateEntry {
  const get = () => store.get(scope);
  return useSyncExternalStore(listener => store.subscribe(scope, listener), get, get);
}

export interface GenUISharedData {
  /** Agent data with the user's edits on top. */
  value: JSONObject;
  /** Keys the user edited locally. */
  edited: readonly string[];
  /** Edited keys the agent changed after the user edited them. The local value is kept until resolved. */
  conflicts: readonly string[];
  set(key: string, value: JSONValue): void;
  /** Keep the local value of a conflicting key and accept the agent's change as seen. */
  keepLocal(key: string): void;
  /** Drop local edits (one key, or all) so the agent's value shows again. */
  discard(key?: string): void;
}

/**
 * The current surface's agent-owned data, editable by the user. Edits stay local and win over agent
 * updates; when the agent changes a key the user already edited, it is reported in `conflicts`
 * instead of silently overwriting either side. Send `value` to the agent explicitly (e.g. in an action).
 */
export function useGenUISharedData(): GenUISharedData {
  const controller = useGenUIController();
  const { surfaceId } = useCurrentNodeScope('useGenUISharedData');
  const data = useGenUISurface(surfaceId)?.data ?? EMPTY;
  const store = controller.state;
  // Surface ids cannot contain "/", so this scope never collides with a surface's own local state.
  const scope: GenUIStateScope = { kind: 'surface', id: `${surfaceId}/edits` };
  const edits = readEdits(useStateEntry(store, scope).value);
  const merged = mergeGenUIData(data, edits);
  const update = (next: (edits: GenUIEdits, data: JSONObject) => GenUIEdits) =>
    store.set(scope, previous => next(readEdits(previous), controller.getState().surfaces[surfaceId]?.data ?? EMPTY));
  return {
    value: merged.value,
    edited: Object.keys(edits),
    conflicts: merged.conflicts,
    set: (key, value) => update((current, agentData) => editGenUIData(current, agentData, key, value)),
    keepLocal: key => update((current, agentData) => rebaseGenUIEdit(current, agentData, key)),
    discard: key => {
      if (key === undefined) return store.reset(scope);
      update(current => {
        const { [key]: _dropped, ...rest } = current;
        return rest;
      });
    },
  };
}

/** Edits are stored as plain JSON in the state store; keep only well-formed entries. */
function readEdits(stored: JSONObject): GenUIEdits {
  const edits: GenUIEdits = {};
  for (const [key, edit] of Object.entries(stored)) {
    if (typeof edit !== 'object' || edit === null || Array.isArray(edit) || !('value' in edit)) continue;
    const { value, base } = edit;
    if (value === undefined) continue;
    edits[key] = base === undefined ? { value } : { value, base };
  }
  return edits;
}

/**
 * Publish a value for the agent while the calling component is mounted. Published values are sent
 * with the next message `useGenUIChat` sends, as additional system context. Nothing is sent eagerly.
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

export type GenUIActionStatus = 'idle' | 'pending' | GenUIActionResult['status'];

export interface UseGenUIActionResult {
  dispatch(payload?: unknown): Promise<GenUIActionResult>;
  status: GenUIActionStatus;
  result: GenUIActionResult | undefined;
  isPending: boolean;
}

/**
 * Dispatch a named action for the current node. The surface id, node id and the node revision the
 * user saw are attached automatically so stale or duplicate submissions are rejected.
 */
export function useGenUIAction(name: string): UseGenUIActionResult {
  const controller = useGenUIController();
  const { surfaceId, nodeId } = useCurrentNodeScope('useGenUIAction');
  const node = useGenUINode(surfaceId, nodeId);
  const sourceRevision = node?.revision ?? 0;
  const [state, setState] = useState<{ status: GenUIActionStatus; result?: GenUIActionResult }>({ status: 'idle' });

  async function dispatch(payload?: unknown) {
    setState({ status: 'pending' });
    const result = await controller.actions.dispatch({ surfaceId, nodeId, name, payload, sourceRevision });
    setState({ status: result.status, result });
    return result;
  }

  return { dispatch, status: state.status, result: state.result, isPending: state.status === 'pending' };
}

function useToolSubscription<T>(get: () => T): T {
  const controller = useGenUIController();
  return useSyncExternalStore(controller.subscribeTools, get, get);
}

/** Approval or suspension state for a tool call, with approve/decline actions and their loading status. */
export function useGenUIToolApproval(toolCallId: string): GenUIToolApproval | undefined {
  const controller = useGenUIController();
  return useToolSubscription(() => controller.getToolApproval(toolCallId));
}

export interface GenUIToolResponse {
  /** `false` when the call already resolved, or the run that waited for it is gone (e.g. after a reload). */
  canRespond: boolean;
  respond(value: unknown): Promise<GenUIValidationResult<unknown>>;
}

/** Answer an interactive frontend tool call. Defaults to the tool call the component was rendered for. */
export function useGenUIToolResponse(toolCallId?: string): GenUIToolResponse {
  const controller = useGenUIController();
  const scoped = useContext(ToolCallContext);
  const id = toolCallId ?? scoped;
  if (!id) throw new Error('useGenUIToolResponse needs a tool call id outside a GenUI tool renderer');
  const canRespond = useToolSubscription(() => controller.hasPendingResponse(id));
  return { canRespond, respond: value => controller.respond(id, value) };
}
