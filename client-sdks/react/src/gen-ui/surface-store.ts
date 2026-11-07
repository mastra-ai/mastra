import { getByPath } from '@json-render/core';
import type { StateStore } from '@json-render/core';
import { editGenUIState, mergeGenUIState, toSafeJSONValue } from '@mastra/client-js/gen-ui';
import type { GenUIEdits, GenUILimits, JSONObject } from '@mastra/client-js/gen-ui';

/**
 * The user's edits to each surface's state, kept by the controller so they survive remounts and the swap
 * from a streaming preview to the live surface. Cleared when the thread changes.
 *
 * @experimental Generative UI is in beta and may change without notice.
 */
export interface GenUIEditsStore {
  get(surfaceId: string): GenUIEdits;
  set(surfaceId: string, edits: GenUIEdits): void;
  subscribe(surfaceId: string, listener: () => void): () => void;
  clear(): void;
}

const NO_EDITS: GenUIEdits = Object.freeze({});

export function createGenUIEditsStore(limits: GenUILimits): GenUIEditsStore {
  const edits = new Map<string, GenUIEdits>();
  const listeners = new Map<string, Set<() => void>>();
  const notify = (surfaceId: string) => listeners.get(surfaceId)?.forEach(listener => listener());

  return {
    get: surfaceId => edits.get(surfaceId) ?? NO_EDITS,
    set(surfaceId, next) {
      const size = JSON.stringify(next).length;
      if (size > limits.maxSpecSize) {
        throw new Error(`Local edits to surface "${surfaceId}" exceed ${limits.maxSpecSize} characters`);
      }
      if (Object.keys(next).length) edits.set(surfaceId, next);
      else edits.delete(surfaceId);
      notify(surfaceId);
    },
    subscribe(surfaceId, listener) {
      let set = listeners.get(surfaceId);
      if (!set) listeners.set(surfaceId, (set = new Set()));
      set.add(listener);
      return () => set.delete(listener);
    },
    clear() {
      const ids = [...edits.keys()];
      edits.clear();
      ids.forEach(notify);
    },
  };
}

export interface GenUISurfaceStateSnapshot {
  /** Agent state with the user's edits on top. */
  value: JSONObject;
  edits: GenUIEdits;
  /** Edited paths the agent changed after the user edited them. */
  conflicts: string[];
}

export interface GenUISurfaceStore extends StateStore {
  /** Point the store at the agent state the surface currently renders (the preview's while streaming). */
  setAgentState(state: Record<string, unknown> | undefined): void;
  getAgentState(): JSONObject;
  getMerged(): GenUISurfaceStateSnapshot;
}

const EMPTY_STATE: JSONObject = Object.freeze({}) as JSONObject;

/**
 * json-render state store for one surface: reads the agent's `spec.state` with the user's edits on top,
 * and records writes (two-way bindings, `setState` actions) as edits, so a later agent update to the same
 * path shows up as a conflict instead of silently overwriting the user.
 */
export function createGenUISurfaceStore(
  edits: GenUIEditsStore,
  surfaceId: string,
  subscribeAgent: (listener: () => void) => () => void,
  limits: GenUILimits,
): GenUISurfaceStore {
  let agentState = EMPTY_STATE;
  let cache: { agent: JSONObject; edits: GenUIEdits; merged: GenUISurfaceStateSnapshot } | undefined;

  const getMerged = (): GenUISurfaceStateSnapshot => {
    const current = edits.get(surfaceId);
    if (cache && cache.agent === agentState && cache.edits === current) return cache.merged;
    const { value, conflicts } = mergeGenUIState(agentState, current);
    cache = { agent: agentState, edits: current, merged: { value, edits: current, conflicts } };
    return cache.merged;
  };

  const write = (updates: Record<string, unknown>) => {
    let next = edits.get(surfaceId);
    for (const [path, raw] of Object.entries(updates)) {
      // `undefined` clears a binding; anything else must survive a round trip through JSON.
      const value = raw === undefined ? null : toSafeJSONValue(raw, limits.maxValueDepth, path);
      next = editGenUIState(next, agentState, path, value);
    }
    edits.set(surfaceId, next);
  };

  return {
    setAgentState(next) {
      // Spec state only ever reaches a surface through the reducer, which checks it is plain JSON.
      agentState = (next as JSONObject | undefined) ?? EMPTY_STATE;
    },
    getAgentState: () => agentState,
    getMerged,
    getSnapshot: () => getMerged().value,
    get: path => getByPath(getMerged().value, path),
    set: (path, value) => write({ [path]: value }),
    update: write,
    subscribe(listener) {
      const offEdits = edits.subscribe(surfaceId, listener);
      const offAgent = subscribeAgent(listener);
      return () => {
        offEdits();
        offAgent();
      };
    },
  };
}
