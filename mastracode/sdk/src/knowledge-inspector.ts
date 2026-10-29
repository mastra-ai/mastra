import type { AgentScopeEntry } from '@mastra/core/agent';
import type { Session } from '@mastra/core/agent-controller';
import { knowledgeScopeAddress } from '@mastra/core/knowledge';
import type { Knowledge } from '@mastra/core/knowledge';
import type { Mastra } from '@mastra/core/mastra';
import { parseKnowledgeWikilinks } from '@mastra/core/storage';
import type {
  KnowledgeNote,
  KnowledgePage,
  KnowledgePageActivityAction,
  KnowledgePageActivityEvent,
  KnowledgeReadScope,
  KnowledgeStorage,
} from '@mastra/core/storage';

import { knowledgeSessionTags, resolveKnowledgeSessionScopes } from './knowledge-scope.js';
import type { MastraCodeState } from './schema.js';

export type KnowledgeInspectorScopeLevel = 'org' | 'resource' | 'thread';
export type KnowledgeInspectorRecordType = 'node';
/** `name`: every readable page, by name. `connected`: the first pages by name, most linked first. */
export type KnowledgeInspectorNodeSort = 'name' | 'connected';

export interface KnowledgeInspectorScopeRoot {
  level: KnowledgeInspectorScopeLevel;
  id?: string;
  available: boolean;
  reason?: string;
}

export interface KnowledgeInspectorScopeTree {
  identityKey: string;
  defaultLevel: 'resource';
  roots: KnowledgeInspectorScopeRoot[];
}

export interface KnowledgeInspectorScopeBadge {
  /** The scope's type, e.g. `org`, `project`, `resource`, `thread`. */
  level: string;
  id: string;
}

export interface KnowledgeInspectorRelationshipCounts {
  records: number;
  outgoing: number;
  incoming: number;
  sampled: boolean;
}

/** A page. */
export interface KnowledgeInspectorNodeSummary {
  /** Opaque, freshly minted per result and bound to the session; use it to open the page. */
  handle: string;
  /** The page's stable id: the same page always has the same id, and two pages never share one. */
  id: string;
  type: KnowledgeInspectorRecordType;
  name: string;
  scope: KnowledgeInspectorScopeBadge;
  version: number;
  updatedAt: string;
  relationshipCounts?: KnowledgeInspectorRelationshipCounts;
}

/** A note. */
export interface KnowledgeInspectorRecordSummary {
  text: string;
  scope: KnowledgeInspectorScopeBadge;
  sourceThreadId?: string;
  capturedAt: string;
  when?: string;
}

export interface KnowledgeInspectorNodeList {
  identityKey: string;
  scopeLevel: KnowledgeInspectorScopeLevel;
  nodes: KnowledgeInspectorNodeSummary[];
  nextCursor?: string;
  sort?: KnowledgeInspectorNodeSort;
  coverage?: 'exact' | 'window';
}

export interface KnowledgeInspectorRelationshipPreview {
  nodes: KnowledgeInspectorNodeSummary[];
  partial: boolean;
}

export interface KnowledgeInspectorNodeDetail {
  identityKey: string;
  scopeLevel: KnowledgeInspectorScopeLevel;
  node: KnowledgeInspectorNodeSummary;
  /** Notes on the page. */
  records: KnowledgeInspectorRecordSummary[];
  recordsNextCursor?: string;
  /** Notes on other pages that mention this page. */
  mentioningRecords: KnowledgeInspectorRecordSummary[];
  mentioningRecordsNextCursor?: string;
  /** Pages this page's notes and body mention. */
  outgoingTargets: KnowledgeInspectorRelationshipPreview;
  /** Pages whose notes mention this page. */
  incomingParents: KnowledgeInspectorRelationshipPreview;
  relationshipCounts: KnowledgeInspectorRelationshipCounts;
  /** The page body. */
  content?: string;
  contentTruncated: boolean;
  links: Array<{ label: string; node?: KnowledgeInspectorNodeSummary }>;
}

export interface KnowledgeInspectorActivityEvent {
  action: KnowledgePageActivityAction;
  recordType: 'page' | 'note';
  scope: KnowledgeInspectorScopeBadge;
  sourceThreadId?: string;
  createdAt: string;
  record?: KnowledgeInspectorNodeSummary;
}

export interface KnowledgeInspectorActivityList {
  identityKey: string;
  scopeLevel: KnowledgeInspectorScopeLevel;
  events: KnowledgeInspectorActivityEvent[];
  nextCursor?: string;
}

export interface KnowledgeInspector {
  getScopeTree(): Promise<KnowledgeInspectorScopeTree>;
  listNodes(input: {
    level: KnowledgeInspectorScopeLevel;
    namePrefix?: string;
    sort?: KnowledgeInspectorNodeSort;
    cursor?: string;
    limit?: number;
  }): Promise<KnowledgeInspectorNodeList>;
  getNode(input: {
    handle: string;
    recordsCursor?: string;
    mentioningRecordsCursor?: string;
    recordLimit?: number;
  }): Promise<KnowledgeInspectorNodeDetail>;
  listActivity(input: {
    level: KnowledgeInspectorScopeLevel;
    cursor?: string;
    limit?: number;
  }): Promise<KnowledgeInspectorActivityList>;
}

export class KnowledgeInspectorError extends Error {
  constructor(
    readonly code: 'unavailable' | 'invalid-handle' | 'stale-handle' | 'invalid-cursor' | 'not-visible',
    message: string,
  ) {
    super(message);
    this.name = 'KnowledgeInspectorError';
  }
}

interface Binding {
  /** The session's non-identity scope tags, shared with the code agent (see knowledge-scope.ts). */
  sessionTags: string[];
  /** The session's Memory resource. */
  resourceId: string;
  threadId?: string;
  fingerprint: string;
  identityKey: string;
}

/** What one level reads with: the level's principals' read scope. */
interface LevelView {
  level: KnowledgeInspectorScopeLevel;
  read: KnowledgeReadScope;
}

interface HandleEntry {
  identityKey: string;
  level: KnowledgeInspectorScopeLevel;
  type: KnowledgeInspectorRecordType;
  recordId: string;
  expiresAt: number;
}

interface CursorEntry {
  identityKey: string;
  level: KnowledgeInspectorScopeLevel;
  kind: 'node' | 'ranked-node' | 'records' | 'mentioning-records' | 'activity';
  value: string;
  filters?: { namePrefix?: string; sort?: KnowledgeInspectorNodeSort };
  expiresAt: number;
}

interface RankedNodeSnapshot {
  offset: number;
  entries: { id: string; counts: KnowledgeInspectorRelationshipCounts }[];
}

interface Related {
  pages: KnowledgePage[];
  truncated: boolean;
}

const HANDLE_TTL_MS = 5 * 60_000;
const MAX_OPAQUE_ENTRIES = 1_000;
const DEFAULT_PAGE_LIMIT = 50;
const MAX_PAGE_LIMIT = 50;
const DEFAULT_NOTE_LIMIT = 25;
const MAX_NOTE_LIMIT = 100;
const DEFAULT_ACTIVITY_LIMIT = 20;
const MAX_ACTIVITY_LIMIT = 100;
const MAX_RELATED_PAGES = 25;
const MAX_RANK_CANDIDATES = 50;
const MAX_RANK_NOTES = 100;
const MAX_BODY_BYTES = 32 * 1024;

function opaqueToken(): string {
  return Buffer.from(globalThis.crypto.getRandomValues(new Uint8Array(24))).toString('base64url');
}

function boundedLimit(value: number | undefined, fallback: number, maximum: number): number {
  if (value === undefined) return fallback;
  if (!Number.isInteger(value) || value < 1) return fallback;
  return Math.min(value, maximum);
}

function badgeOf(address: string | undefined): KnowledgeInspectorScopeBadge {
  if (!address) return { level: 'unknown', id: '' };
  const separator = address.indexOf(':');
  return { level: address.slice(0, separator), id: address.slice(separator + 1) };
}

/** A session tag in Knowledge's canonical form; every type the session holds has one `$param`. */
function canonical(tag: string): string {
  const separator = tag.indexOf(':');
  return knowledgeScopeAddress(`${tag.slice(0, separator)}:$value`, { value: tag.slice(separator + 1) });
}

function truncateUtf8(value: string, maxBytes: number): { value: string; truncated: boolean } {
  const encoded = Buffer.from(value);
  if (encoded.byteLength <= maxBytes) return { value, truncated: false };
  let end = maxBytes;
  let truncated = encoded.subarray(0, end).toString('utf8');
  while (Buffer.byteLength(truncated) > maxBytes) {
    truncated = encoded.subarray(0, --end).toString('utf8');
  }
  return { value: truncated, truncated: true };
}

/**
 * The /knowledge inspector: reads the pages and notes a session's code agent can read, one level at a
 * time (the session's shared tags, then its project resource, then its thread), through the same
 * Knowledge access rules the agent's runs use.
 */
class ScopedKnowledgeInspector implements KnowledgeInspector {
  readonly #knowledge: Knowledge;
  readonly #store: KnowledgeStorage;
  readonly #session: Session<MastraCodeState>;
  readonly #handles = new Map<string, HandleEntry>();
  readonly #cursors = new Map<string, CursorEntry>();
  readonly #scopeAddresses = new Map<string, string | undefined>();
  #fingerprint?: string;
  #identityKey = opaqueToken();

  readonly #hostScopes: readonly AgentScopeEntry[];

  constructor(input: {
    knowledge: Knowledge;
    store: KnowledgeStorage;
    session: Session<MastraCodeState>;
    hostScopes?: readonly AgentScopeEntry[];
  }) {
    this.#knowledge = input.knowledge;
    this.#store = input.store;
    this.#session = input.session;
    this.#hostScopes = input.hostScopes ?? [];
    this.#session.subscribe(event => {
      if (event.type === 'thread_changed' || event.type === 'thread_created' || event.type === 'thread_deleted') {
        this.#invalidate();
      }
    });
  }

  async getScopeTree(): Promise<KnowledgeInspectorScopeTree> {
    const binding = await this.#binding();
    return {
      identityKey: binding.identityKey,
      defaultLevel: 'resource',
      roots: [
        { level: 'org', id: binding.sessionTags.join(' + '), available: true },
        { level: 'resource', id: binding.resourceId, available: true },
        binding.threadId
          ? { level: 'thread', id: binding.threadId, available: true }
          : { level: 'thread', available: false, reason: 'No active thread belongs to this project.' },
      ],
    };
  }

  async listNodes(input: {
    level: KnowledgeInspectorScopeLevel;
    namePrefix?: string;
    sort?: KnowledgeInspectorNodeSort;
    cursor?: string;
    limit?: number;
  }): Promise<KnowledgeInspectorNodeList> {
    const binding = await this.#binding();
    const view = await this.#view(binding, input.level);
    const limit = boundedLimit(input.limit, DEFAULT_PAGE_LIMIT, MAX_PAGE_LIMIT);
    const sort = input.sort ?? 'name';
    const filters = { namePrefix: input.namePrefix, sort };

    if (sort === 'name') {
      const cursor = this.#consumeCursor(input.cursor, binding, input.level, 'node', filters);
      const result = await this.#store.listPages({ read: view.read, namePrefix: input.namePrefix, cursor, limit });
      const nodes = await Promise.all(
        result.pages.map(async page => ({
          ...(await this.#summary(page, binding, view)),
          relationshipCounts: await this.#counts(page, view),
        })),
      );
      await this.#assertStable(binding);
      return {
        identityKey: binding.identityKey,
        scopeLevel: input.level,
        nodes,
        nextCursor: result.nextCursor
          ? this.#mintCursor(binding, input.level, 'node', result.nextCursor, filters)
          : undefined,
        sort,
        coverage: 'exact',
      };
    }

    const encoded = this.#consumeCursor(input.cursor, binding, input.level, 'ranked-node', filters);
    const snapshot = encoded ? (JSON.parse(encoded) as RankedNodeSnapshot) : await this.#ranked(view, input.namePrefix);
    const nodes: KnowledgeInspectorNodeSummary[] = [];
    for (const entry of snapshot.entries.slice(snapshot.offset, snapshot.offset + limit)) {
      const page = await this.#store.getPage({ id: entry.id, read: view.read });
      if (!page || page.deletedAt) continue;
      nodes.push({ ...(await this.#summary(page, binding, view)), relationshipCounts: entry.counts });
    }
    const nextOffset = snapshot.offset + limit;
    await this.#assertStable(binding);
    return {
      identityKey: binding.identityKey,
      scopeLevel: input.level,
      nodes,
      nextCursor:
        nextOffset < snapshot.entries.length
          ? this.#mintCursor(
              binding,
              input.level,
              'ranked-node',
              JSON.stringify({ ...snapshot, offset: nextOffset } satisfies RankedNodeSnapshot),
              filters,
            )
          : undefined,
      sort,
      coverage: 'window',
    };
  }

  async getNode(input: {
    handle: string;
    recordsCursor?: string;
    mentioningRecordsCursor?: string;
    recordLimit?: number;
  }): Promise<KnowledgeInspectorNodeDetail> {
    const binding = await this.#binding();
    const handle = this.#readHandle(input.handle, binding, 'node');
    const view = await this.#view(binding, handle.level);
    const page = await this.#store.getPage({ id: handle.recordId, read: view.read });
    if (!page || page.deletedAt) {
      throw new KnowledgeInspectorError('not-visible', 'Knowledge page is not visible in the selected scope.');
    }
    const limit = boundedLimit(input.recordLimit, DEFAULT_NOTE_LIMIT, MAX_NOTE_LIMIT);
    const notesAfter = this.#consumeCursor(input.recordsCursor, binding, handle.level, 'records');
    const mentioningAfter = this.#consumeCursor(
      input.mentioningRecordsCursor,
      binding,
      handle.level,
      'mentioning-records',
    );
    const [notes, mentioning] = await Promise.all([
      this.#store.listNotes({ pageId: page.id, read: view.read, cursor: notesAfter, limit }),
      this.#store.listNotesMentioning({ pageId: page.id, read: view.read, cursor: mentioningAfter, limit }),
    ]);
    const body = truncateUtf8(page.body ?? '', MAX_BODY_BYTES);
    const [outgoing, incoming, counts] = await Promise.all([
      this.#outgoing(page, notes.notes, view),
      this.#incoming(mentioning.notes, view),
      this.#counts(page, view),
    ]);
    const links = await Promise.all(
      parseKnowledgeWikilinks(body.value)
        .slice(0, MAX_RELATED_PAGES)
        .map(async label => {
          const [target] = await this.#store.findPagesByName({ name: label, read: view.read, limit: 1 });
          return { label, node: target ? await this.#summary(target, binding, view) : undefined };
        }),
    );
    const summaries = (pages: KnowledgePage[]) =>
      Promise.all(pages.map(related => this.#summary(related, binding, view)));
    const detail: KnowledgeInspectorNodeDetail = {
      identityKey: binding.identityKey,
      scopeLevel: handle.level,
      node: { ...(await this.#summary(page, binding, view)), relationshipCounts: counts },
      records: await Promise.all(notes.notes.map(note => this.#noteSummary(note))),
      recordsNextCursor: notes.nextCursor
        ? this.#mintCursor(binding, handle.level, 'records', notes.nextCursor)
        : undefined,
      mentioningRecords: await Promise.all(mentioning.notes.map(note => this.#noteSummary(note))),
      mentioningRecordsNextCursor: mentioning.nextCursor
        ? this.#mintCursor(binding, handle.level, 'mentioning-records', mentioning.nextCursor)
        : undefined,
      outgoingTargets: {
        nodes: await summaries(outgoing.pages),
        partial: outgoing.truncated || Boolean(notes.nextCursor),
      },
      incomingParents: {
        nodes: await summaries(incoming.pages),
        partial: incoming.truncated || Boolean(mentioning.nextCursor),
      },
      relationshipCounts: counts,
      content: page.body === undefined ? undefined : body.value,
      contentTruncated: body.truncated,
      links,
    };
    await this.#assertStable(binding);
    return detail;
  }

  async listActivity(input: {
    level: KnowledgeInspectorScopeLevel;
    cursor?: string;
    limit?: number;
  }): Promise<KnowledgeInspectorActivityList> {
    const binding = await this.#binding();
    const view = await this.#view(binding, input.level);
    const limit = boundedLimit(input.limit, DEFAULT_ACTIVITY_LIMIT, MAX_ACTIVITY_LIMIT);
    const cursor = this.#consumeCursor(input.cursor, binding, input.level, 'activity');
    const result = await this.#store.listPageActivity({ read: view.read, cursor, limit });
    const events: KnowledgeInspectorActivityEvent[] = [];
    for (const event of result.events) events.push(await this.#activityEvent(event, binding, view));
    await this.#assertStable(binding);
    return {
      identityKey: binding.identityKey,
      scopeLevel: input.level,
      events,
      nextCursor: result.nextCursor ? this.#mintCursor(binding, input.level, 'activity', result.nextCursor) : undefined,
    };
  }

  async #binding(): Promise<Binding> {
    // Session tags come from the same resolver the code agent's run scopes use.
    const session = resolveKnowledgeSessionScopes(this.#session.state.get(), this.#hostScopes);
    const sessionResourceId = this.#session.identity.getResourceId();
    if (!session.resolved) {
      // An unresolved session is its own identity: handles minted under the
      // previous scope must not survive into whatever resolves next.
      this.#invalidate();
      throw new KnowledgeInspectorError('unavailable', `Knowledge inspection unavailable: ${session.reason}`);
    }
    if (!sessionResourceId) {
      throw new KnowledgeInspectorError('unavailable', 'Knowledge inspection requires an active project.');
    }
    const sessionTags = knowledgeSessionTags(session.scopes);
    const resourceId = sessionResourceId;
    const activeThreadId = this.#session.thread.getId() ?? undefined;
    const thread = activeThreadId ? await this.#session.thread.getById({ threadId: activeThreadId }) : null;
    const threadId = thread?.resourceId === sessionResourceId ? thread.id : undefined;
    const fingerprint = `${sessionTags.join('\u001f')}\0${resourceId}\0${threadId ?? ''}`;
    if (this.#fingerprint !== fingerprint) {
      this.#fingerprint = fingerprint;
      this.#identityKey = opaqueToken();
      this.#handles.clear();
      this.#cursors.clear();
    }
    return { sessionTags, resourceId, threadId, fingerprint, identityKey: this.#identityKey };
  }

  /** The principals a level reads with: the session's shared tags, plus its resource, plus its thread. */
  async #view(binding: Binding, level: KnowledgeInspectorScopeLevel): Promise<LevelView> {
    let principals: string[];
    if (level === 'org') {
      if (binding.sessionTags.length === 0) {
        throw new KnowledgeInspectorError('unavailable', 'This session holds no shared scope tags.');
      }
      principals = [...binding.sessionTags];
    } else {
      principals = [...binding.sessionTags, `resource:${binding.resourceId}`];
      if (level === 'thread') {
        if (!binding.threadId) {
          throw new KnowledgeInspectorError('unavailable', 'The active thread does not belong to this project.');
        }
        principals.push(`thread:${binding.threadId}`);
      }
    }
    try {
      return { level, read: await this.#knowledge.readScopeFor(principals.map(canonical)) };
    } catch (error) {
      throw new KnowledgeInspectorError(
        'unavailable',
        `Knowledge inspection unavailable: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async #assertStable(binding: Binding): Promise<void> {
    const current = await this.#binding();
    if (current.identityKey !== binding.identityKey || current.fingerprint !== binding.fingerprint) {
      throw new KnowledgeInspectorError('stale-handle', 'Knowledge scope changed while the request was running.');
    }
  }

  async #scopeAddress(scopeId: string): Promise<string | undefined> {
    if (!this.#scopeAddresses.has(scopeId)) {
      // Scope names and addresses aren't secret to the host; the page itself was already read through the view.
      const page = await this.#store.getPage({ id: scopeId, read: 'all' });
      this.#scopeAddresses.set(scopeId, page?.address);
    }
    return this.#scopeAddresses.get(scopeId);
  }

  async #summary(page: KnowledgePage, binding: Binding, view: LevelView): Promise<KnowledgeInspectorNodeSummary> {
    return {
      handle: this.#mintHandle(binding, view.level, 'node', page.id),
      id: page.id,
      type: 'node',
      name: page.name,
      scope: badgeOf(await this.#scopeAddress(page.scopeId)),
      version: page.version,
      updatedAt: page.updatedAt.toISOString(),
    };
  }

  async #noteSummary(note: KnowledgeNote): Promise<KnowledgeInspectorRecordSummary> {
    return {
      text: note.text,
      scope: badgeOf(await this.#scopeAddress(note.stampScopeIds[0]!)),
      sourceThreadId: note.provenance.sourceThreadId,
      capturedAt: note.createdAt.toISOString(),
      when: note.when?.toISOString(),
    };
  }

  /** The first pages by name, most linked first; ties keep name order. */
  async #ranked(view: LevelView, namePrefix: string | undefined): Promise<RankedNodeSnapshot> {
    const { pages } = await this.#store.listPages({ read: view.read, namePrefix, limit: MAX_RANK_CANDIDATES });
    const ranked = await Promise.all(
      pages.map(async (page, order) => {
        const counts = await this.#counts(page, view);
        return { id: page.id, order, counts, degree: counts.outgoing + counts.incoming };
      }),
    );
    ranked.sort((a, b) => b.degree - a.degree || a.order - b.order);
    return { offset: 0, entries: ranked.map(({ id, counts }) => ({ id, counts })) };
  }

  async #counts(page: KnowledgePage, view: LevelView): Promise<KnowledgeInspectorRelationshipCounts> {
    const [notes, mentioning] = await Promise.all([
      this.#store.listNotes({ pageId: page.id, read: view.read, limit: MAX_RANK_NOTES }),
      this.#store.listNotesMentioning({ pageId: page.id, read: view.read, limit: MAX_RANK_NOTES }),
    ]);
    const [outgoing, incoming] = await Promise.all([
      this.#outgoing(page, notes.notes, view),
      this.#incoming(mentioning.notes, view),
    ]);
    return {
      records: notes.notes.length + mentioning.notes.length,
      outgoing: outgoing.pages.length,
      incoming: incoming.pages.length,
      sampled: Boolean(notes.nextCursor || mentioning.nextCursor || outgoing.truncated || incoming.truncated),
    };
  }

  /** Readable pages this page's notes mention, then pages its body links to by name. */
  async #outgoing(page: KnowledgePage, notes: KnowledgeNote[], view: LevelView): Promise<Related> {
    const related = new Map<string, KnowledgePage>();
    const add = (target: KnowledgePage | null | undefined) => {
      if (target && !target.deletedAt && target.id !== page.id) related.set(target.id, target);
    };
    for (const id of new Set(notes.flatMap(note => note.mentions))) {
      if (related.size >= MAX_RELATED_PAGES) return { pages: [...related.values()], truncated: true };
      add(await this.#store.getPage({ id, read: view.read }));
    }
    for (const name of parseKnowledgeWikilinks(page.body ?? '')) {
      if (related.size >= MAX_RELATED_PAGES) return { pages: [...related.values()], truncated: true };
      const [target] = await this.#store.findPagesByName({ name, read: view.read, limit: 1 });
      add(target);
    }
    return { pages: [...related.values()], truncated: false };
  }

  /** Readable pages whose notes mention this page. */
  async #incoming(mentioning: KnowledgeNote[], view: LevelView): Promise<Related> {
    const related = new Map<string, KnowledgePage>();
    for (const pageId of new Set(mentioning.map(note => note.pageId))) {
      if (related.size >= MAX_RELATED_PAGES) return { pages: [...related.values()], truncated: true };
      const source = await this.#store.getPage({ id: pageId, read: view.read });
      if (source && !source.deletedAt) related.set(source.id, source);
    }
    return { pages: [...related.values()], truncated: false };
  }

  async #activityEvent(
    event: KnowledgePageActivityEvent,
    binding: Binding,
    view: LevelView,
  ): Promise<KnowledgeInspectorActivityEvent> {
    const page = await this.#store.getPage({ id: event.pageId, read: view.read });
    const live = page && !page.deletedAt ? page : undefined;
    return {
      action: event.action,
      recordType: event.noteId ? 'note' : 'page',
      scope: badgeOf(await this.#scopeAddress(event.scopeId)),
      sourceThreadId: event.provenance.sourceThreadId,
      createdAt: event.createdAt.toISOString(),
      record: live ? await this.#summary(live, binding, view) : undefined,
    };
  }

  #mintHandle(
    binding: Binding,
    level: KnowledgeInspectorScopeLevel,
    type: KnowledgeInspectorRecordType,
    recordId: string,
  ): string {
    this.#pruneOpaqueEntries();
    const token = opaqueToken();
    this.#handles.set(token, {
      identityKey: binding.identityKey,
      level,
      type,
      recordId,
      expiresAt: Date.now() + HANDLE_TTL_MS,
    });
    return token;
  }

  #readHandle(handle: string, binding: Binding, expectedType: KnowledgeInspectorRecordType): HandleEntry {
    const entry = this.#handles.get(handle);
    if (!entry || entry.expiresAt < Date.now() || entry.type !== expectedType) {
      throw new KnowledgeInspectorError('invalid-handle', 'Knowledge record handle is invalid or expired.');
    }
    if (entry.identityKey !== binding.identityKey) {
      throw new KnowledgeInspectorError('stale-handle', 'Knowledge record handle belongs to a previous scope.');
    }
    return entry;
  }

  #mintCursor(
    binding: Binding,
    level: KnowledgeInspectorScopeLevel,
    kind: CursorEntry['kind'],
    value: string,
    filters?: CursorEntry['filters'],
  ): string {
    this.#pruneOpaqueEntries();
    const token = opaqueToken();
    this.#cursors.set(token, {
      identityKey: binding.identityKey,
      level,
      kind,
      value,
      filters,
      expiresAt: Date.now() + HANDLE_TTL_MS,
    });
    return token;
  }

  #consumeCursor(
    cursor: string | undefined,
    binding: Binding,
    level: KnowledgeInspectorScopeLevel,
    kind: CursorEntry['kind'],
    filters?: CursorEntry['filters'],
  ): string | undefined {
    if (!cursor) return undefined;
    const entry = this.#cursors.get(cursor);
    if (
      !entry ||
      entry.expiresAt < Date.now() ||
      entry.identityKey !== binding.identityKey ||
      entry.level !== level ||
      entry.kind !== kind ||
      entry.filters?.namePrefix !== filters?.namePrefix ||
      entry.filters?.sort !== filters?.sort
    ) {
      throw new KnowledgeInspectorError(
        'invalid-cursor',
        'Knowledge cursor does not match the active scope and filters.',
      );
    }
    return entry.value;
  }

  #pruneOpaqueEntries(): void {
    const now = Date.now();
    for (const [token, entry] of this.#handles) {
      if (entry.expiresAt < now) this.#handles.delete(token);
    }
    for (const [token, entry] of this.#cursors) {
      if (entry.expiresAt < now) this.#cursors.delete(token);
    }
    while (this.#handles.size + this.#cursors.size >= MAX_OPAQUE_ENTRIES) {
      const handle = this.#handles.keys().next().value;
      if (handle) this.#handles.delete(handle);
      else {
        const cursor = this.#cursors.keys().next().value;
        if (cursor) this.#cursors.delete(cursor);
        else break;
      }
    }
  }

  #invalidate(): void {
    this.#fingerprint = undefined;
    this.#identityKey = opaqueToken();
    this.#handles.clear();
    this.#cursors.clear();
  }
}

/**
 * The /knowledge inspector for a session, reading through the session's Knowledge runtime (a key
 * resolves through `mastra`). Undefined when there is no Knowledge runtime: access rules live on the
 * runtime, so a bare storage domain can't be inspected.
 */
export async function createKnowledgeInspector(input: {
  knowledge?: Knowledge | string;
  mastra?: Pick<Mastra, 'getKnowledge'>;
  session: Session<MastraCodeState>;
  /** The host's `knowledge.scopes`, so the inspector reads what the code agent writes. */
  hostScopes?: readonly AgentScopeEntry[];
}): Promise<KnowledgeInspector | undefined> {
  let selected: Knowledge | undefined;
  if (typeof input.knowledge === 'string') {
    try {
      selected = input.mastra?.getKnowledge(input.knowledge);
    } catch {
      throw new KnowledgeInspectorError('unavailable', 'The configured Knowledge runtime is unavailable.');
    }
    if (!selected) {
      throw new KnowledgeInspectorError('unavailable', 'The configured Knowledge runtime is unavailable.');
    }
  } else {
    selected = input.knowledge;
  }
  if (!selected) return undefined;
  const store = await selected.getStorage();
  return new ScopedKnowledgeInspector({
    knowledge: selected,
    store,
    session: input.session,
    hostScopes: input.hostScopes,
  });
}
