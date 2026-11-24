"use client";
import { snapshotSchema, sessionIdSchema, workspaceId } from "../workspace/contracts.ts";
import type { WorkspaceSnapshot } from "../workspace/contracts.ts";

export const selectionKey = "explorer-chat";
export function selectedSession() {
  try {
    return sessionIdSchema.parse(localStorage.getItem(selectionKey) ?? workspaceId);
  } catch {
    return workspaceId;
  }
}
interface BootstrapState {
  snapshot?: WorkspaceSnapshot;
  error?: string;
}
export const bootstrap: {
  state: BootstrapState;
  subscribers: Set<() => void>;
  generation: number;
  accept(snapshot: WorkspaceSnapshot): void;
  load(id?: string, signal?: AbortSignal): Promise<void>;
} = {
  state: {},
  subscribers: new Set<() => void>(),
  generation: 0,
  accept(snapshot: WorkspaceSnapshot) {
    bootstrap.generation++;
    bootstrap.state = { snapshot };
    try {
      localStorage.setItem(selectionKey, snapshot.workspace.id);
    } catch {
      /* Storage may be disabled. */
    }
    for (const subscriber of bootstrap.subscribers) subscriber();
  },
  async load(id = selectedSession(), signal?: AbortSignal) {
    const generation = ++bootstrap.generation;
    try {
      const response = await fetch(`/api/workspace?session=${encodeURIComponent(id)}`, {
        cache: "no-store",
        signal: signal ?? null,
      });
      if (!response.ok)
        throw new Error(
          "Could not open this saved chat. Check the local agent and storage, then retry.",
        );
      const snapshot = snapshotSchema.parse(await response.json());
      if (generation === bootstrap.generation && !signal?.aborted) bootstrap.accept(snapshot);
    } catch (error) {
      if (generation === bootstrap.generation && !signal?.aborted) throw error;
    }
  },
};
export function subscribe(subscriber: () => void) {
  bootstrap.subscribers.add(subscriber);
  return () => {
    bootstrap.subscribers.delete(subscriber);
  };
}
const initialBootstrap: BootstrapState = {};
export function value() {
  return bootstrap.state;
}
export function unavailable() {
  return initialBootstrap;
}
