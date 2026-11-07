import { getByPath } from '@json-render/core';
import type { StateStore } from '@json-render/core';
import { editGenUIState, mergeGenUIState, toSafeJSONValue } from '@mastra/client-js/gen-ui';
import type { GenUIEdits, GenUIStateScope, GenUIStateStore, JSONObject } from '@mastra/client-js/gen-ui';

/** Where a surface keeps the user's edits to its agent state. */
export const surfaceEditsScope = (surfaceId: string): GenUIStateScope => ({ kind: 'surface', id: surfaceId });

/** The user's edits stored for a surface, ignoring anything that is not a well-formed edit. */
export function readSurfaceEdits(state: GenUIStateStore, surfaceId: string): GenUIEdits {
  const stored = state.get(surfaceEditsScope(surfaceId)).value;
  const edits: GenUIEdits = {};
  for (const [pointer, edit] of Object.entries(stored)) {
    if (
      pointer.startsWith('/') &&
      typeof edit === 'object' &&
      edit !== null &&
      !Array.isArray(edit) &&
      'value' in edit
    ) {
      edits[pointer] = edit as GenUIEdits[string];
    }
  }
  return edits;
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
 * and records writes (two-way bindings, `setState` actions) as edits in the GenUI state store, so a later
 * agent update to the same path shows up as a conflict instead of silently overwriting the user.
 */
export function createGenUISurfaceStore(
  state: GenUIStateStore,
  surfaceId: string,
  subscribeAgent: (listener: () => void) => () => void,
): GenUISurfaceStore {
  const scope = surfaceEditsScope(surfaceId);
  let agentState = EMPTY_STATE;
  let cache: { agent: JSONObject; stored: JSONObject; merged: GenUISurfaceStateSnapshot } | undefined;

  const getMerged = (): GenUISurfaceStateSnapshot => {
    const stored = state.get(scope).value;
    if (cache && cache.agent === agentState && cache.stored === stored) return cache.merged;
    const edits = readSurfaceEdits(state, surfaceId);
    const { value, conflicts } = mergeGenUIState(agentState, edits);
    cache = { agent: agentState, stored, merged: { value, edits, conflicts } };
    return cache.merged;
  };

  const write = (updates: Record<string, unknown>) => {
    let edits = readSurfaceEdits(state, surfaceId);
    for (const [path, raw] of Object.entries(updates)) {
      // `undefined` clears a binding; anything else must survive a round trip through JSON.
      // The state store enforces depth and size on the whole scope when it is written.
      const value = raw === undefined ? null : toSafeJSONValue(raw, Infinity, path);
      edits = editGenUIState(edits, agentState, path, value);
    }
    state.set(scope, edits as JSONObject);
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
      const offState = state.subscribe(scope, listener);
      const offAgent = subscribeAgent(listener);
      return () => {
        offState();
        offAgent();
      };
    },
  };
}
