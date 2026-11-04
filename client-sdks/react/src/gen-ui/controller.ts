import {
  GENUI_DATA_PART_TYPE,
  GENUI_PROTOCOL_VERSION,
  accumulateGenUI,
  createGenUIActionDispatcher,
  createGenUIContextStore,
  createGenUISession,
  createGenUIStateStore,
  parseGenUIOperations,
  resolveGenUILimits,
  validateSchema,
  validateSchemaSync,
} from '@mastra/client-js/gen-ui';
import type {
  GenUIActionContext,
  GenUIActionDispatcher,
  GenUIActionHandler,
  GenUIContextStore,
  GenUIEnvelope,
  GenUINode,
  GenUIOperation,
  GenUISession,
  GenUIState,
  GenUIStateScope,
  GenUIStateStore,
  GenUISurface,
  GenUIValidationResult,
  InferSchemaOutput,
  JSONValue,
  StandardSchemaV1,
} from '@mastra/client-js/gen-ui';
import type { MastraDBMessage } from '@mastra/core/agent/message-list';
import type { SendMessageArgs } from '../agent/hooks';
import type { ClientToolsInput } from '../agent/types';
import type { GenUIRegistry, GenUIToolApproval } from './registry';
import { collectToolCallMeta, normalizeToolPart } from './tool-parts';
import type { ToolCallMeta } from './tool-parts';

/** Chat operations available to action handlers. Bound to the `useGenUIChat` instance that owns the controller. */
export interface GenUIChatServices {
  /** Send a user message through the owning chat (GenUI tools and published context are attached). */
  sendMessage(args: string | SendMessageArgs): Promise<void>;
  /** Approve a pending tool call, or resume a suspended one with `resumeData`. */
  approveToolCall(toolCallId: string, resumeData?: unknown): Promise<void>;
  declineToolCall(toolCallId: string): Promise<void>;
  threadId?: string;
}

export interface GenUIChatActionContext extends GenUIActionContext {
  chat: GenUIChatServices;
  state: GenUIStateStore;
  context: GenUIContextStore;
}

export interface GenUIChatActionHandler<
  S extends StandardSchemaV1 | undefined = StandardSchemaV1 | undefined,
> extends Omit<GenUIActionHandler<S>, 'handle'> {
  handle(
    payload: S extends StandardSchemaV1 ? InferSchemaOutput<S> : JSONValue,
    context: GenUIChatActionContext,
  ): unknown | Promise<unknown>;
}

/** Typed helper for action handlers registered on `useGenUIChat`. */
export function defineGenUIChatAction<S extends StandardSchemaV1 | undefined = undefined>(
  handler: GenUIChatActionHandler<S>,
): GenUIChatActionHandler<S> {
  return handler;
}

export interface GenUIControllerOptions {
  registry: GenUIRegistry;
  actions?: Record<string, GenUIChatActionHandler<any>>;
}

export interface GenUIController {
  readonly registry: GenUIRegistry;
  readonly session: GenUISession;
  /** Client-local state. Never sent anywhere unless you pass it explicitly. */
  readonly state: GenUIStateStore;
  /** Values published for the agent. Sent with the next message as additional system context. */
  readonly context: GenUIContextStore;
  readonly actions: GenUIActionDispatcher;
  /** Frontend tools derived from the registry. Merge into the chat's client tools. */
  readonly clientTools: ClientToolsInput;
  /** Rebuild surface and tool state from the chat's messages. Incremental while streaming. */
  sync(messages: ReadonlyArray<MastraDBMessage>): void;
  /** Apply an envelope that did not arrive in a message (e.g. a workflow stream). */
  ingest(envelope: unknown): void;
  getState(): GenUIState;
  /** Fires on surface state changes, run start/end, and cancellations. */
  subscribe(listener: () => void): () => void;
  /**
   * Status to display. A surface the agent left `streaming` only looks busy while the chat is running;
   * afterwards it is `ready`, or `aborted` if the user stopped the run. Out-of-band surfaces keep their own status.
   */
  getSurfaceStatus(surfaceId: string): GenUISurface['status'] | undefined;
  /** Whether a `data-gen-ui` part anchors its surface. A replayed event in a later message does not. */
  isAnchor(eventId: string, envelope: object): boolean;
  /** Tell the controller whether the chat is running. */
  setLive(live: boolean): void;
  /** Mark message surfaces that are still streaming as interrupted (the user stopped the run). */
  markAborted(): void;
  getToolApproval(toolCallId: string): GenUIToolApproval | undefined;
  hasPendingResponse(toolCallId: string): boolean;
  /** Fires when approvals, approval status, or pending interactive responses change. */
  subscribeTools(listener: () => void): () => void;
  /** Resolve an interactive frontend tool with the user's answer. */
  respond(toolCallId: string, value: unknown): Promise<GenUIValidationResult<unknown>>;
  /** Validate a node's props against its component schema. `undefined` when the component is not registered. */
  validateNodeProps(node: GenUINode): GenUIValidationResult<unknown> | undefined;
  setServices(services: GenUIChatServices): void;
  threadScope(): GenUIStateScope;
  /** Drop surfaces, local state, published context and pending responses (thread switch). */
  reset(): void;
  /** Keep the controller alive. Disposal happens after the last release, so StrictMode remounts are safe. */
  retain(): () => void;
  dispose(): void;
}

const errorMessage = (error: unknown) => (error instanceof Error ? error.message : String(error));

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;

const OPERATION_HELP = [
  'createSurface {rootId?, placement?: "inline"|"panel"|"standalone"|"overlay", title?, data?, nodes?} — must be the first operation for a new surfaceId',
  'upsertNodes {nodes: [{id, component, props?, children?: [nodeId]}]} — insert or replace nodes',
  'updateProps {nodeId, set?, unset?: [key]} — shallow-merge props',
  'removeNodes {nodeIds} — removes nodes and their descendants',
  'setChildren {nodeId, children: [nodeId]} — reorder, insert, or delete children',
  'setRoot {rootId}',
  'replaceData {data} / patchData {set?, unset?}',
  'setStatus {status: "streaming"|"ready"|"suspended"|"failed"|"aborted", error?}',
  'deleteSurface {}',
].join('\n');

export function createGenUIController(options: GenUIControllerOptions): GenUIController {
  const { registry } = options;
  const limits = registry.limits;
  const resolvedLimits = resolveGenUILimits(limits);
  const session = createGenUISession({ limits });
  const state = createGenUIStateStore({ limits });
  const context = createGenUIContextStore();
  let services: GenUIChatServices | undefined;
  let disposed = false;
  let retainers = 0;

  const requireServices = () => {
    if (!services) throw new Error('GenUI chat services are not ready yet');
    return services;
  };

  // ---- run lifecycle and anchors ----------------------------------------------------------------
  const listeners = new Set<() => void>();
  const notify = () => listeners.forEach(listener => listener());
  let live = false;
  /** Surface id -> revision at which the user stopped the run. A later update clears it. */
  const aborted = new Map<string, number>();
  /** Event ids of envelopes that arrived out of band; their surfaces settle on their own. */
  const externalEvents = new Set<string>();
  /** Event id -> the first envelope object that carried it in the messages. */
  let anchors = new Map<string, object>();

  const isExternal = (surface: GenUISurface) =>
    surface.anchorEventId !== undefined && externalEvents.has(surface.anchorEventId);

  const effectiveStatus = (surface: GenUISurface): GenUISurface['status'] => {
    if (surface.status !== 'streaming' || isExternal(surface)) return surface.status;
    if (aborted.get(surface.id) === surface.revision) return 'aborted';
    return live ? 'streaming' : 'ready';
  };

  const updateAnchors = (messages: ReadonlyArray<MastraDBMessage>) => {
    const next = new Map<string, object>();
    for (const message of messages) {
      for (const part of message.content.parts) {
        if ((part.type as string) !== GENUI_DATA_PART_TYPE) continue;
        const data = (part as { data?: unknown }).data;
        if (isRecord(data) && typeof data.eventId === 'string' && !next.has(data.eventId)) {
          next.set(data.eventId, data);
        }
      }
    }
    const changed = next.size !== anchors.size || [...next].some(([id, data]) => anchors.get(id) !== data);
    anchors = next;
    if (changed) notify();
  };

  const handlers: Record<string, GenUIActionHandler<any>> = {};
  for (const [name, handler] of Object.entries(options.actions ?? {})) {
    handlers[name] = {
      ...handler,
      handle: (payload, actionContext) =>
        handler.handle(payload, { ...actionContext, chat: requireServices(), state, context }),
    };
  }
  const actions = createGenUIActionDispatcher({
    handlers,
    limits,
    getSurface: surfaceId => {
      const surface = session.getState().surfaces[surfaceId];
      if (!surface) return undefined;
      // Actions on a surface the user interrupted are stale, like any other aborted surface.
      const status = effectiveStatus(surface);
      return status === surface.status ? surface : { ...surface, status };
    },
  });

  // ---- tool approvals, suspensions, interactive responses -------------------------------------
  const toolListeners = new Set<() => void>();
  const notifyTools = () => toolListeners.forEach(listener => listener());
  let toolMeta = new Map<string, ToolCallMeta>();
  const approvalStatus = new Map<string, { status: 'pending' | 'error'; error?: string }>();
  const approvalCache = new Map<string, GenUIToolApproval>();
  const pending = new Map<
    string,
    { resolve: (value: unknown) => void; reject: (error: Error) => void; schema?: StandardSchemaV1 }
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
        inputSchema: tool.inputSchema as never,
        renderOnly: true,
      };
      continue;
    }
    clientTools[tool.name] = {
      id: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema as never,
      execute: async (input: unknown, executeContext: unknown) => {
        const validated = await validateSchema(entry.definition.schema, input);
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

  const surfaceToolEventId = (toolCallId: string) => `tool:${toolCallId}`;

  const toSurfaceToolEnvelope = (toolCallId: string, args: unknown): GenUIEnvelope | undefined => {
    if (!isRecord(args) || typeof args.surfaceId !== 'string' || !Array.isArray(args.operations)) return undefined;
    const operations = args.operations as GenUIOperation[];
    // A surface tool call is a complete batch: mark the surface ready unless the model set a status itself.
    const setsStatus = operations.some(op => isRecord(op) && op.op === 'setStatus');
    const deletes = operations.some(op => isRecord(op) && op.op === 'deleteSurface');
    return {
      version: GENUI_PROTOCOL_VERSION,
      eventId: surfaceToolEventId(toolCallId),
      surfaceId: args.surfaceId,
      operations: setsStatus || deletes ? operations : [...operations, { op: 'setStatus', status: 'ready' }],
    };
  };

  const describeOutcome = (result: GenUIState, envelope: GenUIEnvelope): string | undefined => {
    const diagnostic = [...result.diagnostics].reverse().find(d => d.eventId === envelope.eventId);
    if (diagnostic) return diagnostic.message;
    if (result.buffered[envelope.surfaceId]?.some(e => e.eventId === envelope.eventId)) {
      return `surface "${envelope.surfaceId}" does not exist yet; start with a createSurface operation`;
    }
    const surface = result.surfaces[envelope.surfaceId];
    if (!surface) return undefined;
    for (const node of Object.values(surface.nodes)) {
      const validation = validateNodeProps(node);
      if (!validation) return `unknown component "${node.component}" on node "${node.id}"`;
      if (!validation.ok) return `invalid props for node "${node.id}" (${node.component}): ${validation.error}`;
    }
    return undefined;
  };

  if (registry.surfaceTool) {
    const manifest = registry.manifest();
    const description = [
      'Render or update a user interface surface built only from the registered components below.',
      'Each call applies a batch of operations atomically. Reuse the same surfaceId to update a surface later.',
      `Operations:\n${OPERATION_HELP}`,
      `Components (props must match propsSchema):\n${JSON.stringify(manifest)}`,
      registry.surfaceTool.instructions,
    ]
      .filter(Boolean)
      .join('\n\n');
    clientTools[registry.surfaceTool.name] = {
      id: registry.surfaceTool.name,
      description,
      inputSchema: {
        type: 'object',
        properties: {
          surfaceId: { type: 'string', description: 'Stable id of the surface to create or update' },
          operations: {
            type: 'array',
            items: { type: 'object', properties: { op: { type: 'string' } }, required: ['op'] },
          },
        },
        required: ['surfaceId', 'operations'],
      } as never,
      execute: async (input: unknown, executeContext: unknown) => {
        const toolCallId = toolCallIdFrom(executeContext) ?? `call_${Date.now().toString(36)}`;
        const parsed = parseGenUIOperations(isRecord(input) ? input.operations : undefined, resolvedLimits);
        if (!parsed.ok) return { ok: false, error: parsed.error };
        const envelope = toSurfaceToolEnvelope(toolCallId, { ...(input as object), operations: parsed.value });
        if (!envelope) return { ok: false, error: 'surfaceId and operations are required' };
        const current = session.getState();
        // `sync` may already have applied this call from the streamed arguments; otherwise dry-run it.
        const result = current.seenEventIds[envelope.eventId]
          ? current
          : accumulateGenUI(current, envelope, { limits });
        const error = describeOutcome(result, envelope);
        return error ? { ok: false, error } : { ok: true, surfaceId: envelope.surfaceId };
      },
    };
  }

  // ---- message projection ----------------------------------------------------------------------
  const surfaceToolName = registry.surfaceTool?.name;
  const projected = new WeakMap<MastraDBMessage, MastraDBMessage>();

  /** Add a synthetic `data-gen-ui` part after each completed surface tool call so replay rebuilds it. */
  const project = (message: MastraDBMessage): MastraDBMessage => {
    if (!surfaceToolName) return message;
    const cached = projected.get(message);
    if (cached) return cached;
    let parts: unknown[] | undefined;
    message.content.parts.forEach((part, index) => {
      const type = part.type as string;
      if (type !== 'tool-invocation' && type !== 'dynamic-tool' && !type.startsWith('tool-')) {
        parts?.push(part);
        return;
      }
      const call = normalizeToolPart(part as never);
      // A call the tool rejected must not linger in state, or the model's retry would hit `surface-exists`.
      const rejected =
        call?.phase === 'output-error' ||
        (call?.phase === 'output-available' && isRecord(call.output) && call.output.ok === false);
      const envelope =
        call && call.toolName === surfaceToolName && call.phase !== 'input-streaming' && !rejected
          ? toSurfaceToolEnvelope(call.toolCallId, call.args)
          : undefined;
      if (envelope) {
        parts ??= message.content.parts.slice(0, index);
        parts.push(part, { type: GENUI_DATA_PART_TYPE, data: envelope });
      } else {
        parts?.push(part);
      }
    });
    const result = parts
      ? ({ ...message, content: { ...message.content, parts } } as unknown as MastraDBMessage)
      : message;
    projected.set(message, result);
    return result;
  };

  // ---- node validation -------------------------------------------------------------------------
  const nodeValidation = new WeakMap<GenUINode, GenUIValidationResult<unknown>>();
  const validateNodeProps = (node: GenUINode) => {
    const entry = registry.components[node.component];
    if (!entry || entry.definition.declarative === false) return undefined;
    let result = nodeValidation.get(node);
    if (!result) {
      result = validateSchemaSync(entry.definition.schema, node.props);
      nodeValidation.set(node, result);
    }
    return result;
  };

  const controller: GenUIController = {
    registry,
    session,
    state,
    context,
    actions,
    clientTools,
    sync(messages) {
      if (disposed) return;
      session.sync(surfaceToolName ? messages.map(project) : messages);
      updateAnchors(messages);
      updateToolMeta(messages);
    },
    ingest(envelope) {
      if (disposed) return;
      if (isRecord(envelope) && typeof envelope.eventId === 'string') externalEvents.add(envelope.eventId);
      session.ingest(envelope);
    },
    getState: () => session.getState(),
    subscribe(listener) {
      listeners.add(listener);
      const unsubscribe = session.subscribe(listener);
      return () => {
        listeners.delete(listener);
        unsubscribe();
      };
    },
    getSurfaceStatus(surfaceId) {
      const surface = session.getState().surfaces[surfaceId];
      return surface && effectiveStatus(surface);
    },
    isAnchor(eventId, envelope) {
      const first = anchors.get(eventId);
      // Not synced yet: the part is new in this render, so it is the first to carry its event.
      return first === undefined || first === envelope;
    },
    setLive(next) {
      if (live === next) return;
      live = next;
      notify();
    },
    markAborted() {
      const { surfaces } = session.getState();
      let changed = false;
      for (const surface of Object.values(surfaces)) {
        if (surface.status === 'streaming' && !isExternal(surface) && !aborted.has(surface.id)) {
          aborted.set(surface.id, surface.revision);
          changed = true;
        }
      }
      if (changed) notify();
    },
    getToolApproval,
    hasPendingResponse: toolCallId => pending.has(toolCallId),
    subscribeTools(listener) {
      toolListeners.add(listener);
      return () => toolListeners.delete(listener);
    },
    async respond(toolCallId, value) {
      const entry = pending.get(toolCallId);
      if (!entry) return { ok: false, error: 'This tool call is no longer waiting for a response' };
      let result: unknown = value;
      if (entry.schema) {
        const validated = await validateSchema(entry.schema, value);
        if (!validated.ok) return validated;
        result = validated.value;
      }
      // Re-check: another respond() may have won while validation was pending.
      if (pending.get(toolCallId) !== entry) return { ok: false, error: 'This tool call was already answered' };
      pending.delete(toolCallId);
      entry.resolve(result);
      notifyTools();
      return { ok: true, value: result };
    },
    validateNodeProps,
    setServices(next) {
      services = next;
    },
    threadScope: () => ({ kind: 'thread', id: services?.threadId ?? 'default' }),
    reset() {
      session.reset();
      aborted.clear();
      externalEvents.clear();
      anchors = new Map();
      state.clear();
      for (const key of Object.keys(context.snapshot())) context.unpublish(key);
      rejectPending('The conversation changed before the user responded');
      approvalStatus.clear();
      approvalCache.clear();
      toolMeta = new Map();
      notifyTools();
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
      actions.dispose();
      state.clear();
    },
  };
  return controller;
}
