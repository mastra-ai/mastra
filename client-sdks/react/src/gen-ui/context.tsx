import { createContext, useContext, useEffect, useSyncExternalStore } from 'react';
import type { ReactNode } from 'react';
import type { GenUIContextEntry } from './context-store';
import type { GenUIController } from './controller';
import type { JSONValue } from './json';
import type { GenUIToolApproval } from './registry';
import type { GenUIValidationResult } from './validate';

const ControllerContext = createContext<GenUIController | undefined>(undefined);
const ToolCallContext = createContext<string | undefined>(undefined);

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
  respond(value: unknown): GenUIValidationResult<unknown>;
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
