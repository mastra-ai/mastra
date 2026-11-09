import type { Catalog, Spec, StateStore } from '@json-render/core';
import {
  collectToolCallMeta,
  createGenUIActionRunner,
  createGenUIContextStore,
  createSpecResolver,
  createSpecTools,
  createSpecValidator,
  validate,
  validateModelInput,
} from '@mastra/client-js/gen-ui';
import type {
  GenUIActionContext as CoreActionContext,
  GenUIActionHandler as CoreActionHandler,
  GenUIActionHandlers as CoreActionHandlers,
  DataSpecRead,
  GenUISpecActionScope,
  GenUIContextStore,
  GenUIValidationResult,
  NormalizedToolCall,
  ToolCallMeta,
} from '@mastra/client-js/gen-ui';
import type { MastraDBMessage } from '@mastra/core/agent/message-list';
import type { z } from 'zod/v4';
import type { SendMessageArgs } from '../agent/hooks';
import type { ClientToolsInput } from '../agent/types';
import type { GenUIRegistry, GenUIToolApproval } from './registry';

export type { DataSpecRead } from '@mastra/client-js/gen-ui';

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
export type GenUIActionContext = CoreActionContext<GenUIChatServices>;

/**
 * Handler for an app action declared in the catalog. Receives the params validated against the catalog's
 * `params` schema. Throwing reports the failure to json-render (`onError` bindings).
 *
 * @experimental Generative UI is in beta and may change without notice.
 */
export type GenUIActionHandler<P = Record<string, unknown>> = CoreActionHandler<P, GenUIChatServices>;

/**
 * Handlers for the catalog's actions, typed from their `params` schemas.
 *
 * @experimental Generative UI is in beta and may change without notice.
 */
export type GenUIActionHandlers<C extends Catalog = Catalog> = CoreActionHandlers<C, GenUIChatServices>;

/** @experimental Generative UI is in beta and may change without notice. */
export interface GenUIControllerOptions {
  registry: GenUIRegistry;
  actions?: GenUIActionHandlers;
  navigate?: (path: string) => void;
}

export type { GenUISpecActionScope } from '@mastra/client-js/gen-ui';

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
  /**
   * The spec a spec or edit tool call renders, as far as its arguments have streamed. An edit resolves its
   * target and applies to it, starting from the state the user had set in the target.
   */
  readSpecCall(call: NormalizedToolCall): { spec?: Spec; error?: string };
  /** Fires when the chat's spec and edit tool calls change, so edits can resolve their targets. */
  subscribeSpecs(listener: () => void): () => void;
  specsVersion(): number;
  /** Register the live json-render state of a rendered spec, which edits of it start from. */
  trackStore(toolCallId: string, store: StateStore): () => void;
  /** The message whose spec a json-render `data-spec` part renders; only the first such part of a message has one. */
  dataSpecOf(part: object): string | undefined;
  /** The spec a message's `data-spec` parts build so far. `live` while it is the latest assistant message. */
  readDataSpec(messageId: string): DataSpecRead;
  /** json-render action handlers for one spec: one per catalog action, run through `setActions` handlers. */
  actionHandlers(scope: GenUISpecActionScope): Record<string, (params: Record<string, unknown>) => Promise<void>>;
  setServices(services: GenUIChatServices): void;
  setActions(actions?: GenUIActionHandlers, navigate?: (path: string) => void): void;
  /** Runs the latest `navigate` given to `setActions`; json-render calls it for `onSuccess: { navigate }`. */
  navigate(path: string): void;
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

  const { validateProps, checkSpec } = createSpecValidator(registry);

  // ---- actions ---------------------------------------------------------------------------------
  let handlers: GenUIActionHandlers = options.actions ?? {};
  let navigateTo = options.navigate;
  const actions = createGenUIActionRunner<GenUIChatServices>({
    definition: registry,
    context,
    handlers: () => handlers,
    chat: requireServices,
  });

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

  // ---- spec and edit calls ---------------------------------------------------------------------
  let specVersion = 0;
  const specListeners = new Set<() => void>();
  const stores = new Map<string, StateStore>();
  const resolver = createSpecResolver({
    specTool: registry.specTool,
    stateOf: toolCallId => stores.get(toolCallId)?.getSnapshot(),
  });

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

  for (const tool of createSpecTools({ definition: registry, resolver, validator: { validateProps, checkSpec } })) {
    clientTools[tool.name] = {
      id: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema,
      execute: (input: unknown, executeContext: unknown) =>
        tool.execute(input, { toolCallId: toolCallIdFrom(executeContext) }),
    };
  }

  const reset = () => {
    actions.reset();
    rejectPending('The conversation changed before the user responded');
    approvalStatus.clear();
    approvalCache.clear();
    toolMeta = new Map();
    resolver.reset();
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
      if (resolver.update(messages)) {
        specVersion++;
        specListeners.forEach(listener => listener());
      }
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
    readSpecCall: call => resolver.readCall(call),
    subscribeSpecs(listener) {
      specListeners.add(listener);
      return () => specListeners.delete(listener);
    },
    specsVersion: () => specVersion,
    trackStore(toolCallId, store) {
      stores.set(toolCallId, store);
      return () => {
        if (stores.get(toolCallId) === store) stores.delete(toolCallId);
      };
    },
    dataSpecOf: part => resolver.dataSpecOf(part),
    readDataSpec: messageId => resolver.readDataSpec(messageId),
    actionHandlers: scope => actions.handlersFor(scope),
    setServices(next) {
      services = next;
    },
    setActions(next = {}, nextNavigate) {
      handlers = next;
      navigateTo = nextNavigate;
    },
    navigate(path) {
      if (navigateTo) navigateTo(path);
      else console.warn(`[GenUI] No navigate function to go to "${path}"`);
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
