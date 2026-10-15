import type { MastraDBMessage, MastraMessagePart } from './state/types';

/**
 * Total order for message content: `(createdAt milliseconds, seq)`, where `seq` is one counter per
 * exact millisecond shared by messages and parts. Encoded as a fixed-width string so plain string
 * comparison orders it, and so it survives JSON persistence inside existing message content.
 *
 * - Message order lives at `content.metadata.mastra.order` and covers the parts the message had
 *   when it was ordered. It is only written when it differs from `(createdAt, 0)`.
 * - A part appended to, or changed in place on, an ordered message gets its own order at
 *   `part.metadata.mastra.order`.
 * - Content without an order is legacy and sorts as `(createdAt, 0)`.
 */
export type MessageOrder = string;

const MS_WIDTH = 15;
const SEQ_WIDTH = 6;

export function formatOrder(ms: number, seq: number): MessageOrder {
  return `${String(ms).padStart(MS_WIDTH, '0')}-${String(seq).padStart(SEQ_WIDTH, '0')}`;
}

export function parseOrder(order: MessageOrder): { ms: number; seq: number } | undefined {
  const [ms, seq] = order.split('-');
  const parsed = { ms: Number(ms), seq: Number(seq) };
  return Number.isFinite(parsed.ms) && Number.isFinite(parsed.seq) ? parsed : undefined;
}

type MastraMeta = { mastra?: { order?: unknown } };

function readOrder(metadata: unknown): MessageOrder | undefined {
  const order = (metadata as MastraMeta | undefined)?.mastra?.order;
  return typeof order === 'string' && parseOrder(order) ? order : undefined;
}

export function getMessageOrder(message: MastraDBMessage): MessageOrder | undefined {
  return readOrder(message.content.metadata);
}

export function getPartOrder(part: MastraMessagePart): MessageOrder | undefined {
  return readOrder((part as { metadata?: unknown }).metadata);
}

/** The order of a message's original content, with legacy messages falling back to `(createdAt, 0)`. */
export function messageOrderOrLegacy(message: MastraDBMessage): MessageOrder {
  return getMessageOrder(message) ?? formatOrder(new Date(message.createdAt).getTime(), 0);
}

/** Newest order anywhere in the message: the message itself or any part ordered after it. */
export function newestOrderIn(message: MastraDBMessage): MessageOrder {
  let newest = messageOrderOrLegacy(message);
  for (const part of message.content.parts ?? []) {
    const order = getPartOrder(part);
    if (order && order > newest) newest = order;
  }
  return newest;
}

/** Effective order of a part: its own order, else the order of the message it arrived with. */
export function partOrder(message: MastraDBMessage, part: MastraMessagePart): MessageOrder {
  return getPartOrder(part) ?? messageOrderOrLegacy(message);
}

function setMessageOrder(message: MastraDBMessage, order: MessageOrder) {
  const metadata = (message.content.metadata ?? {}) as Record<string, unknown>;
  const mastra = (metadata.mastra ?? {}) as Record<string, unknown>;
  message.content.metadata = { ...metadata, mastra: { ...mastra, order } };
}

function setPartOrder(part: MastraMessagePart, order: MessageOrder) {
  const target = part as { metadata?: Record<string, unknown> };
  const metadata = target.metadata ?? {};
  const mastra = (metadata.mastra ?? {}) as Record<string, unknown>;
  target.metadata = { ...metadata, mastra: { ...mastra, order } };
}

/**
 * Content fingerprint of a part, ignoring Mastra bookkeeping (order, seal markers) so that only
 * real content changes count as an in-place change.
 */
function fingerprint(part: MastraMessagePart): string {
  // Tool payloads (e.g. MCP raw content) can be circular; the current path of ancestors breaks cycles.
  const ancestors: object[] = [];
  return JSON.stringify(part, function (this: unknown, key, value) {
    if (key === 'metadata' && value && typeof value === 'object' && 'mastra' in value) {
      const { mastra: _mastra, ...rest } = value as Record<string, unknown>;
      value = Object.keys(rest).length > 0 ? rest : undefined;
    }
    if (!value || typeof value !== 'object') return value;
    while (ancestors.length > 0 && ancestors[ancestors.length - 1] !== this) ancestors.pop();
    if (ancestors.includes(value)) return '[Circular]';
    ancestors.push(value);
    return value;
  });
}

/**
 * Assigns monotonic order to content added to a MessageList. The watermark seeds from every
 * message the list sees (loaded, deserialized or added), so order keeps increasing across
 * restarts, handoffs and clock rollback. Assumes one active generator per thread.
 */
export class MessageOrderTracker {
  #watermark?: { ms: number; seq: number };
  #parts = new WeakMap<MastraDBMessage, string[]>();

  get watermark(): MessageOrder | undefined {
    return this.#watermark && formatOrder(this.#watermark.ms, this.#watermark.seq);
  }

  seedWatermark(order: MessageOrder | undefined) {
    const parsed = order ? parseOrder(order) : undefined;
    if (!parsed) return;
    const current = this.#watermark;
    if (!current || parsed.ms > current.ms || (parsed.ms === current.ms && parsed.seq > current.seq)) {
      this.#watermark = parsed;
    }
  }

  #next(ms: number): MessageOrder {
    const current = this.#watermark;
    this.#watermark = !current || ms > current.ms ? { ms, seq: 0 } : { ms: current.ms, seq: current.seq + 1 };
    return formatOrder(this.#watermark.ms, this.#watermark.seq);
  }

  /** Records a message as already ordered (loaded from memory or restored), without assigning anything. */
  seed(message: MastraDBMessage) {
    this.seedWatermark(newestOrderIn(message));
    this.#parts.set(message, (message.content.parts ?? []).map(fingerprint));
  }

  /** Carries the known part state from a message to the object that replaces it. */
  inherit(from: MastraDBMessage, to: MastraDBMessage) {
    const known = this.#parts.get(from);
    if (!known) return;
    if (!getMessageOrder(to)) {
      const order = getMessageOrder(from);
      if (order) setMessageOrder(to, order);
    }
    this.#parts.set(to, known);
  }

  /** Orders a message produced in this run: new messages get a message order, new or changed parts get part orders. */
  stamp(message: MastraDBMessage) {
    const parts = message.content.parts ?? [];
    const known = this.#parts.get(message);
    const current = parts.map(fingerprint);

    if (!known) {
      const existing = getMessageOrder(message);
      if (existing) this.seedWatermark(existing);
      else {
        // Only write the order when the legacy fallback would get it wrong (a same-ms collision or
        // clock rollback), so the common case leaves stored messages untouched.
        const order = this.#next(new Date(message.createdAt).getTime());
        if (order !== messageOrderOrLegacy(message)) setMessageOrder(message, order);
      }
    } else {
      const now = Math.max(Date.now(), new Date(message.createdAt).getTime());
      parts.forEach((part, index) => {
        if (known[index] !== current[index]) setPartOrder(part, this.#next(now));
      });
    }

    for (const part of parts) this.seedWatermark(getPartOrder(part));
    this.#parts.set(message, current);
  }
}
