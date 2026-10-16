import type { EventOccurrence } from '../../shared/events';

/** An event occurrence before a cursor is attached. */
export interface StoredOccurrence {
  eventId: string;
  name: string;
  timestamp: string;
  data: Record<string, unknown>;
}

/** An emitted event as retained by the buffer. */
export interface BufferedEvent {
  seq: number;
  /** Position after this event. */
  cursor: string;
  /** Parsed `occurrence.timestamp`, for `maxAgeMs`. */
  timestampMs: number;
  occurrence: StoredOccurrence;
}

export interface RingBufferReadOptions {
  maxEvents: number;
  maxAgeMs?: number;
  match?: (data: Record<string, unknown>) => boolean;
  now?: number;
}

export interface RingBufferReadResult {
  /** Position the read started from, after any gap adjustment. */
  from: string;
  events: EventOccurrence[];
  /** Position after the last scanned event, including events `match` rejected. */
  cursor: string;
  truncated: boolean;
  hasMore: boolean;
}

/**
 * Bounded, in-memory history of one event type's emitted occurrences.
 *
 * Cursors are opaque `base64url("<bootId>:<seq>")`. `bootId` is random per server instance, so a
 * cursor minted by a previous process is recognised as foreign and read as a gap.
 */
export class EventRingBuffer {
  private readonly entries: BufferedEvent[] = [];
  private seq = 0;

  constructor(
    private readonly bootId: string,
    private readonly capacity: number,
  ) {}

  get head(): string {
    return this.cursorFor(this.seq);
  }

  push(occurrence: StoredOccurrence): BufferedEvent {
    const seq = ++this.seq;
    const parsed = Date.parse(occurrence.timestamp);
    const entry: BufferedEvent = {
      seq,
      cursor: this.cursorFor(seq),
      timestampMs: Number.isNaN(parsed) ? Date.now() : parsed,
      occurrence,
    };
    this.entries.push(entry);
    if (this.entries.length > this.capacity) this.entries.shift();
    return entry;
  }

  /** `cursor` absent or `null` starts from now: nothing is replayed and `maxAgeMs` is ignored. */
  read(cursor: string | null | undefined, options: RingBufferReadOptions): RingBufferReadResult {
    if (cursor == null) {
      return { from: this.head, events: [], cursor: this.head, truncated: false, hasMore: false };
    }

    const oldestRetained = this.entries[0]?.seq ?? this.seq + 1;
    let after = this.decode(cursor);
    let truncated = false;
    if (after === undefined) {
      after = oldestRetained - 1;
      truncated = true;
    } else if (after < oldestRetained - 1) {
      after = oldestRetained - 1;
      truncated = true;
    }

    const floor = options.maxAgeMs === undefined ? undefined : (options.now ?? Date.now()) - options.maxAgeMs;
    const events: EventOccurrence[] = [];
    let scanned = after;
    let hasMore = false;
    for (const entry of this.entries) {
      if (entry.seq <= after) continue;
      if (floor !== undefined && entry.timestampMs < floor) {
        truncated = true;
        scanned = entry.seq;
        continue;
      }
      if (!options.match || options.match(entry.occurrence.data)) {
        if (events.length === options.maxEvents) {
          hasMore = true;
          break;
        }
        events.push({ ...entry.occurrence, cursor: entry.cursor });
      }
      scanned = entry.seq;
    }

    return { from: this.cursorFor(after), events, cursor: this.cursorFor(scanned), truncated, hasMore };
  }

  private cursorFor(seq: number): string {
    return Buffer.from(`${this.bootId}:${seq}`).toString('base64url');
  }

  /** Sequence number of a cursor this buffer minted, or `undefined` if it is foreign or malformed. */
  private decode(cursor: string): number | undefined {
    const decoded = Buffer.from(cursor, 'base64url').toString();
    const separator = decoded.lastIndexOf(':');
    if (separator === -1 || decoded.slice(0, separator) !== this.bootId) return undefined;
    const raw = decoded.slice(separator + 1);
    if (!/^\d+$/.test(raw)) return undefined;
    const seq = Number(raw);
    return seq <= this.seq ? seq : undefined;
  }
}
