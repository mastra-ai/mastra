/**
 * Internal: tools that must run one at a time, in the order the model emitted them.
 *
 * A tool carrying an `orderedToolGroup` is gated per model step: calls in the same group
 * start their execution only after the previous call of that group (in emitted order) has
 * finished. Calls outside any group are unaffected and keep running concurrently.
 * Not part of the public API.
 */
import { findProviderToolByName } from './provider-tool-utils';

/** Group shared by the workspace computer tools, which all drive one desktop. */
export const COMPUTER_ORDERED_TOOL_GROUP = 'workspace-computer';

export interface OrderedToolGate {
  /** Resolves once every earlier call of the same group has released. */
  ready: Promise<void>;
  /** Lets the next call of the group start. Idempotent. */
  release: () => void;
}

export function markOrderedTool<T extends object>(tool: T, group: string): T {
  (tool as { orderedToolGroup?: string }).orderedToolGroup = group;
  return tool;
}

export function getOrderedToolGroup(tool: unknown): string | undefined {
  if (!tool || typeof tool !== 'object') return undefined;
  const group = (tool as { orderedToolGroup?: unknown }).orderedToolGroup;
  return typeof group === 'string' ? group : undefined;
}

/** Resolve a called tool the same way the tool-call step does: key, provider name, then id. */
export function findStepTool(tools: Record<string, unknown> | undefined, toolName: string): unknown {
  return (
    tools?.[toolName] ||
    findProviderToolByName(tools as any, toolName) ||
    Object.values(tools || {}).find(t => !!t && typeof t === 'object' && 'id' in t && (t as any).id === toolName)
  );
}

/**
 * Build one gate per ordered call, chained in emitted order within each group.
 * Calls whose tool has no group get no gate.
 */
export function createOrderedToolGates(
  toolCalls: { toolCallId?: string; toolName: string }[],
  tools: Record<string, unknown> | undefined,
): Map<string, OrderedToolGate> {
  const gates = new Map<string, OrderedToolGate>();
  const tails = new Map<string, Promise<void>>();
  for (const call of toolCalls) {
    if (!call.toolCallId || gates.has(call.toolCallId)) continue;
    const group = getOrderedToolGroup(findStepTool(tools, call.toolName));
    if (!group) continue;
    let release!: () => void;
    const released = new Promise<void>(resolve => {
      release = resolve;
    });
    gates.set(call.toolCallId, { ready: tails.get(group) ?? Promise.resolve(), release });
    tails.set(group, released);
  }
  return gates;
}

/** Wait for `ready`, or return false as soon as `signal` aborts. */
export function waitForGate(ready: Promise<void>, signal: AbortSignal | undefined): Promise<boolean> {
  if (!signal) return ready.then(() => true);
  if (signal.aborted) return Promise.resolve(false);
  return new Promise<boolean>(resolve => {
    const onAbort = () => resolve(false);
    signal.addEventListener('abort', onAbort, { once: true });
    void ready.then(() => {
      signal.removeEventListener('abort', onAbort);
      resolve(true);
    });
  });
}
