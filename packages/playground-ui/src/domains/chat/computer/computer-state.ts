import type { MastraDBMessage } from '@mastra/core/agent/message-list';

export type ComputerStatus = 'attached' | 'released';

export interface ComputerEntry {
  computerId: string;
  name: string;
  status: ComputerStatus;
  persistent: boolean;
  /** Key of the `data-computer` part that owns the live viewer while attached. */
  ownerKey?: string;
}

const ATTACH_TOOLS = new Set(['computer_create', 'computer_attach']);

/** Stable key for a `data-computer` part occurrence. */
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

function readAttachResult(result: unknown): Omit<ComputerEntry, 'ownerKey' | 'status'> | undefined {
  const computer = (result as { computer?: Record<string, unknown> } | undefined)?.computer;
  if (!computer || typeof computer.id !== 'string' || !computer.id) return undefined;
  return {
    computerId: computer.id,
    name: typeof computer.name === 'string' && computer.name ? computer.name : computer.id,
    persistent: computer.persistent === true,
  };
}

/**
 * Latest known state of every computer in a thread, in transcript order.
 * `data-computer` parts are authoritative; `computer_create` / `computer_attach`
 * results only ever mark a computer attached. Release comes only from parts.
 */
export function deriveComputers(messages: MastraDBMessage[]): Map<string, ComputerEntry> {
  const computers = new Map<string, ComputerEntry>();
  for (const message of messages) {
    const parts = (message.content as { parts?: unknown[] } | undefined)?.parts ?? [];
    parts.forEach((raw, index) => {
      const part = raw as { type?: string; data?: unknown; toolInvocation?: Record<string, unknown> };
      if (part.type === 'data-computer') {
        const entry = readDataPart(part.data);
        if (!entry) return;
        computers.set(entry.computerId, {
          ...entry,
          ownerKey: entry.status === 'attached' ? computerPartKey(message.id, index) : undefined,
        });
        return;
      }
      const invocation = part.type === 'tool-invocation' ? part.toolInvocation : undefined;
      if (!invocation || invocation.state !== 'result' || !ATTACH_TOOLS.has(String(invocation.toolName))) return;
      const entry = readAttachResult(invocation.result);
      if (!entry) return;
      const previous = computers.get(entry.computerId);
      // A part for the same attach already set the owner; a result never moves it.
      if (previous?.status === 'attached') return;
      computers.set(entry.computerId, { ...entry, status: 'attached', ownerKey: undefined });
    });
  }
  return computers;
}
