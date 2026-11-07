import { resolveElementProps } from '@json-render/core';
import type { Catalog, InferActionParams, InferCatalogActions, Spec, StateModel, StateStore } from '@json-render/core';
import type { MastraDBMessage } from '@mastra/core/agent/message-list';
import type { z } from 'zod/v4';
import type { SendMessageArgs } from '../agent/hooks';
import type { ClientToolsInput } from '../agent/types';
import { createGenUIContextStore } from './context-store';
import type { GenUIContextStore } from './context-store';
import type { GenUIRegistry, GenUIToolApproval } from './registry';
import { checkSpecStructure, readSpecToolArgs, specToolInputSchema } from './spec';
import { collectToolCallMeta } from './tool-parts';
import type { ToolCallMeta } from './tool-parts';
import { validate, validateModelInput } from './validate';
import type { GenUIValidationResult } from './validate';

/**
 * Chat operations available to action handlers. Bound to the `useGenUIChat` instance that owns the controller.
 *
 * @experimental Generative UI is in beta and may change without notice.
 */
export interface GenUIChatServices {
  /** Send a user message through the owning chat (GenUI tools and published context are attached). */
  sendMessage(args: string | SendMessageArgs): Promise<void>;
  /** Approve a pending tool call, or resume a suspended one with `resumeData`. */
  approveToolCall(toolCallId: string, resumeData?: unknown): Promise<void>;
  declineToolCall(toolCallId: string): Promise<void>;
  threadId?: string;
}

export interface GenUIChatSyncState {
  threadId?: string;
  /** Whether the chat is running. Spec calls left without a result only look busy while it is. */
  running?: boolean;
}

/** @experimental Generative UI is in beta and may change without notice. */
export interface GenUIActionContext {
  /** Spec tool call whose element raised the action. */
  toolCallId: string;
  chat: GenUIChatServices;
  /** Values published for the agent with the next message. */
  context: GenUIContextStore;
  /** The spec's state as the user sees it. */
  state: StateModel;
  /** Write the spec's state at a JSON pointer, like a `setState` action. */
  setState(path: string, value: unknown): void;
}

/**
 * Handler for an app action declared in the catalog. Receives the params validated against the catalog's
 * `params` schema. Throwing reports the failure to json-render (`onError` bindings).
 *
 * @experimental Generative UI is in beta and may change without notice.
 */
export type GenUIActionHandler<P = Record<string, unknown>> = (
  params: P,
  context: GenUIActionContext,
) => unknown | Promise<unknown>;

/**
 * Handlers for the catalog's actions, typed from their `params` schemas.
 *
 * @experimental Generative UI is in beta and may change without notice.
 */
export type GenUIActionHandlers<C extends Catalog = Catalog> = {
  [K in keyof InferCatalogActions<C> & string]?: GenUIActionHandler<InferActionParams<C, K>>;
};

/** @experimental Generative UI is in beta and may change without notice. */
export interface GenUIControllerOptions {
  registry: GenUIRegistry;
  actions?: GenUIActionHandlers;
}

/** Where a spec's actions run: its tool call, its json-render state, and whether it may act right now. */
export interface GenUISpecActionScope {
  toolCallId: string;
  store: StateStore;
  /** Only a ready spec acts; a stopped, failed or still-streaming one reflects an outdated model view. */
  isReady(): boolean;
}

/** @experimental Generative UI is in beta and may change without notice. */
export interface GenUIController {
  readonly registry: GenUIRegistry;
  /** Values published for the agent. Sent with the next message as additional system context. */
  readonly context: GenUIContextStore;
  /** Frontend tools derived from the registry. Merge into the chat's client tools. */
  readonly clientTools: ClientToolsInput;
  /**
   * Bring tool state in line with the chat: its messages, whether it is running, and its thread. Switching
   * threads drops the previous thread's approvals and pending responses.
   */
  sync(messages: ReadonlyArray<MastraDBMessage>, chat?: GenUIChatSyncState): void;
  isRunning(): boolean;
  /** Fires when the chat starts or stops running. */
  subscribe(listener: () => void): () => void;
  getToolApproval(toolCallId: string): GenUIToolApproval | undefined;
  hasPendingResponse(toolCallId: string): boolean;
  /** Fires when approvals, approval status, or pending interactive responses change. */
  subscribeTools(listener: () => void): () => void;
  /** Resolve an interactive frontend tool with the user's answer. */
  respond(toolCallId: string, value: unknown): GenUIValidationResult<unknown>;
  /**
   * Validate resolved props against a catalog component's schema. `undefined` when the component is not in
   * the catalog. Results are cached per props object.
   */
  validateProps(type: string, props: unknown): GenUIValidationResult<unknown> | undefined;
  /** First problem of a complete spec: its structure, unknown components, or props that fail their schema. */
  checkSpec(spec: Spec): string | undefined;
  /** json-render action handlers for one spec: one per catalog action, run through `setActions` handlers. */
  actionHandlers(scope: GenUISpecActionScope): Record<string, (params: Record<string, unknown>) => Promise<void>>;
  setServices(services: GenUIChatServices): void;
  setActions(actions?: GenUIActionHandlers): void;
  /** Keep the controller alive; the returned release disposes it once nothing retains it (StrictMode safe). */
  retain(): () => void;
  dispose(): void;
}

const errorMessage = (error: unknown) => (error instanceof Error ? error.message : String(error));

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** @experimental Generative UI is in beta and may change without notice. */
export function createGenUIController(options: GenUIControllerOptions): GenUIController {
  const { registry } = options;
  const context = createGenUIContextStore();
  let services: GenUIChatServices | undefined;
  let disposed = false;
  let retainers = 0;

  const requireServices = () => {
    if (!services) throw new Error('GenUI chat services are not ready yet');
    return services;
  };

  // ---- run lifecycle ---------------------------------------------------------------------------
  const listeners = new Set<() => void>();
  let running = false;
  let syncedThread: { id: string | undefined } | undefined;

  // ---- props validation ------------------------------------------------------------------------
  const propsValidation = new WeakMap<object, Map<string, GenUIValidationResult<unknown>>>();
  const validateProps = (type: string, props: unknown) => {
    const entry = registry.components[type];
    if (!entry) return undefined;
    const key = isRecord(props) ? props : undefined;
    const cached = key && propsValidation.get(key)?.get(type);
    if (cached) return cached;
    const result = validateModelInput(entry.props, props ?? {});
    if (key) {
      const byType = propsValidation.get(key) ?? new Map();
      byType.set(type, result);
      propsValidation.set(key, byType);
    }
    return result;
  };

  const checkSpec = (spec: Spec): string | undefined => {
    const structural = checkSpecStructure(spec);
    if (structural) return structural;
    const stateModel = spec.state ?? {};
    for (const [id, element] of Object.entries(spec.elements)) {
      const entry = registry.components[element.type];
      if (!entry?.declarative) return `unknown component "${element.type}" on element "${id}"`;
      const validation = validateProps(element.type, resolveElementProps(element.props, { stateModel }));
      if (validation && !validation.ok) {
        return `invalid props for element "${id}" (${element.type}): ${validation.error}`;
      }
    }
    return undefined;
  };

  // ---- actions ---------------------------------------------------------------------------------
  let handlers: GenUIActionHandlers = options.actions ?? {};
  /** `toolCallId:action` pairs in flight, so a double click does not run an action twice. */
  const runningActions = new Set<string>();

  const actionHandlers = ({ toolCallId, store, isReady }: GenUISpecActionScope) =>
    Object.fromEntries(
      Object.values(registry.actions).map(({ name, params: schema }) => [
        name,
        async (raw: Record<string, unknown>) => {
          if (!isReady()) {
            console.warn(`[GenUI] Ignored action "${name}": spec "${toolCallId}" is not ready`);
            return;
          }
          const handler = handlers[name];
          if (!handler) {
            console.warn(`[GenUI] No handler for action "${name}"`);
            return;
          }
          const key = `${toolCallId}:${name}`;
          if (runningActions.has(key)) return;
          let params: unknown = raw ?? {};
          if (schema) {
            const validated = validate(schema, params);
            if (!validated.ok) {
              console.warn(`[GenUI] Ignored action "${name}": invalid params (${validated.error})`);
              return;
            }
            params = validated.value;
          }
          runningActions.add(key);
          try {
            await handler(params, {
              toolCallId,
              chat: requireServices(),
              context,
              state: store.getSnapshot(),
              setState: (path, value) => store.set(path, value),
            });
          } finally {
            runningActions.delete(key);
          }
        },
      ]),
    );

  // ---- tool approvals, suspensions, interactive responses -------------------------------------
  const toolListeners = new Set<() => void>();
  const notifyTools = () => toolListeners.forEach(listener => listener());
  let toolMeta = new Map<string, ToolCallMeta>();
  const approvalStatus = new Map<string, { status: 'pending' | 'error'; error?: string }>();
  const approvalCache = new Map<string, GenUIToolApproval>();
  const pending = new Map<
    string,
    { resolve: (value: unknown) => void; reject: (error: Error) => void; schema?: z.ZodType }
  >();

  const runApproval = async (toolCallId: string, run: () => Promise<void>) => {
    // One decision per tool call at a time: a second approve/decline while the first is in flight is a no-op.
    if (approvalStatus.get(toolCallId)?.status === 'pending') return;
    approvalStatus.set(toolCallId, { status: 'pending' });
    approvalCache.delete(toolCallId);
    notifyTools();
    try {
      await run();
      approvalStatus.delete(toolCallId);
    } catch (error) {
      approvalStatus.set(toolCallId, { status: 'error', error: errorMessage(error) });
    }
    approvalCache.delete(toolCallId);
    notifyTools();
  };

  const getToolApproval = (toolCallId: string): GenUIToolApproval | undefined => {
    const meta = toolMeta.get(toolCallId);
    if (!meta) return undefined;
    const cached = approvalCache.get(toolCallId);
    if (cached) return cached;
    const status = approvalStatus.get(toolCallId);
    const approval: GenUIToolApproval = {
      kind: meta.kind,
      ...(meta.kind === 'suspended' ? { suspendPayload: meta.suspendPayload } : {}),
      status: status?.status ?? 'idle',
      ...(status?.error ? { error: status.error } : {}),
      approve: resumeData => runApproval(toolCallId, () => requireServices().approveToolCall(toolCallId, resumeData)),
      decline: () => runApproval(toolCallId, () => requireServices().declineToolCall(toolCallId)),
    };
    approvalCache.set(toolCallId, approval);
    return approval;
  };

  const updateToolMeta = (messages: ReadonlyArray<MastraDBMessage>) => {
    const next = collectToolCallMeta(messages);
    let changed = next.size !== toolMeta.size;
    for (const [id, meta] of next) {
      const previous = toolMeta.get(id);
      if (previous && previous.kind === meta.kind && previous.suspendPayload === meta.suspendPayload) {
        next.set(id, previous);
      } else {
        changed = true;
        approvalCache.delete(id);
      }
    }
    if (!changed) return;
    for (const id of toolMeta.keys()) if (!next.has(id)) approvalCache.delete(id);
    toolMeta = next;
    notifyTools();
  };

  const rejectPending = (reason: string) => {
    if (pending.size === 0) return;
    for (const entry of pending.values()) entry.reject(new Error(reason));
    pending.clear();
    notifyTools();
  };

  // ---- frontend tools --------------------------------------------------------------------------
  const toolCallIdFrom = (executeContext: unknown) => {
    const agent = isRecord(executeContext) ? executeContext.agent : undefined;
    const id = isRecord(agent) ? agent.toolCallId : undefined;
    return typeof id === 'string' ? id : undefined;
  };

  const clientTools: ClientToolsInput = {};
  for (const entry of Object.values(registry.components)) {
    const tool = entry.tool;
    if (!tool) continue;
    if (tool.mode === 'display') {
      // Rendering happens from the streamed tool call; the server acknowledges and the loop continues.
      clientTools[tool.name] = {
        id: tool.name,
        description: tool.description,
        inputSchema: entry.propsSchema,
        renderOnly: true,
      };
      continue;
    }
    clientTools[tool.name] = {
      id: tool.name,
      description: tool.description,
      inputSchema: entry.propsSchema as never,
      execute: async (input: unknown, executeContext: unknown) => {
        const validated = validateModelInput(entry.props, input);
        if (!validated.ok) throw new Error(`Invalid arguments for ${tool.name}: ${validated.error}`);
        const toolCallId = toolCallIdFrom(executeContext);
        if (!toolCallId) throw new Error(`${tool.name} was called without a tool call id`);
        if (disposed) throw new Error('The user interface was closed before the user responded');
        return new Promise((resolve, reject) => {
          pending.set(toolCallId, { resolve, reject, schema: tool.responseSchema });
          notifyTools();
        });
      },
    };
  }

  if (registry.specTool) {
    const declarative = Object.values(registry.components).filter(entry => entry.declarative);
    const actionNames = Object.keys(registry.actions);
    const description = [
      'Render a user interface built only from the registered components below, as a json-render spec:',
      '`root` is the id of the top element and `elements` lists every element as {id, type, props, children?}.',
      'Each call renders a new, complete interface where the call appears in the conversation.',
      'Props can read state with {"$state": "/path"}; inputs bind two-way with {"$bindState": "/path"}. Put initial values in `state`, as a JSON object string.',
      `Elements react to component events through \`on\`, a list like [{"event": "press", "action": "setState", "params": "{\\"statePath\\": \\"/open\\", \\"value\\": true}"}]. Built-in actions: setState, pushState, removeState${
        actionNames.length ? `. App actions: ${actionNames.join(', ')}` : ''
      }.`,
      // Prop schemas are already in the input schema; repeating them here would double the tokens.
      `Components (props must match the component's schema in the input schema):\n${declarative
        .map(({ name, description, events }) =>
          [
            `- ${name}`,
            description ? `: ${description}` : '',
            events.length ? ` (events: ${events.join(', ')})` : '',
          ].join(''),
        )
        .join('\n')}`,
      registry.specTool.instructions,
    ]
      .filter(Boolean)
      .join('\n\n');
    clientTools[registry.specTool.name] = {
      id: registry.specTool.name,
      description,
      inputSchema: specToolInputSchema(declarative),
      execute: async (input: unknown) => {
        const read = readSpecToolArgs(input, true);
        if (!read.ok) return { ok: false, error: read.error };
        const error = checkSpec(read.spec);
        return error ? { ok: false, error } : { ok: true };
      },
    };
  }

  const reset = () => {
    runningActions.clear();
    rejectPending('The conversation changed before the user responded');
    approvalStatus.clear();
    approvalCache.clear();
    toolMeta = new Map();
    notifyTools();
  };

  const controller: GenUIController = {
    registry,
    context,
    clientTools,
    sync(messages, chat = {}) {
      if (syncedThread && syncedThread.id !== chat.threadId) reset();
      syncedThread = { id: chat.threadId };
      updateToolMeta(messages);
      const next = chat.running ?? false;
      if (next !== running) {
        running = next;
        listeners.forEach(listener => listener());
      }
    },
    isRunning: () => running,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getToolApproval,
    hasPendingResponse: toolCallId => pending.has(toolCallId),
    subscribeTools(listener) {
      toolListeners.add(listener);
      return () => toolListeners.delete(listener);
    },
    respond(toolCallId, value) {
      const entry = pending.get(toolCallId);
      if (!entry) return { ok: false, error: 'This tool call is no longer waiting for a response' };
      let result: unknown = value;
      if (entry.schema) {
        const validated = validate(entry.schema, value);
        if (!validated.ok) return validated;
        result = validated.value;
      }
      pending.delete(toolCallId);
      entry.resolve(result);
      notifyTools();
      return { ok: true, value: result };
    },
    validateProps,
    checkSpec,
    actionHandlers,
    setServices(next) {
      services = next;
    },
    setActions(next = {}) {
      handlers = next;
    },
    retain() {
      retainers += 1;
      let released = false;
      return () => {
        if (released) return;
        released = true;
        retainers -= 1;
        queueMicrotask(() => {
          if (retainers === 0) controller.dispose();
        });
      };
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      rejectPending('The user interface was closed before the user responded');
    },
  };
  return controller;
}
