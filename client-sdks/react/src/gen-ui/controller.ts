import { resolveElementProps } from '@json-render/core';
import type { Catalog, InferActionParams, InferCatalogActions, StateModel, UIElement } from '@json-render/core';
import {
  GENUI_DATA_PART_TYPE,
  GENUI_PROTOCOL_VERSION,
  accumulateGenUI,
  createGenUIContextStore,
  createGenUISession,
  createGenUIState,
  parseGenUIOperations,
  parsePartialJSON,
  resolveGenUILimits,
} from '@mastra/client-js/gen-ui';
import type {
  GenUIContextStore,
  GenUIEnvelope,
  GenUIPlacement,
  GenUISession,
  GenUISpec,
  GenUIState,
  GenUISurface,
} from '@mastra/client-js/gen-ui';
import type { MastraDBMessage } from '@mastra/core/agent/message-list';
import type { z } from 'zod/v4';
import type { SendMessageArgs } from '../agent/hooks';
import type { ClientToolsInput } from '../agent/types';
import type { GenUIComponentEntry, GenUIRegistry, GenUIToolApproval } from './registry';
import { createGenUIEditsStore } from './surface-store';
import type { GenUIEditsStore, GenUISurfaceStore } from './surface-store';
import { collectToolCallMeta, normalizeToolPart } from './tool-parts';
import type { NormalizedToolCall, ToolCallMeta } from './tool-parts';
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
  /** Whether the chat is running. Surfaces left `streaming` only look busy while it is. */
  running?: boolean;
}

/** @experimental Generative UI is in beta and may change without notice. */
export interface GenUIActionContext {
  /** Surface whose element raised the action. */
  surfaceId: string;
  chat: GenUIChatServices;
  /** Values published for the agent with the next message. */
  context: GenUIContextStore;
  /** Surface state as the user sees it: the agent's state with local edits on top. */
  state: StateModel;
  /** Write surface state at a JSON pointer, like a `setState` action. Recorded as a local edit. */
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

/** @experimental Generative UI is in beta and may change without notice. */
export interface GenUIController {
  readonly registry: GenUIRegistry;
  readonly session: GenUISession;
  /** The user's edits to each surface's state. Never sent anywhere unless you pass them explicitly. */
  readonly edits: GenUIEditsStore;
  /** Values published for the agent. Sent with the next message as additional system context. */
  readonly context: GenUIContextStore;
  /** Frontend tools derived from the registry. Merge into the chat's client tools. */
  readonly clientTools: ClientToolsInput;
  /**
   * Bring surface and tool state in line with the chat: its messages (incremental while streaming), whether
   * it is running, and its thread. Switching threads drops the previous thread's surfaces, local edits,
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
  respond(toolCallId: string, value: unknown): GenUIValidationResult<unknown>;
  /**
   * Validate resolved props against a catalog component's schema. `undefined` when the component is not in
   * the catalog. Results are cached per props object.
   */
  validateProps(type: string, props: unknown): GenUIValidationResult<unknown> | undefined;
  /** json-render action handlers for one surface: one per catalog action, run through `setActions` handlers. */
  actionHandlers(
    surfaceId: string,
    store: GenUISurfaceStore,
  ): Record<string, (params: Record<string, unknown>) => Promise<void>>;
  /**
   * Display-only surface built from a surface tool call the model is still writing. Never enters
   * controller state; `undefined` until the arguments contain a `createSurface`.
   */
  previewSurface(call: NormalizedToolCall): GenUISurface | undefined;
  setServices(services: GenUIChatServices): void;
  /** Replace the action handlers. Catalog actions without a handler are ignored with a warning. */
  setActions(actions?: GenUIActionHandlers): void;
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

const stringList = { type: 'array', items: { type: 'string' } };

const stateRef = (key: '$state' | '$bindState') => ({
  type: 'object',
  properties: { [key]: { type: 'string', description: 'JSON pointer into surface state' } },
  required: [key],
});

/** Let every top-level prop take a state binding instead of a literal, which closed (strict) schemas otherwise forbid. */
function withStateBindings(props: Record<string, unknown>): Record<string, unknown> {
  if (!isRecord(props.properties)) return props;
  return {
    ...props,
    properties: Object.fromEntries(
      Object.entries(props.properties).map(([name, schema]) => [
        name,
        { anyOf: [schema, stateRef('$state'), stateRef('$bindState')] },
      ]),
    ),
  };
}

/**
 * Model-facing input of the surface tool: one complete json-render spec per call. Strict structured-output
 * providers close every object, so anything keyed by the model is reshaped: `elements` and `on` are lists,
 * and the free-form `state` and action `params` are JSON-encoded strings. The parser also accepts the plain
 * json-render forms that non-strict models send.
 */
function surfaceToolInputSchema(components: GenUIComponentEntry[], placements: readonly GenUIPlacement[]) {
  const element = {
    anyOf: components.map(({ name, propsSchema, events }) => {
      const props = propsSchema;
      return {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Unique id of the element within the surface' },
          type: { type: 'string', enum: [name] },
          props: withStateBindings(props),
          children: { ...stringList, description: 'Ordered child element ids' },
          ...(events.length
            ? {
                on: {
                  type: 'array',
                  description: 'Actions to run when the component raises an event',
                  items: {
                    type: 'object',
                    properties: {
                      event: { type: 'string', enum: [...events] },
                      action: { type: 'string' },
                      params: {
                        type: 'string',
                        description: 'Action params as a JSON object string, e.g. "{\\"prompt\\": \\"…\\"}"',
                      },
                    },
                    required: ['event', 'action'],
                  },
                },
              }
            : {}),
        },
        required: ['id', 'type', 'props'],
      };
    }),
  };
  return {
    type: 'object',
    properties: {
      surfaceId: {
        type: 'string',
        description: 'Id of a surface you rendered earlier, to replace it. Omit to render a new surface.',
      },
      title: { type: 'string' },
      placement: { type: 'string', enum: [...placements] },
      root: { type: 'string', description: 'Id of the top-level element' },
      elements: { type: 'array', items: element },
      state: {
        type: 'string',
        description:
          'Initial surface state as a JSON object string, read by props with {"$state": "/path"} or {"$bindState": "/path"}',
      },
    },
    required: ['root', 'elements'],
  };
}

const withoutNulls = (value: Record<string, unknown>) =>
  Object.fromEntries(Object.entries(value).filter(([, item]) => item !== null));

/** A JSON object given as-is or as a JSON string (strict-mode form); anything else reads as `undefined`. */
function readObject(value: unknown): Record<string, unknown> | undefined {
  if (typeof value === 'string') {
    try {
      value = JSON.parse(value);
    } catch {
      return undefined;
    }
  }
  return isRecord(value) && !Array.isArray(value) ? value : undefined;
}

type ActionBinding = { action: string; params?: Record<string, unknown> };

/** Event bindings given as json-render's `{event: binding}` map or as the strict-mode `[{event, action, params}]` list. */
function readOn(on: unknown): UIElement['on'] | undefined {
  const bindings: Record<string, ActionBinding[]> = {};
  const add = (event: unknown, binding: unknown) => {
    if (typeof event !== 'string' || !isRecord(binding)) return;
    const { action, params } = withoutNulls(binding);
    if (typeof action !== 'string') return;
    const parsed = readObject(params);
    (bindings[event] ??= []).push(parsed ? { action, params: parsed } : { action });
  };
  if (Array.isArray(on)) {
    for (const entry of on) if (isRecord(entry)) add(entry.event, entry);
  } else if (isRecord(on)) {
    for (const [event, value] of Object.entries(on)) {
      for (const binding of Array.isArray(value) ? value : [value]) add(event, binding);
    }
  }
  const events = Object.entries(bindings);
  if (!events.length) return undefined;
  return Object.fromEntries(
    events.map(([event, list]) => [event, list.length === 1 ? list[0]! : list]),
  ) as UIElement['on'];
}

interface SurfaceToolCall {
  surfaceId: string;
  title?: string;
  placement?: string;
  spec: GenUISpec;
}

/**
 * Read surface tool arguments into a spec. Strict-mode models send `null` for optional fields they leave
 * out, so those are dropped (props keep theirs for schema validation). Streamed arguments stop anywhere:
 * while `complete` is false the last element may be cut mid-value, so it waits until the next one starts.
 */
function readSurfaceToolCall(
  toolCallId: string,
  args: unknown,
  complete: boolean,
): { ok: true; value: SurfaceToolCall } | { ok: false; error: string } {
  if (!isRecord(args)) return { ok: false, error: 'arguments must be an object' };
  const input = withoutNulls(args);
  if (input.surfaceId !== undefined && typeof input.surfaceId !== 'string') {
    return { ok: false, error: 'surfaceId must be a string' };
  }
  if (!Array.isArray(input.elements)) return { ok: false, error: 'elements must be a list' };
  const items = complete ? input.elements : input.elements.slice(0, -1);
  const elements: Record<string, UIElement> = {};
  for (const item of items) {
    if (!isRecord(item)) return { ok: false, error: 'every element must be an object' };
    const { id, type, props, children, on } = withoutNulls(item);
    if (typeof id !== 'string' || typeof type !== 'string') {
      return { ok: false, error: 'every element needs a string id and type' };
    }
    if (complete && elements[id]) return { ok: false, error: `element id "${id}" is used twice` };
    const element: UIElement = { type, props: isRecord(props) ? props : {} };
    if (Array.isArray(children)) element.children = children.filter(child => typeof child === 'string');
    const bindings = readOn(on);
    if (bindings) element.on = bindings;
    elements[id] = element;
  }
  const root = typeof input.root === 'string' ? input.root : complete ? undefined : Object.keys(elements)[0];
  if (root === undefined) return { ok: false, error: 'root is required' };
  const spec: GenUISpec = { root, elements };
  if (input.state !== undefined) {
    const state = readObject(input.state);
    if (state) spec.state = state;
    else if (complete) return { ok: false, error: 'state must be a JSON object' };
  }
  const call: SurfaceToolCall = { surfaceId: input.surfaceId ?? `surface-${toolCallId}`, spec };
  if (typeof input.title === 'string') call.title = input.title;
  if (typeof input.placement === 'string') call.placement = input.placement;
  return { ok: true, value: call };
}

/** Elements rendered once per repeated item; their props read `$item`, so they can't be checked up front. */
function repeatedElements(spec: GenUISpec): Set<string> {
  const repeated = new Set<string>();
  const visit = (id: string) => {
    for (const child of spec.elements[id]?.children ?? []) {
      if (repeated.has(child)) continue;
      repeated.add(child);
      visit(child);
    }
  };
  for (const [id, element] of Object.entries(spec.elements)) if (element.repeat) visit(id);
  return repeated;
}

/** @experimental Generative UI is in beta and may change without notice. */
export function createGenUIController(options: GenUIControllerOptions): GenUIController {
  const { registry } = options;
  const limits = registry.limits;
  const resolvedLimits = resolveGenUILimits(limits);
  const session = createGenUISession({ limits });
  const edits = createGenUIEditsStore(resolvedLimits);
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

  // ---- actions ---------------------------------------------------------------------------------
  let handlers: GenUIActionHandlers = options.actions ?? {};
  const setActions = (next: GenUIActionHandlers = {}) => {
    handlers = next;
  };
  /** `surfaceId:action` pairs in flight, so a double click does not run an action twice. */
  const runningActions = new Set<string>();

  const actionHandlers = (surfaceId: string, store: GenUISurfaceStore) =>
    Object.fromEntries(
      Object.values(registry.actions).map(({ name, params: schema }) => [
        name,
        async (raw: Record<string, unknown>) => {
          const surface = session.getState().surfaces[surfaceId];
          const status = surface && effectiveStatus(surface);
          // The model's view of an interrupted or failed surface is out of date; acting on it would mislead.
          if (!surface || status === 'aborted' || status === 'failed') {
            console.warn(`[GenUI] Ignored action "${name}": surface "${surfaceId}" is ${status ?? 'gone'}`);
            return;
          }
          const handler = handlers[name];
          if (!handler) {
            console.warn(`[GenUI] No handler for action "${name}"`);
            return;
          }
          const key = `${surfaceId}:${name}`;
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
              surfaceId,
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

  const surfaceToolEventId = (toolCallId: string) => `tool:${toolCallId}`;

  const toSurfaceToolEnvelope = (toolCallId: string, args: unknown): GenUIEnvelope | undefined => {
    const call = readSurfaceToolCall(toolCallId, args, true);
    if (!call.ok) return undefined;
    const { surfaceId, spec, title, placement } = call.value;
    // Every call carries the whole spec: reusing a surface id rebuilds that surface in place, so
    // replaying the calls in message order always lands on the same result.
    const parsed = parseGenUIOperations(
      [
        { op: 'createSurface', replace: true, spec, ...(title ? { title } : {}), ...(placement ? { placement } : {}) },
        { op: 'setStatus', status: 'ready' },
      ],
      resolvedLimits,
    );
    if (!parsed.ok) return undefined;
    return {
      version: GENUI_PROTOCOL_VERSION,
      eventId: surfaceToolEventId(toolCallId),
      surfaceId,
      operations: parsed.value,
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
    if (!input) return undefined;
    if (input.complete && syncedSurfaceCalls.has(call.toolCallId)) return undefined;
    const read = readSurfaceToolCall(call.toolCallId, input.value, input.complete);
    if (!read.ok) return undefined;
    const { surfaceId, spec, title, placement } = read.value;
    const parsed = parseGenUIOperations(
      [{ op: 'createSurface', spec, ...(title ? { title } : {}), ...(placement ? { placement } : {}) }],
      resolvedLimits,
    );
    if (!parsed.ok) return undefined;
    const envelope: GenUIEnvelope = {
      version: GENUI_PROTOCOL_VERSION,
      eventId: surfaceToolEventId(call.toolCallId),
      surfaceId,
      operations: parsed.value,
    };
    return accumulateGenUI(createGenUIState(), envelope, { limits }).surfaces[surfaceId];
  };

  const describeOutcome = (result: GenUIState, envelope: GenUIEnvelope): string | undefined => {
    const diagnostic = [...result.diagnostics].reverse().find(d => d.eventId === envelope.eventId);
    if (diagnostic) return diagnostic.message;
    const surface = result.surfaces[envelope.surfaceId];
    if (!surface) return undefined;
    const { spec } = surface;
    if (!spec.elements[spec.root]) return `root "${spec.root}" is not one of the elements`;
    const repeated = repeatedElements(spec);
    const stateModel = spec.state ?? {};
    for (const [id, element] of Object.entries(spec.elements)) {
      const missing = element.children?.find(child => !spec.elements[child]);
      if (missing) return `element "${id}" lists child "${missing}", which is not one of the elements`;
      if (repeated.has(id)) continue;
      const validation = declarativeProps(element.type, resolveElementProps(element.props, { stateModel }));
      if (!validation) return `unknown component "${element.type}" on element "${id}"`;
      if (!validation.ok) return `invalid props for element "${id}" (${element.type}): ${validation.error}`;
    }
    return undefined;
  };

  if (registry.surfaceTool) {
    const { placements } = registry.surfaceTool;
    const declarative = Object.values(registry.components).filter(entry => entry.declarative);
    const actionNames = Object.keys(registry.actions);
    const description = [
      'Render a user interface built only from the registered components below, as a json-render spec:',
      '`root` is the id of the top element and `elements` lists every element as {id, type, props, children?}.',
      'Each call renders the whole surface. To change a surface later, call again with its surfaceId and the complete new spec.',
      'Props can read surface state with {"$state": "/path"}; inputs bind two-way with {"$bindState": "/path"}. Put initial values in `state`, as a JSON object string.',
      `Elements react to component events through \`on\`, a list like [{"event": "press", "action": "setState", "params": "{\\"statePath\\": \\"/open\\", \\"value\\": true}"}]. Built-in actions: setState, pushState, removeState${
        actionNames.length ? `. App actions: ${actionNames.join(', ')}` : ''
      }.`,
      `Placements: ${placements.join(', ')} (default "inline").`,
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
      registry.surfaceTool.instructions,
    ]
      .filter(Boolean)
      .join('\n\n');
    clientTools[registry.surfaceTool.name] = {
      id: registry.surfaceTool.name,
      description,
      inputSchema: surfaceToolInputSchema(declarative, placements),
      execute: async (input: unknown, executeContext: unknown) => {
        const toolCallId = toolCallIdFrom(executeContext) ?? `call_${Date.now().toString(36)}`;
        const call = readSurfaceToolCall(toolCallId, input, true);
        if (!call.ok) return { ok: false, error: call.error };
        // Anything outside the declared placements has no outlet and would be accepted but never shown.
        const { placement } = call.value;
        if (placement !== undefined && !placements.includes(placement as GenUIPlacement)) {
          return {
            ok: false,
            error: `placement "${placement}" is not available in this app; use one of: ${placements.join(', ')}`,
          };
        }
        const envelope = toSurfaceToolEnvelope(toolCallId, input);
        if (!envelope) {
          const parsed = parseGenUIOperations([{ op: 'createSurface', spec: call.value.spec }], resolvedLimits);
          return { ok: false, error: parsed.ok ? `invalid surface id "${call.value.surfaceId}"` : parsed.error };
        }
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

  // ---- element validation ----------------------------------------------------------------------
  const propsValidation = new WeakMap<object, GenUIValidationResult<unknown>>();
  const validateProps = (type: string, props: unknown) => {
    const entry = registry.components[type];
    if (!entry) return undefined;
    if (typeof props !== 'object' || props === null) return validateModelInput(entry.props, props);
    let result = propsValidation.get(props);
    if (!result) {
      result = validateModelInput(entry.props, props);
      propsValidation.set(props, result);
    }
    return result;
  };
  const declarativeProps = (type: string, props: Record<string, unknown>) =>
    registry.components[type]?.declarative ? validateProps(type, props) : undefined;

  function reset() {
    session.reset();
    aborted.clear();
    externalEvents.clear();
    anchors = new Map();
    failedToolCalls = new Map();
    cutOffToolCalls = new Set();
    edits.clear();
    runningActions.clear();
    rejectPending('The conversation changed before the user responded');
    approvalStatus.clear();
    approvalCache.clear();
    toolMeta = new Map();
    notifyTools();
  }

  const controller: GenUIController = {
    registry,
    session,
    edits,
    context,
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
    actionHandlers,
    previewSurface,
    setServices(next) {
      services = next;
    },
    setActions,
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
      edits.clear();
    },
  };
  return controller;
}
