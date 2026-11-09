import { applySpecPatch, nestedToFlat, SPEC_DATA_PART_TYPE } from '@json-render/core';
import type { Spec, StateModel } from '@json-render/core';
import type { MastraDBMessage } from '@mastra/core/agent/message-list';
import type { GenUISpecToolConfig } from './definition';
import { findSpecCycle, readSpecToolArgs } from './spec';
import { applySpecEdit, readSpecEditArgs } from './spec-edit';
import type { SpecEdit } from './spec-edit';
import { normalizeToolPart, partialArgsOf } from './tool-parts';
import type { NormalizedToolCall } from './tool-parts';

/** @experimental Generative UI is in beta and may change without notice. */
export interface SpecRead {
  spec?: Spec;
  error?: string;
}

/** @experimental Generative UI is in beta and may change without notice. */
export interface DataSpecRead extends SpecRead {
  /** Whether the message is the latest assistant message, so its spec may still grow. */
  live: boolean;
}

/** @experimental Generative UI is in beta and may change without notice. */
export interface EditBaseRead extends SpecRead {
  /** The spec call the edit applies to. */
  target?: string;
}

/** A json-render `data-spec` message part. */
interface SpecDataPart {
  type: string;
  data?: unknown;
}

/** @experimental Generative UI is in beta and may change without notice. */
export interface CreateSpecResolverOptions {
  /** The spec tool and its edit tool, as a definition configures them. Without it only `data-spec` parts resolve. */
  specTool?: GenUISpecToolConfig;
  /**
   * The state a rendered spec holds now, so an edit starts from what the user set. Without it an edit starts
   * from the target spec's own `state`.
   */
  stateOf?: (toolCallId: string) => StateModel | undefined;
}

/**
 * Resolves the specs a conversation carries: spec tool calls, edit calls applied to their targets, and
 * json-render `data-spec` message parts. Renderer-free, so a server or a bot can post the same spec a browser
 * renders.
 *
 * @experimental Generative UI is in beta and may change without notice.
 */
export interface GenUISpecResolver {
  /** Reads the spec and edit calls and `data-spec` parts of a conversation; returns whether any spec changed. */
  update(messages: ReadonlyArray<MastraDBMessage>): boolean;
  /** The spec a spec or edit call builds. Takes the call itself, so a call still streaming resolves as it is. */
  readCall(call: NormalizedToolCall): SpecRead;
  /** The spec a call from the last `update` builds. */
  specForCall(toolCallId: string): SpecRead | undefined;
  /** The spec a message's `data-spec` parts build so far. */
  readDataSpec(messageId: string): DataSpecRead;
  /** The message whose spec a part renders: set on the first `data-spec` part of each message. */
  dataSpecOf(part: object): string | undefined;
  /** The spec an edit applies to, with the state the target held when the edit was first resolved. */
  readEditBase(toolCallId: string, edit: SpecEdit): EditBaseRead;
  /** Forgets captured edit states and cached reads, as when the conversation changes. */
  reset(): void;
}

/** What one read of a spec or edit call touched: the calls it passed through and the interface it edits. */
interface ReadPass {
  seen: Set<string>;
  /** Whether an edit chain looped back to a call already on the way. */
  cyclic: boolean;
  dependency?: { target: string; read: SpecRead };
}

interface CachedRead {
  phase: NormalizedToolCall['phase'];
  args: unknown;
  argsText: string | undefined;
  output: unknown;
  implicitTarget: string | undefined;
  dependency: { target: string; read: SpecRead } | undefined;
  read: SpecRead;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

function isSpecDataPayload(
  data: unknown,
): data is { type: 'patch'; patch: object } | { type: 'flat' | 'nested'; spec: object } {
  if (!isRecord(data)) return false;
  switch (data.type) {
    case 'patch':
      return typeof data.patch === 'object' && data.patch !== null;
    case 'flat':
    case 'nested':
      return typeof data.spec === 'object' && data.spec !== null;
    default:
      return false;
  }
}

/**
 * Folds json-render `data-spec` parts into one spec, as json-render's React `buildSpecFromParts` does. It
 * mutates what it folds, so pass copies of parts you keep. `null` when no part carries a spec.
 */
function buildSpecFromDataParts(parts: ReadonlyArray<SpecDataPart>): Spec | null {
  const spec: Spec = { root: '', elements: {} };
  let hasSpec = false;
  for (const part of parts) {
    if (part.type !== SPEC_DATA_PART_TYPE || !isSpecDataPayload(part.data)) continue;
    const payload = part.data;
    hasSpec = true;
    if (payload.type === 'patch') applySpecPatch(spec, payload.patch as Parameters<typeof applySpecPatch>[1]);
    else if (payload.type === 'flat') Object.assign(spec, payload.spec);
    else Object.assign(spec, nestedToFlat(payload.spec as Parameters<typeof nestedToFlat>[0]));
  }
  return hasSpec ? spec : null;
}

/** @experimental Generative UI is in beta and may change without notice. */
export function createSpecResolver(options: CreateSpecResolverOptions = {}): GenUISpecResolver {
  const specToolName = options.specTool?.name;
  const edit = options.specTool?.edit;
  let specCalls = new Map<string, NormalizedToolCall>();
  /** Spec and edit call ids in conversation order; an edit naming no target edits the latest before it. */
  let specOrder: string[] = [];
  /** The state each edit starts from, captured once so later changes to the target do not leak into it. */
  const editBases = new Map<string, { target: string; state: StateModel }>();

  /** `data-spec` parts by the assistant message that carries them; one spec per message. */
  let dataSpecParts = new Map<string, SpecDataPart[]>();
  let dataSpecOwners = new WeakMap<object, string>();
  let latestAssistant: string | undefined;
  const dataSpecReads = new Map<string, { count: number; read: DataSpecRead }>();
  /**
   * The last read of each spec and edit call, with what it was built from. A read is reused while the call's
   * phase, arguments and result are the same objects and, for an edit, its target and the target's read are
   * the same, so a conversation streaming elsewhere does not re-parse every spec or replay every edit chain.
   */
  const callReads = new Map<string, CachedRead>();

  const update = (messages: ReadonlyArray<MastraDBMessage>) => {
    const parts = new Map<string, SpecDataPart[]>();
    const owners = new WeakMap<object, string>();
    let latest: string | undefined;
    for (const message of messages) {
      if (message.role !== 'assistant') continue;
      latest = message.id;
      for (const part of message.content.parts ?? []) {
        if (part.type !== SPEC_DATA_PART_TYPE) continue;
        const own = parts.get(message.id);
        if (own) own.push(part as SpecDataPart);
        else {
          parts.set(message.id, [part as SpecDataPart]);
          owners.set(part, message.id);
        }
      }
    }
    const dataChanged =
      latest !== latestAssistant ||
      parts.size !== dataSpecParts.size ||
      [...parts].some(
        ([id, own]) => own.length !== dataSpecParts.get(id)?.length || own[0] !== dataSpecParts.get(id)?.[0],
      );
    dataSpecParts = parts;
    dataSpecOwners = owners;
    latestAssistant = latest;
    if (!specToolName) return dataChanged;
    const next = new Map<string, NormalizedToolCall>();
    const order: string[] = [];
    for (const message of messages) {
      if (message.role !== 'assistant') continue;
      for (const part of message.content.parts ?? []) {
        const call = normalizeToolPart(part);
        if (!call || (call.toolName !== specToolName && call.toolName !== edit?.name)) continue;
        next.set(call.toolCallId, call);
        order.push(call.toolCallId);
      }
    }
    const callsChanged =
      order.length !== specOrder.length ||
      order.some((id, index) => {
        const previous = specCalls.get(id);
        const call = next.get(id)!;
        return (
          id !== specOrder[index] ||
          previous?.phase !== call.phase ||
          (previous.output === undefined) !== (call.output === undefined)
        );
      });
    specCalls = next;
    specOrder = order;
    return dataChanged || callsChanged;
  };

  const resultOf = (call: NormalizedToolCall) => (isRecord(call.output) ? call.output : undefined);

  const readSpecArgs = (call: NormalizedToolCall): SpecRead => {
    const args = partialArgsOf(call);
    if (!args) return {};
    const read = readSpecToolArgs(args, call.phase !== 'input-streaming');
    if (!read.ok) return { error: read.error };
    const cycle = findSpecCycle(read.spec);
    return cycle ? { error: cycle } : { spec: read.spec };
  };

  /** json-render folds parts by mutating what it is given, so this folds copies and the stored parts stay as they arrived. */
  const readDataSpec = (messageId: string): DataSpecRead => {
    const parts = dataSpecParts.get(messageId);
    if (!parts) return { live: false };
    const live = messageId === latestAssistant;
    const cached = dataSpecReads.get(messageId);
    if (cached?.count === parts.length && cached.read.live === live) return cached.read;
    let read: DataSpecRead;
    try {
      const spec = buildSpecFromDataParts(parts.map(part => ({ type: part.type, data: structuredClone(part.data) })));
      const cycle = spec && findSpecCycle(spec);
      read = cycle ? { live, error: cycle } : { live, ...(spec ? { spec } : {}) };
    } catch (error) {
      read = { live, error: error instanceof Error ? error.message : String(error) };
    }
    dataSpecReads.set(messageId, { count: parts.length, read });
    return read;
  };

  /** The spec an edit applies to: its target's, with the state the user had set in the target. */
  const editBase = (
    toolCallId: string,
    request: SpecEdit,
    stored: Record<string, unknown> | undefined,
    pass: ReadPass,
  ): EditBaseRead => {
    let target = typeof stored?.target === 'string' ? stored.target : request.target;
    if (!target) {
      const at = specOrder.indexOf(toolCallId);
      target = (at === -1 ? specOrder : specOrder.slice(0, at)).at(-1);
    }
    if (!target) return { error: 'there is no interface to edit' };
    const call = specCalls.get(target);
    if (!call) return { error: `there is no interface "${target}" to edit` };
    if (pass.seen.has(target)) {
      pass.cyclic = true;
      return { error: `there is no interface "${target}" to edit` };
    }
    if (resultOf(call)?.ok === false)
      return { error: `interface "${target}" could not be displayed, so it cannot be edited` };
    const inner: ReadPass = { seen: new Set(pass.seen).add(target), cyclic: false };
    const resolved = cachedRead(call, inner);
    pass.cyclic ||= inner.cyclic;
    pass.dependency = { target, read: resolved };
    if (!resolved.spec) return resolved.error ? { error: resolved.error } : { target };
    let state: StateModel;
    if (isRecord(stored?.baseState)) state = stored.baseState;
    else {
      const cached = editBases.get(toolCallId);
      if (cached?.target === target) state = cached.state;
      else {
        state = structuredClone(options.stateOf?.(target) ?? resolved.spec.state ?? {});
        editBases.set(toolCallId, { target, state });
      }
    }
    return { spec: { ...resolved.spec, state }, target };
  };

  const resolveSpecCall = (call: NormalizedToolCall, pass: ReadPass): SpecRead => {
    if (call.toolName !== edit?.name) return readSpecArgs(call);
    const args = partialArgsOf(call);
    if (!args) return {};
    const complete = call.phase !== 'input-streaming';
    const read = readSpecEditArgs(args, complete, edit.modes);
    if (!read.ok) return { error: read.error };
    const base = editBase(call.toolCallId, read.edit, resultOf(call), pass);
    if (!base.spec) return base.error ? { error: base.error } : {};
    if (!complete && !read.edit.patch?.length) return { spec: base.spec };
    const applied = applySpecEdit(base.spec, read.edit);
    if (!applied.ok) return { error: applied.error };
    const cycle = findSpecCycle(applied.spec);
    return cycle ? { error: cycle } : { spec: applied.spec };
  };

  /** The target an edit naming none falls back to: the latest spec or edit call before it. */
  const implicitTarget = (toolCallId: string) => {
    const at = specOrder.indexOf(toolCallId);
    return (at === -1 ? specOrder : specOrder.slice(0, at)).at(-1);
  };

  const isFresh = (cached: CachedRead, call: NormalizedToolCall, pass: ReadPass): boolean => {
    if (
      cached.phase !== call.phase ||
      cached.args !== call.args ||
      cached.argsText !== call.argsText ||
      cached.output !== call.output
    )
      return false;
    if (call.toolName !== edit?.name) return true;
    if (cached.implicitTarget !== implicitTarget(call.toolCallId)) return false;
    if (!cached.dependency) return true;
    const target = specCalls.get(cached.dependency.target);
    if (!target || pass.seen.has(cached.dependency.target)) return false;
    const inner: ReadPass = { seen: new Set(pass.seen).add(cached.dependency.target), cyclic: false };
    return cachedRead(target, inner) === cached.dependency.read && !inner.cyclic;
  };

  const cachedRead = (call: NormalizedToolCall, pass: ReadPass): SpecRead => {
    const cached = callReads.get(call.toolCallId);
    if (cached && isFresh(cached, call, pass)) return cached.read;
    const own: ReadPass = { seen: pass.seen, cyclic: false };
    const read = resolveSpecCall(call, own);
    pass.cyclic ||= own.cyclic;
    // A read cut short by an edit chain looping back depends on where the chain was entered, so it is not kept.
    if (own.cyclic) callReads.delete(call.toolCallId);
    else
      callReads.set(call.toolCallId, {
        phase: call.phase,
        args: call.args,
        argsText: call.argsText,
        output: call.output,
        implicitTarget: call.toolName === edit?.name ? implicitTarget(call.toolCallId) : undefined,
        dependency: own.dependency,
        read,
      });
    return read;
  };

  const readCall = (call: NormalizedToolCall) => cachedRead(call, { seen: new Set([call.toolCallId]), cyclic: false });

  return {
    update,
    readCall,
    specForCall(toolCallId) {
      const call = specCalls.get(toolCallId);
      return call && readCall(call);
    },
    readDataSpec,
    dataSpecOf: part => dataSpecOwners.get(part),
    readEditBase: (toolCallId, request) =>
      editBase(toolCallId, request, undefined, { seen: new Set([toolCallId]), cyclic: false }),
    reset() {
      editBases.clear();
      dataSpecReads.clear();
      callReads.clear();
    },
  };
}
