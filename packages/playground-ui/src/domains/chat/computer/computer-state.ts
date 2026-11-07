import type { MastraDBMessage } from '@mastra/core/agent/message-list';

import type { ComputerHolder } from './computer-session';

export type ComputerStatus = 'attached' | 'released';
export type { ComputerHolder };

export interface ComputerEntry {
  computerId: string;
  name: string;
  status: ComputerStatus;
  persistent: boolean;
  /** Key of the part (`data-computer`, else the attach tool call) that owns the live viewer while attached. */
  ownerKey?: string;
  /** Who holds the computer's input, per the latest control part, request, or control signal in the transcript. */
  holder?: ComputerHolder;
  /** Why the agent asked for the user, while the user holds control after a request. */
  reason?: string;
}

/** A control change in the transcript: `computer_request_human`, or a take / hand back signal. */
export interface ComputerControlChange {
  computerId: string;
  holder: ComputerHolder;
  reason?: string;
}

const CONTROL_KINDS: Record<string, ComputerHolder> = { 'control-taken': 'human', 'control-returned': 'agent' };

/**
 * A `data-computer` control part (`{ computerId, control, reason }`, no `status`),
 * or a `data-signal` notification from the computers toolset carrying `computerId`.
 */
export function readControlChange(part: { type?: string; data?: unknown }): ComputerControlChange | undefined {
  if (!part.data || typeof part.data !== 'object') return undefined;
  const d = part.data as Record<string, unknown>;
  if (part.type === 'data-computer') {
    if (typeof d.computerId !== 'string' || !d.computerId || d.status !== undefined) return undefined;
    if (d.control !== 'human' && d.control !== 'agent') return undefined;
    return {
      computerId: d.computerId,
      holder: d.control,
      ...(d.control === 'human' && typeof d.reason === 'string' && { reason: d.reason }),
    };
  }
  if (part.type === 'data-signal') {
    const attributes = d.attributes as Record<string, unknown> | undefined;
    if (!attributes || attributes.source !== 'computer' || typeof attributes.computerId !== 'string') return undefined;
    const holder = typeof attributes.kind === 'string' ? CONTROL_KINDS[attributes.kind] : undefined;
    return holder ? { computerId: attributes.computerId, holder } : undefined;
  }
  return undefined;
}

function readRequestResult(result: unknown): ComputerControlChange | undefined {
  const r = readResult(result) as Record<string, unknown> | undefined;
  if (!r || typeof r.computerId !== 'string' || r.control !== 'human') return undefined;
  return { computerId: r.computerId, holder: 'human', ...(typeof r.reason === 'string' && { reason: r.reason }) };
}

const ATTACH_TOOLS = new Set(['computer_create', 'computer_attach']);

/** Stable key for a part occurrence in the transcript. */
export function computerPartKey(messageId: string, partIndex: number) {
  return `${messageId}:${partIndex}`;
}

function readDataPart(data: unknown): Omit<ComputerEntry, 'ownerKey'> | undefined {
  if (!data || typeof data !== 'object') return undefined;
  const d = data as Record<string, unknown>;
  if (typeof d.computerId !== 'string' || !d.computerId) return undefined;
  if (d.status !== 'attached' && d.status !== 'released') return undefined;
  return {
    computerId: d.computerId,
    name: typeof d.name === 'string' && d.name ? d.name : d.computerId,
    status: d.status,
    persistent: d.persistent === true,
  };
}

/** Tool results come back from stored history as JSON strings. */
function readResult(result: unknown): unknown {
  if (typeof result !== 'string') return result;
  try {
    return JSON.parse(result);
  } catch {
    return undefined;
  }
}

function readComputerResult(result: unknown): Omit<ComputerEntry, 'ownerKey'> | undefined {
  const computer = (readResult(result) as { computer?: Record<string, unknown> } | undefined)?.computer;
  if (!computer || typeof computer.id !== 'string' || !computer.id) return undefined;
  if (computer.status !== 'attached' && computer.status !== 'released') return undefined;
  return {
    computerId: computer.id,
    name: typeof computer.name === 'string' && computer.name ? computer.name : computer.id,
    status: computer.status,
    persistent: computer.persistent === true,
  };
}

/** The computer an attach tool call attached, when it succeeded. */
export function attachedComputerId(toolName: string, result: unknown): string | undefined {
  if (!ATTACH_TOOLS.has(toolName)) return undefined;
  const entry = readComputerResult(result);
  return entry?.status === 'attached' ? entry.computerId : undefined;
}

/**
 * Latest known state of every computer in a thread, in transcript order.
 * `data-computer` parts are authoritative. Tool results stand in when a thread's
 * stored history has no parts: `computer_create` / `computer_attach` /
 * `computer_release` results carry the computer's status, `computer_destroy`
 * returns `{ destroyed: id }`. A result never takes ownership from a part
 * written for the same attach.
 */
export function deriveComputers(messages: MastraDBMessage[]): Map<string, ComputerEntry> {
  const computers = new Map<string, ComputerEntry>();
  // Computers whose current attachment is owned by a `data-computer` part.
  const ownedByPart = new Set<string>();
  for (const message of messages) {
    const parts = (message.content as { parts?: unknown[] } | undefined)?.parts ?? [];
    const control = (change: ComputerControlChange | undefined) => {
      const previous = change && computers.get(change.computerId);
      if (!previous) return;
      const { reason: _reason, ...rest } = previous;
      computers.set(change.computerId, {
        ...rest,
        holder: change.holder,
        ...(change.holder === 'human' &&
          (change.reason ?? previous.reason) !== undefined && {
            reason: change.reason ?? previous.reason,
          }),
      });
    };
    parts.forEach((raw, index) => {
      const part = raw as { type?: string; data?: unknown; toolInvocation?: Record<string, unknown> };
      const key = computerPartKey(message.id, index);
      const change = readControlChange(part);
      if (change) return control(change);
      if (part.type === 'data-computer') {
        const entry = readDataPart(part.data);
        if (!entry) return;
        const previous = computers.get(entry.computerId);
        computers.set(entry.computerId, {
          ...entry,
          ownerKey: entry.status === 'attached' ? key : undefined,
          ...(entry.status === 'attached' &&
            previous?.status === 'attached' &&
            previous.holder && {
              holder: previous.holder,
              ...(previous.reason !== undefined && { reason: previous.reason }),
            }),
        });
        if (entry.status === 'attached') ownedByPart.add(entry.computerId);
        else ownedByPart.delete(entry.computerId);
        return;
      }
      const invocation = part.type === 'tool-invocation' ? part.toolInvocation : undefined;
      if (!invocation || invocation.state !== 'result') return;
      const toolName = String(invocation.toolName);
      if (toolName === 'computer_request_human') return control(readRequestResult(invocation.result));
      if (toolName === 'computer_destroy') {
        const destroyed = (readResult(invocation.result) as { destroyed?: unknown } | undefined)?.destroyed;
        const previous = typeof destroyed === 'string' ? computers.get(destroyed) : undefined;
        if (previous) computers.set(previous.computerId, { ...previous, status: 'released', ownerKey: undefined });
        if (typeof destroyed === 'string') ownedByPart.delete(destroyed);
        return;
      }
      if (!ATTACH_TOOLS.has(toolName) && toolName !== 'computer_release') return;
      const entry = readComputerResult(invocation.result);
      if (!entry) return;
      if (entry.status === 'released') {
        computers.set(entry.computerId, { ...entry, ownerKey: undefined });
        ownedByPart.delete(entry.computerId);
        return;
      }
      if (!ATTACH_TOOLS.has(toolName) || ownedByPart.has(entry.computerId)) return;
      // A part written for this same attach after its tool call takes ownership from here.
      computers.set(entry.computerId, { ...entry, ownerKey: key });
    });
  }
  return computers;
}

/** The server's answer to the latest control read or change, keyed by computer. */
export interface ComputerLiveControl {
  holder: ComputerHolder;
  /** Set by a take or hand back: whether the agent was told. */
  notified?: boolean;
  /** The transcript holder this answer was observed against; a newer transcript change wins. */
  basis?: ComputerHolder;
}

/**
 * Who holds a computer, last write wins: a server answer counts until the
 * transcript records a different holder than the one it was observed against.
 */
export function effectiveHolder(entry: ComputerEntry | undefined, live: ComputerLiveControl | undefined) {
  const transcript = entry?.holder ?? 'agent';
  if (!live || live.basis !== transcript) return { holder: transcript } as ComputerLiveControl;
  return live;
}
