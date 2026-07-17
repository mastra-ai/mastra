/**
 * In-memory audit event storage for unit tests. Mirrors the Postgres
 * implementation's newest-first `(occurredAt, id)` keyset pagination (with
 * plain string comparison standing in for uuid ordering).
 */

import { randomUUID } from 'node:crypto';

import { AuditStorage, clampAuditLimit, decodeAuditCursor, encodeAuditCursor } from './base';
import type { AuditEventInsert, AuditEventPage, AuditEventRow, ListAuditEventsInput } from './base';

export class AuditStorageInMemory extends AuditStorage {
  #events: AuditEventRow[] = [];

  async init(): Promise<void> {
    // Nothing to set up.
  }

  protected async insert(row: AuditEventInsert): Promise<AuditEventRow> {
    const inserted: AuditEventRow = { ...structuredClone(row), id: randomUUID() };
    this.#events.push(inserted);
    return structuredClone(inserted);
  }

  async list(input: ListAuditEventsInput): Promise<AuditEventPage> {
    const limit = clampAuditLimit(input.limit);
    const cursor = input.before ? decodeAuditCursor(input.before) : undefined;

    const rows = this.#events
      .filter(event => {
        if (event.orgId !== input.orgId) return false;
        if (input.githubProjectId && event.githubProjectId !== input.githubProjectId) return false;
        if (input.actions && input.actions.length > 0 && !input.actions.includes(event.action)) return false;
        if (input.actorId && event.actorId !== input.actorId) return false;
        if (cursor) {
          const at = event.occurredAt.getTime();
          const cursorAt = cursor.occurredAt.getTime();
          if (!(at < cursorAt || (at === cursorAt && event.id < cursor.id))) return false;
        }
        return true;
      })
      .sort((a, b) => {
        const diff = b.occurredAt.getTime() - a.occurredAt.getTime();
        if (diff !== 0) return diff;
        return a.id < b.id ? 1 : a.id > b.id ? -1 : 0;
      })
      .slice(0, limit + 1);

    const events = rows.slice(0, limit).map(event => structuredClone(event));
    const hasMore = rows.length > limit;
    const last = events[events.length - 1];
    return {
      events,
      ...(hasMore && last ? { nextCursor: encodeAuditCursor(last) } : {}),
    };
  }
}
