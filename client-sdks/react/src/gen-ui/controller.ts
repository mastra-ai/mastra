import {
  GENUI_DATA_PART_TYPE,
  GENUI_PROTOCOL_VERSION,
  accumulateGenUI,
  createGenUIActionDispatcher,
  createGenUIContextStore,
  createGenUISession,
  createGenUIState,
  createGenUIStateStore,
  parseGenUIOperations,
  parsePartialJSON,
  resolveGenUILimits,
  validateModelInput,
  validateModelInputSync,
  validateSchema,
} from '@mastra/client-js/gen-ui';
import type {
  GenUIActionContext,
  GenUIActionDispatcher,
  GenUIActionHandler,
  GenUIContextStore,
  GenUIEnvelope,
  GenUINode,
  GenUIOperation,
  GenUIPlacement,
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
import type { GenUIManifestComponent, GenUIRegistry, GenUIToolApproval } from './registry';
import { collectToolCallMeta, normalizeToolPart } from './tool-parts';
import type { NormalizedToolCall, ToolCallMeta } from './tool-parts';

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
  /** Whether the chat is running. Surfaces left `streaming` only look busy while it is. */
  running?: boolean;
}

/** @experimental Generative UI is in beta and may change without notice. */
export interface GenUIChatActionContext extends GenUIActionContext {
  chat: GenUIChatServices;
  state: GenUIStateStore;
  context: GenUIContextStore;
}

/** @experimental Generative UI is in beta and may change without notice. */
export interface GenUIChatActionHandler<
  S extends StandardSchemaV1 | undefined = StandardSchemaV1 | undefined,
> extends Omit<GenUIActionHandler<S>, 'handle'> {
  handle(
    payload: S extends StandardSchemaV1 ? InferSchemaOutput<S> : JSONValue,
    context: GenUIChatActionContext,
  ): unknown | Promise<unknown>;
}

/**
 * Typed helper for action handlers registered on `useGenUIChat`.
 *
 * @experimental Generative UI is in beta and may change without notice.
 */
export function defineGenUIChatAction<S extends StandardSchemaV1 | undefined = undefined>(
  handler: GenUIChatActionHandler<S>,
): GenUIChatActionHandler<S> {
  return handler;
}

/** @experimental Generative UI is in beta and may change without notice. */
export interface GenUIControllerOptions {
  registry: GenUIRegistry;
  actions?: Record<string, GenUIChatActionHandler<any>>;
}

/** @experimental Generative UI is in beta and may change without notice. */
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
  /**
   * Bring surface and tool state in line with the chat: its messages (incremental while streaming), whether
   * it is running, and its thread. Switching threads drops the previous thread's surfaces, local state,
   * published context and pending responses.
   */
  sync(messages: ReadonlyArray<MastraDBMessage>, chat?: GenUIChatSyncState): void;
  /** Apply an envelope that did not arrive in a message (e.g. a workflow stream). */
  ingest(envelope: unknown): void;
  getState(): GenUIState;
  /** Ids of every surface with the given placement, in creation order. Same array while they do not change. */
  getSurfaceIds(placement?: GenUIPlacement): readonly string[];
  /** Fires on surface state changes, run start/end, and cancellations. */
  subscribe(listener: () => void): () => void;
  /**
   * Status to display. A surface the agent left `streaming` only looks busy while the chat is running;
   * afterwards it is `ready`, or `aborted` if the user stopped the run. Out-of-band surfaces keep their own status.
   */
  getSurfaceStatus(surfaceId: string): GenUISurface['status'] | undefined;
  /** Error to display with a `failed` surface: the agent's own, or the error of the tool that was building it. */
  getSurfaceError(surfaceId: string): string | undefined;
  /** Whether a `data-gen-ui` part anchors its surface. A replayed event in a later message does not. */
  isAnchor(eventId: string, envelope: object): boolean;
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
  /**
   * Display-only surface built from a surface tool call the model is still writing. Never enters
   * controller state; `undefined` until the arguments contain a `createSurface`.
   */
  previewSurface(call: NormalizedToolCall): GenUISurface | undefined;
  setServices(services: GenUIChatServices): void;
  /** Replace the action handlers. Names missing from `actions` stop being handled. */
  setActions(actions?: Record<string, GenUIChatActionHandler<any>>): void;
  threadScope(): GenUIStateScope;
  /** Keep the controller alive. Disposal happens after the last release, so StrictMode remounts are safe. */
  retain(): () => void;
  dispose(): void;
}

const errorMessage = (error: unknown) => (error instanceof Error ? error.message : String(error));

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;

/**
 * The result @mastra/core saves for a tool call cut off by a stopped run (`TOOL_ABORT_NOTICE`, not exported).
 * If core rewords it, stopped surfaces fall back to showing as ready after a reload.
 */
const CORE_TOOL_ABORT_NOTICE =
  'Tool execution was aborted while running. The tool may still be running and its effects are unknown. Check its status before retrying.';

const operationHelp = (placements: readonly GenUIPlacement[]) =>
  [
    `createSurface {rootId?, placement?: ${placements.map(p => `"${p}"`).join('|')}, title?} — must be the first operation for a new surfaceId; placement defaults to "inline"`,
    'upsertNodes {nodes: [{id, component, props, children?: [nodeId]}]} — insert or replace whole nodes',
    'removeNodes {nodeIds} — removes nodes and their descendants',
    'setChildren {nodeId, children: [nodeId]} — reorder, insert, or delete children',
    'setRoot {rootId}',
    'setStatus {status: "streaming"|"ready"|"suspended"|"failed"|"aborted", error?}',
    'deleteSurface {}',
  ].join('\n');

const stringList = { type: 'array', items: { type: 'string' } };

const operationSchema = (op: string, properties: Record<string, unknown> = {}, required: string[] = []) => ({
  type: 'object',
  properties: { op: { type: 'string', enum: [op] }, ...properties },
  required: ['op', ...required],
});

/**
 * Fully describe every operation and node so strict structured-output providers, which close every
 * object and drop undeclared keys, still let the model send node ids, components, and props.
 * Free-form operations (`updateProps`, data ops) can't be expressed that way and stay protocol-only.
 */
function surfaceToolInputSchema(manifest: GenUIManifestComponent[], placements: readonly GenUIPlacement[]) {
  const node = {
    anyOf: manifest.map(({ name, propsSchema }) => {
      const { $schema: _dialect, ...props } = propsSchema ?? { type: 'object' };
      return {
        type: 'object',
        properties: {
          id: { type: 'string' },
          component: { type: 'string', enum: [name] },
          props,
          children: { ...stringList, description: 'Ordered child node ids' },
        },
        required: ['id', 'component', 'props'],
      };
    }),
  };
  return {
    type: 'object',
    properties: {
      surfaceId: { type: 'string', description: 'Stable id of the surface to create or update' },
      operations: {
        type: 'array',
        items: {
          anyOf: [
            operationSchema('createSurface', {
              rootId: { type: 'string' },
              placement: { type: 'string', enum: [...placements] },
              title: { type: 'string' },
            }),
            operationSchema('upsertNodes', { nodes: { type: 'array', items: node } }, ['nodes']),
            operationSchema('removeNodes', { nodeIds: stringList }, ['nodeIds']),
            operationSchema('setChildren', { nodeId: { type: 'string' }, children: stringList }, [
              'nodeId',
              'children',
            ]),
            operationSchema('setRoot', { rootId: { type: 'string' } }, ['rootId']),
            operationSchema(
              'setStatus',
              {
                status: { type: 'string', enum: ['streaming', 'ready', 'suspended', 'failed', 'aborted'] },
                error: { type: 'string' },
              },
              ['status'],
            ),
            operationSchema('deleteSurface'),
          ],
        },
      },
    },
    required: ['surfaceId', 'operations'],
  };
}

const withoutNulls = (value: Record<string, unknown>) =>
  Object.fromEntries(Object.entries(value).filter(([, item]) => item !== null));

/**
 * Strict-mode models send `null` for optional fields they leave out. Drop those on operations and
 * nodes (`setRoot {rootId: null}` keeps its meaning); props keep theirs for schema validation.
 */
const dropOptionalNulls = (operations: unknown[]): unknown[] =>
  operations.map(operation => {
    if (!isRecord(operation) || operation.op === 'setRoot') return operation;
    const cleaned = withoutNulls(operation);
    if (Array.isArray(cleaned.nodes)) {
      cleaned.nodes = cleaned.nodes.map(node => (isRecord(node) ? withoutNulls(node) : node));
    }
    return cleaned;
  });

/**
 * Streamed arguments stop anywhere, so the last operation (or the last node of its `nodes`) may be
 * cut mid-value: a half-written component name or id. Leave it out until the next one starts.
 */
const withoutTrailingPartial = (operations: unknown[]): unknown[] => {
  const rest = operations.slice(0, -1);
  const last = operations.at(-1);
  if (!isRecord(last) || !Array.isArray(last.nodes) || last.nodes.length < 2) return rest;
  return [...rest, { ...last, nodes: last.nodes.slice(0, -1) }];
};

/** @experimental Generative UI is in beta and may change without notice. */
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
  let syncedThread: { id: string | undefined } | undefined;
  /** Placement filter -> last surface id list handed out, so unchanged lists keep their identity. */
  const surfaceIds = new Map<GenUIPlacement | undefined, readonly string[]>();
  /** Surface id -> revision at which the user stopped the run. A later update clears it. */
  const aborted = new Map<string, number>();
  /** Event ids of envelopes that arrived out of band; their surfaces settle on their own. */
  const externalEvents = new Set<string>();
  /** Event id -> the first envelope object that carried it in the messages. */
  let anchors = new Map<string, object>();

  const isExternal = (surface: GenUISurface) =>
    surface.anchorEventId !== undefined && externalEvents.has(surface.anchorEventId);

  /** Tool call ids whose tool threw, with the error. A surface such a tool was still building did not finish. */
  let failedToolCalls = new Map<string, string | undefined>();
  /**
   * Tool call ids whose tool never returned: the run was stopped, or the stream ended first. Calls waiting
   * for an approval or a resume are not cut off.
   */
  let cutOffToolCalls = new Set<string>();

  const effectiveStatus = (surface: GenUISurface): GenUISurface['status'] => {
    if (surface.status !== 'streaming' || isExternal(surface)) return surface.status;
    const toolCallId = surface.source?.toolCallId;
    if (toolCallId && failedToolCalls.has(toolCallId)) return 'failed';
    if (aborted.get(surface.id) === surface.revision) return 'aborted';
    if (live) return 'streaming';
    return toolCallId && cutOffToolCalls.has(toolCallId) ? 'aborted' : 'ready';
  };

  const updateAnchors = (messages: ReadonlyArray<MastraDBMessage>) => {
    const next = new Map<string, object>();
    for (const message of messages) {
      for (const part of message.content.parts) {
        const type: string = part.type;
        if (type !== GENUI_DATA_PART_TYPE || !('data' in part)) continue;
        const { data } = part;
        if (isRecord(data) && typeof data.eventId === 'string' && !next.has(data.eventId)) {
          next.set(data.eventId, data);
        }
      }
    }
    const changed = next.size !== anchors.size || [...next].some(([id, data]) => anchors.get(id) !== data);
    anchors = next;
    if (changed) notify();
  };

  const updateToolOutcomes = (messages: ReadonlyArray<MastraDBMessage>) => {
    const failed = new Map<string, string | undefined>();
    const cutOff = new Set<string>();
    for (const message of messages) {
      for (const part of message.content.parts) {
        const call = normalizeToolPart(part);
        if (!call) continue;
        if (call.phase === 'output-error') failed.set(call.toolCallId, call.errorText);
        const unanswered =
          (call.phase === 'input-streaming' || call.phase === 'input-available') && !toolMeta.has(call.toolCallId);
        if (unanswered || (call.phase === 'output-available' && call.output === CORE_TOOL_ABORT_NOTICE)) {
          cutOff.add(call.toolCallId);
        }
      }
    }
    const changed =
      failed.size !== failedToolCalls.size ||
      [...failed].some(([id, error]) => !failedToolCalls.has(id) || failedToolCalls.get(id) !== error) ||
      cutOff.size !== cutOffToolCalls.size ||
      [...cutOff].some(id => !cutOffToolCalls.has(id));
    failedToolCalls = failed;
    cutOffToolCalls = cutOff;
    if (changed) notify();
  };

  const actions = createGenUIActionDispatcher({
    limits,
    getSurface: surfaceId => {
      const surface = session.getState().surfaces[surfaceId];
      if (!surface) return undefined;
      // Actions on a surface the user interrupted are stale, like any other aborted surface.
      const status = effectiveStatus(surface);
      return status === surface.status ? surface : { ...surface, status };
    },
  });
  let releaseActions: Array<() => void> = [];
  const setActions = (next: Record<string, GenUIChatActionHandler<any>> = {}) => {
    releaseActions.forEach(release => release());
    releaseActions = Object.entries(next).map(([name, handler]) =>
      actions.register(name, {
        ...handler,
        handle: (payload, actionContext) =>
          handler.handle(payload, { ...actionContext, chat: requireServices(), state, context }),
      }),
    );
  };
  setActions(options.actions);

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
        inputSchema: tool.inputSchema,
        renderOnly: true,
      };
      continue;
    }
    clientTools[tool.name] = {
      id: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema as never,
      execute: async (input: unknown, executeContext: unknown) => {
        const validated = await validateModelInput(entry.definition.schema, input);
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
    const parsed = parseGenUIOperations(dropOptionalNulls(args.operations), resolvedLimits);
    if (!parsed.ok) return undefined;
    const operations: GenUIOperation[] = parsed.value;
    // A surface tool call is a complete batch: mark the surface ready unless the model set a status itself.
    const setsStatus = operations.some(op => op.op === 'setStatus');
    const deletes = operations.some(op => op.op === 'deleteSurface');
    return {
      version: GENUI_PROTOCOL_VERSION,
      eventId: surfaceToolEventId(toolCallId),
      surfaceId: args.surfaceId,
      operations: setsStatus || deletes ? operations : [...operations, { op: 'setStatus', status: 'ready' }],
    };
  };

  /** Completed surface tool calls the session has seen; tool call ids are unique, so this survives resets. */
  const syncedSurfaceCalls = new Set<string>();
  const previewSurface = (call: NormalizedToolCall): GenUISurface | undefined => {
    // A completed call is synced into the controller one commit after it renders; the preview bridges
    // that gap so the switch keeps every mounted component. Rejected calls never become surfaces.
    const rejected =
      call.phase === 'output-error' ||
      call.phase === 'output-denied' ||
      (call.phase === 'output-available' && isRecord(call.output) && call.output.ok === false);
    let input: { value: unknown; complete: boolean } | undefined;
    if (call.phase === 'input-streaming') {
      if (call.argsText !== undefined) input = parsePartialJSON(call.argsText);
    } else if (!rejected) {
      input = { value: call.args, complete: true };
    }
    if (!input || !isRecord(input.value)) return undefined;
    const { surfaceId, operations } = input.value;
    if (typeof surfaceId !== 'string' || !Array.isArray(operations)) return undefined;
    if (input.complete && syncedSurfaceCalls.has(call.toolCallId)) return undefined;
    const parsed = parseGenUIOperations(
      dropOptionalNulls(input.complete ? operations : withoutTrailingPartial(operations)),
      resolvedLimits,
    );
    if (!parsed.ok || parsed.value[0]?.op !== 'createSurface') return undefined;
    const envelope: GenUIEnvelope = {
      version: GENUI_PROTOCOL_VERSION,
      eventId: surfaceToolEventId(call.toolCallId),
      surfaceId,
      operations: parsed.value,
    };
    const surface = accumulateGenUI(createGenUIState(), envelope, { limits }).surfaces[surfaceId];
    if (!surface) return undefined;
    // `setRoot` usually comes last; show the first node as the root until it does.
    const firstNode = parsed.value.flatMap(op =>
      op.op === 'upsertNodes' || op.op === 'createSurface' ? (op.nodes ?? []) : [],
    )[0];
    return { ...surface, status: 'streaming', rootId: surface.rootId ?? firstNode?.id ?? null };
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
    const { placements } = registry.surfaceTool;
    const manifest = registry.manifest();
    const description = [
      'Render or update a user interface surface built only from the registered components below.',
      'Each call applies a batch of operations atomically. Reuse the same surfaceId to update a surface later.',
      `Operations:\n${operationHelp(placements)}`,
      // Prop schemas are already in the input schema; repeating them here would double the tokens.
      `Components (props must match the component's schema in the input schema):\n${manifest
        .map(({ name, description }) => (description ? `- ${name}: ${description}` : `- ${name}`))
        .join('\n')}`,
      registry.surfaceTool.instructions,
    ]
      .filter(Boolean)
      .join('\n\n');
    clientTools[registry.surfaceTool.name] = {
      id: registry.surfaceTool.name,
      description,
      inputSchema: surfaceToolInputSchema(manifest, placements),
      execute: async (input: unknown, executeContext: unknown) => {
        const toolCallId = toolCallIdFrom(executeContext) ?? `call_${Date.now().toString(36)}`;
        const operations =
          isRecord(input) && Array.isArray(input.operations) ? dropOptionalNulls(input.operations) : undefined;
        const parsed = parseGenUIOperations(operations, resolvedLimits);
        if (!parsed.ok) return { ok: false, error: parsed.error };
        // Anything outside the declared placements has no outlet and would be accepted but never shown.
        const misplaced = parsed.value.find(
          op => op.op === 'createSurface' && op.placement !== undefined && !placements.includes(op.placement),
        );
        if (misplaced?.op === 'createSurface') {
          return {
            ok: false,
            error: `placement "${misplaced.placement}" is not available in this app; use one of: ${placements.join(', ')}`,
          };
        }
        const envelope = toSurfaceToolEnvelope(toolCallId, {
          ...(isRecord(input) ? input : {}),
          operations: parsed.value,
        });
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
    let parts: MastraDBMessage['content']['parts'] | undefined;
    message.content.parts.forEach((part, index) => {
      const type: string = part.type;
      if (type !== 'tool-invocation' && type !== 'dynamic-tool' && !type.startsWith('tool-')) {
        parts?.push(part);
        return;
      }
      const call = normalizeToolPart(part);
      if (call?.toolName === surfaceToolName && call.phase !== 'input-streaming')
        syncedSurfaceCalls.add(call.toolCallId);
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
    const result: MastraDBMessage = parts ? { ...message, content: { ...message.content, parts } } : message;
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
      result = validateModelInputSync(entry.definition.schema, node.props);
      nodeValidation.set(node, result);
    }
    return result;
  };

  function reset() {
    session.reset();
    aborted.clear();
    externalEvents.clear();
    anchors = new Map();
    failedToolCalls = new Map();
    cutOffToolCalls = new Set();
    state.clear();
    rejectPending('The conversation changed before the user responded');
    approvalStatus.clear();
    approvalCache.clear();
    toolMeta = new Map();
    notifyTools();
  }

  const controller: GenUIController = {
    registry,
    session,
    state,
    context,
    actions,
    clientTools,
    sync(messages, chat = {}) {
      if (disposed) return;
      if (syncedThread && syncedThread.id !== chat.threadId) reset();
      syncedThread = { id: chat.threadId };
      session.sync(surfaceToolName ? messages.map(project) : messages);
      updateAnchors(messages);
      updateToolMeta(messages);
      updateToolOutcomes(messages);
      const running = chat.running ?? false;
      if (live !== running) {
        live = running;
        notify();
      }
    },
    ingest(envelope) {
      if (disposed) return;
      if (isRecord(envelope) && typeof envelope.eventId === 'string') externalEvents.add(envelope.eventId);
      session.ingest(envelope);
    },
    getState: () => session.getState(),
    getSurfaceIds(placement) {
      const state = session.getState();
      const ids = state.surfaceOrder.filter(id => !placement || state.surfaces[id]?.placement === placement);
      const previous = surfaceIds.get(placement);
      if (previous && previous.length === ids.length && previous.every((id, i) => id === ids[i])) return previous;
      surfaceIds.set(placement, ids);
      return ids;
    },
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
    getSurfaceError(surfaceId) {
      const surface = session.getState().surfaces[surfaceId];
      if (!surface) return undefined;
      if (surface.error) return surface.error;
      const toolCallId = surface.source?.toolCallId;
      return toolCallId && effectiveStatus(surface) === 'failed' ? failedToolCalls.get(toolCallId) : undefined;
    },
    isAnchor(eventId, envelope) {
      const first = anchors.get(eventId);
      // Not synced yet: the part is new in this render, so it is the first to carry its event.
      return first === undefined || first === envelope;
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
    previewSurface,
    setServices(next) {
      services = next;
    },
    setActions,
    threadScope: () => ({ kind: 'thread', id: services?.threadId ?? 'default' }),
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
