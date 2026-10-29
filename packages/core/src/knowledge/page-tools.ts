import type { JSONSchema7 } from 'json-schema';
import type {
  KnowledgeNote,
  KnowledgePage,
  KnowledgePageSearchHit,
  KnowledgeStorage,
} from '../storage/domains/knowledge';
import { knowledgeScopeReadable } from '../storage/domains/knowledge';
import type { ToolAction } from '../tools';
import { createTool } from '../tools';
import { knowledgeRoleOn } from './access';
import { knowledgeRoleAtLeast } from './declarations';
import { KnowledgeNotFoundError, KnowledgeRun } from './run';
import type { KnowledgeRunContext } from './run';
import type { KnowledgeScopeRuntime } from './scope-runtime';
import type { KnowledgeSemanticIndex } from './semantic';

/** What the page tools need from their Knowledge. @internal */
export interface KnowledgePageToolHost {
  runtime: KnowledgeScopeRuntime;
  getStorage(): Promise<KnowledgeStorage>;
  /** Set when Knowledge has a vector store and embedder: search is hybrid and writes are embedded. */
  semantic?: KnowledgeSemanticIndex;
  warn?: (message: string) => void;
}

/** Embeds after a committed write. A failure only costs recall, so it warns instead of failing the write. */
async function reindex(host: KnowledgePageToolHost, work: (index: KnowledgeSemanticIndex) => Promise<void>) {
  if (!host.semantic) return;
  try {
    await work(host.semantic);
  } catch (error) {
    host.warn?.(`Knowledge semantic index update failed; run knowledge.reindex() to repair: ${String(error)}`);
  }
}

/** Reciprocal-rank constant: results ranked well by either list rise; neither list's scores need comparing. */
const RRF_K = 60;

/** Which tools to build. `pins` adds `knowledge_pin`. @internal */
export interface KnowledgePageToolGroups {
  read: boolean;
  write: boolean;
  pins: boolean;
}

type Tools = Record<string, ToolAction<any, any, any>>;

const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 50;
const MENTION = /\[\[([^\]]+)\]\]/g;

const limitSchema = { type: 'integer', minimum: 1, maximum: MAX_LIMIT } as const;
const scopeListSchema = {
  type: 'array',
  items: { type: 'string', minLength: 1 },
  minItems: 1,
} as const;
const pageRefDescription =
  'A page id, a scope address (org:acme), a key path (<scope>#<key>/<child key>, e.g. policy:acme#policies/refund), or an exact page name.';

function limitOf(limit: number | undefined): number {
  return Math.min(Math.max(limit ?? DEFAULT_LIMIT, 1), MAX_LIMIT);
}

async function start(host: KnowledgePageToolHost, context: unknown): Promise<KnowledgeRun> {
  return KnowledgeRun.start(host.runtime, await host.getStorage(), context as KnowledgeRunContext | undefined);
}

/** Scope addresses by page id, for showing where results live. */
async function scopeAddresses(run: KnowledgeRun, pages: KnowledgePage[]): Promise<Map<string, string>> {
  const addresses = new Map<string, string>();
  for (const page of pages) {
    if (addresses.has(page.scopeId)) continue;
    const scope = page.isScope ? page : await run.storage.getPage({ id: page.scopeId, read: run.read });
    if (scope?.address) addresses.set(page.scopeId, scope.address);
  }
  return addresses;
}

function pageSummary(page: KnowledgePage, addresses: Map<string, string>) {
  return {
    id: page.id,
    name: page.name,
    ...(page.isScope ? { address: page.address } : { scope: addresses.get(page.scopeId) }),
    ...(page.key ? { key: page.key } : {}),
    ...(page.description ? { description: page.description } : {}),
  };
}

function noteSummary(note: KnowledgeNote) {
  return {
    id: note.id,
    text: note.text,
    ...(note.when ? { when: note.when.toISOString() } : {}),
    author: note.provenance.author,
  };
}

/** Scope pages for addresses the run names; each must be readable. */
async function readableScopes(run: KnowledgeRun, addresses: string[]): Promise<KnowledgePage[]> {
  const scopes = await run.storage.getScopesByAddress(addresses);
  for (const address of addresses) {
    const scope = scopes.find(candidate => candidate.address === address);
    if (!scope || !knowledgeScopeReadable(scope, run.read)) throw new KnowledgeNotFoundError(address);
  }
  return scopes;
}

/** Resolves `[[mentions]]` among readable pages; unresolved names stay plain text. */
async function resolveMentions(run: KnowledgeRun, text: string): Promise<string[]> {
  const ids = new Set<string>();
  for (const [, ref] of text.matchAll(MENTION)) {
    try {
      ids.add((await run.page(ref!.trim())).id);
    } catch (error) {
      if (!(error instanceof KnowledgeNotFoundError)) throw error;
    }
  }
  return [...ids];
}

async function visibleNote(run: KnowledgeRun, id: string): Promise<{ note: KnowledgeNote; page: KnowledgePage }> {
  const note = await run.storage.getNote({ id, read: run.read });
  const page = note ? await run.storage.getPage({ id: note.pageId, read: run.read }) : null;
  if (!note || !page) throw new Error(`Knowledge note "${id}" not found.`);
  return { note, page };
}

/** Pin authority over an audience entry: the run holds it, or rules give it editor+ there. */
async function requireAudienceAuthority(run: KnowledgeRun, audience: string[]): Promise<void> {
  for (const address of audience) {
    if (run.principals.includes(address)) continue;
    if (!run.runtime.compiled.match(address)) {
      throw new Error(`Pin audience "${address}" does not match a declared scope type.`);
    }
    const [scope] = await run.storage.getScopesByAddress([address]);
    const role = scope ? await run.roleOn(scope) : knowledgeRoleOn(run.runtime.compiled, run.principals, { address });
    if (!knowledgeRoleAtLeast(role, 'editor')) {
      throw new Error(`Pinning for "${address}" needs holding it or editor on it; this run has neither.`);
    }
  }
}

function searchTool(host: KnowledgePageToolHost) {
  return createTool({
    id: 'knowledge_search',
    description:
      'Search the knowledge this run can read: page names, descriptions, bodies and notes. Optional `scope` narrows to pages in those scopes.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', minLength: 1, description: 'What to look for.' },
        scope: { ...scopeListSchema, description: 'Only search pages in these scopes (addresses).' },
        limit: { ...limitSchema, description: 'Maximum results. Defaults to 10.' },
      },
      required: ['query'],
      additionalProperties: false,
    } satisfies JSONSchema7,
    execute: async (input, context) => {
      const { query, scope, limit } = input as { query: string; scope?: string[]; limit?: number };
      const run = await start(host, context);
      const scopeIds = scope ? (await readableScopes(run, scope)).map(page => page.id) : undefined;
      const max = limitOf(limit);
      const lexical = await run.storage.searchPages({ query, read: run.read, scopeIds, limit: max });
      let hits = lexical;
      if (host.semantic) {
        const inScope = (page: KnowledgePage) => !scopeIds || scopeIds.includes(page.scopeId);
        // Every vector hit is re-read under the run's read scope before it can take a slot.
        const semantic = await host.semantic
          .search<KnowledgePageSearchHit>(query, max, async candidate => {
            if (candidate.kind === 'page') {
              const page = await run.storage.getPage({ id: candidate.id, read: run.read });
              return page && !page.deletedAt && !page.isScope && inScope(page) ? { type: 'page', page } : null;
            }
            const note = await run.storage.getNote({ id: candidate.id, read: run.read });
            if (!note || note.deletedAt) return null;
            const page = await run.storage.getPage({ id: note.pageId, read: run.read });
            return page && !page.deletedAt && inScope(page) ? { type: 'note', page, note } : null;
          })
          // Keyword results still answer when the embedder or vector store is down.
          .catch(error => {
            host.warn?.(`Knowledge semantic search failed; returning keyword results only: ${String(error)}`);
            return [];
          });
        const fused = new Map<string, { hit: KnowledgePageSearchHit; score: number }>();
        for (const list of [lexical, semantic]) {
          list.forEach((hit, rank) => {
            const key = hit.type === 'page' ? `page:${hit.page.id}` : `note:${hit.note.id}`;
            const entry = fused.get(key) ?? { hit, score: 0 };
            entry.score += 1 / (RRF_K + rank + 1);
            fused.set(key, entry);
          });
        }
        hits = [...fused.values()]
          .sort((a, b) => b.score - a.score)
          .slice(0, max)
          .map(entry => entry.hit);
      }
      const addresses = await scopeAddresses(
        run,
        hits.map(hit => hit.page),
      );
      return {
        results: hits.map(hit =>
          hit.type === 'page'
            ? { type: 'page' as const, page: pageSummary(hit.page, addresses) }
            : { type: 'note' as const, page: pageSummary(hit.page, addresses), note: noteSummary(hit.note) },
        ),
      };
    },
  });
}

function readTool(host: KnowledgePageToolHost) {
  return createTool({
    id: 'knowledge_read',
    description:
      'Read a page: its body, its notes, its child pages and the notes on other pages that mention it. Read a scope address (org:acme) to browse that scope. Without `page`, lists the scopes this run holds.',
    inputSchema: {
      type: 'object',
      properties: {
        page: { type: 'string', minLength: 1, description: pageRefDescription },
        cursor: { type: 'string', minLength: 1, description: "The previous result's nextCursor, for more notes." },
        limit: { ...limitSchema, description: 'Maximum notes and children. Defaults to 10.' },
      },
      additionalProperties: false,
    } satisfies JSONSchema7,
    execute: async (input, context) => {
      const { page: ref, cursor, limit: requested } = input as { page?: string; cursor?: string; limit?: number };
      const run = await start(host, context);
      const limit = limitOf(requested);
      if (!ref) {
        const held = await run.storage.getScopesByAddress(run.principals);
        return {
          scopes: held
            .filter(scope => knowledgeScopeReadable(scope, run.read))
            .map(scope => ({
              address: scope.address,
              name: scope.name,
              ...(scope.description ? { description: scope.description } : {}),
            })),
        };
      }

      const page = await run.page(ref);
      const [notes, children, mentioning] = await Promise.all([
        run.storage.listNotes({ pageId: page.id, read: run.read, cursor, limit }),
        run.storage.listChildPages({ parentId: page.id, read: run.read, limit }),
        run.storage.listNotesMentioning({ pageId: page.id, read: run.read, limit }),
      ]);
      let childScopes: Array<{ address?: string; name: string; description?: string; restricted?: true }> = [];
      if (page.isScope) {
        const ownsParent = (await run.roleOn(page)) === 'owner';
        const { pages } = await run.storage.listChildScopes({ parentId: page.id, limit });
        childScopes = pages.flatMap(scope => {
          const readable = knowledgeScopeReadable(scope, run.read);
          if (!readable && !ownsParent) return [];
          return [
            {
              address: scope.address,
              name: scope.name,
              ...(scope.description ? { description: scope.description } : {}),
              ...(readable ? {} : { restricted: true as const }),
            },
          ];
        });
      }
      const mentionPages = await Promise.all(
        mentioning.notes.map(note => run.storage.getPage({ id: note.pageId, read: run.read })),
      );
      const addresses = await scopeAddresses(run, [
        page,
        ...children.pages,
        ...mentionPages.filter((p): p is KnowledgePage => p !== null),
      ]);
      return {
        page: {
          ...pageSummary(page, addresses),
          version: page.version,
          ...(page.body ? { body: page.body } : {}),
        },
        notes: notes.notes.map(noteSummary),
        ...(notes.nextCursor ? { nextCursor: notes.nextCursor } : {}),
        children: children.pages.map(child => pageSummary(child, addresses)),
        ...(childScopes.length ? { childScopes } : {}),
        mentionedIn: mentioning.notes.map((note, i) => ({
          ...noteSummary(note),
          page: mentionPages[i] ? pageSummary(mentionPages[i]!, addresses) : undefined,
        })),
      };
    },
  });
}

type PageInput = {
  op: 'write' | 'move' | 'merge';
  page?: string;
  scope?: string;
  parent?: string;
  into?: string;
  key?: string;
  name?: string;
  description?: string;
  body?: string;
  expectedVersion?: number;
};

function pageTool(host: KnowledgePageToolHost) {
  return createTool({
    id: 'knowledge_page',
    description:
      'Write, move or merge pages. A page body is the curated summary of its topic (needs editor to change); discrete attributed details belong in notes (knowledge_note). ' +
      'op "write": with `page`, edits that page (name, description, body); without `page`, creates a page named `name` in `scope`. ' +
      'op "move": moves `page` under `parent` or to the top of `scope`. op "merge": merges `page` into `into`, keeping both pages\' notes. ' +
      '`scope` is only for where content lands (create, move destination); edits and merges take none.',
    inputSchema: {
      type: 'object',
      properties: {
        op: { type: 'string', enum: ['write', 'move', 'merge'] },
        page: { type: 'string', minLength: 1, description: `The page to edit, move or merge. ${pageRefDescription}` },
        scope: { type: 'string', minLength: 1, description: 'Create: the home scope. Move: the destination scope.' },
        parent: { type: 'string', minLength: 1, description: 'Create or move: a parent page in that scope.' },
        into: { type: 'string', minLength: 1, description: 'Merge: the page that remains.' },
        key: {
          type: 'string',
          minLength: 1,
          description:
            'Create: one key segment, unique among the page\'s siblings, without "/", "#" or "%". `parent` gives the rest of its path.',
        },
        name: { type: 'string', minLength: 1 },
        description: { type: 'string', description: 'A short synopsis (about 100 tokens). Empty clears it.' },
        body: { type: 'string', description: 'The curated long-form summary.' },
        expectedVersion: {
          type: 'integer',
          minimum: 1,
          description: 'The version you read; the write is refused if the page changed since.',
        },
      },
      required: ['op'],
      additionalProperties: false,
    } satisfies JSONSchema7,
    execute: async (input, context) => {
      const args = input as PageInput;
      const run = await start(host, context);
      const { storage, provenance } = run;
      const addresses = new Map<string, string>();
      const done = async (page: KnowledgePage) => {
        for (const [id, address] of await scopeAddresses(run, [page])) addresses.set(id, address);
        return { page: { ...pageSummary(page, addresses), version: page.version } };
      };

      if (args.op === 'write') {
        if (args.page) {
          if (args.scope || args.parent || args.key) {
            throw new Error('Editing a page takes no scope, parent or key; use op "move" to relocate it.');
          }
          if (args.name === undefined && args.description === undefined && args.body === undefined) {
            throw new Error('Editing a page needs at least one of name, description or body.');
          }
          const page = await run.page(args.page);
          await run.require(await run.scopeOf(page), 'editor', 'Editing a page');
          const updated = await storage.updatePage({
            id: page.id,
            expectedVersion: args.expectedVersion ?? page.version,
            name: args.name,
            description: args.description,
            body: args.body,
            provenance,
          });
          await reindex(host, index => index.indexPage(updated));
          return done(updated);
        }
        if (!args.scope || !args.name) throw new Error('Creating a page needs scope and name.');
        const scope = await run.targetScope(args.scope, 'contributor', 'Creating a page');
        const parent = args.parent ? await run.page(args.parent) : scope;
        if (parent.id !== scope.id && parent.scopeId !== scope.id) {
          throw new Error(`Parent "${args.parent}" is not in scope "${args.scope}".`);
        }
        const created = await storage.createPage({
          parentId: parent.id,
          key: args.key,
          name: args.name,
          description: args.description,
          body: args.body,
          provenance,
        });
        await reindex(host, index => index.indexPage(created));
        return done(created);
      }

      if (!args.page) throw new Error(`op "${args.op}" needs page.`);
      const page = await run.page(args.page);
      const home = await run.scopeOf(page);

      if (args.op === 'move') {
        if (!args.scope) throw new Error('Moving a page needs the destination scope.');
        const crossScope = args.scope !== home.address;
        const destination = crossScope
          ? await run.targetScope(args.scope, 'owner', 'Moving a page across scopes')
          : home;
        await run.require(home, crossScope ? 'owner' : 'editor', 'Moving a page');
        const parent = args.parent ? await run.page(args.parent) : destination;
        if (parent.id !== destination.id && parent.scopeId !== destination.id) {
          throw new Error(`Parent "${args.parent}" is not in scope "${args.scope}".`);
        }
        return done(
          await storage.movePage({
            id: page.id,
            expectedVersion: args.expectedVersion ?? page.version,
            parentId: parent.id,
            provenance,
          }),
        );
      }

      if (!args.into) throw new Error('Merging needs into: the page that remains.');
      const target = await run.page(args.into);
      await run.require(home, 'owner', 'Merging a page away');
      await run.require(await run.scopeOf(target), 'editor', 'Merging into a page');
      const merged = await storage.mergePages({
        sourceId: page.id,
        sourceVersion: args.expectedVersion ?? page.version,
        targetId: target.id,
        provenance,
      });
      await reindex(host, index => index.remove([`page:${page.id}`]));
      return done(merged);
    },
  });
}

type NoteInput = {
  op: 'add' | 'restamp' | 'remove';
  page?: string;
  note?: string;
  scope?: string[];
  text?: string;
  when?: string;
};

function noteTool(host: KnowledgePageToolHost) {
  return createTool({
    id: 'knowledge_note',
    description:
      'Add a discrete, durable piece of knowledge to a page: something true or useful that someone else should be able to rely on later. Not for scratch work, to-dos, or comments about the page itself. ' +
      'Good, on "Refund Policy": "Refunds over $500 need a manager\'s approval (confirmed with finance, May 2026)." Bad: "Need to look into refunds later." ' +
      'Link other pages with [[Page Name]]. `scope` lists the stamp scopes that may see the note (any of them); a note on a shared page stamped with a narrower scope stays private to that scope. ' +
      'op "add": adds `text` to `page`. op "restamp": replaces a note\'s stamp scopes. op "remove": removes a note. Removing then re-adding creates a new note id and resets its history.',
    inputSchema: {
      type: 'object',
      properties: {
        op: { type: 'string', enum: ['add', 'restamp', 'remove'] },
        page: { type: 'string', minLength: 1, description: `Add: the page. ${pageRefDescription}` },
        note: { type: 'string', minLength: 1, description: 'Restamp or remove: the note id.' },
        scope: { ...scopeListSchema, description: 'Add or restamp: the stamp scopes (addresses).' },
        text: { type: 'string', minLength: 1, description: 'Add: the note, about 250 tokens at most.' },
        when: {
          type: 'string',
          description:
            'Add: when it was true or observed, as an ISO 8601 date (2026-10-29) or date-time (2026-10-29T14:00:00Z).',
        },
      },
      required: ['op'],
      additionalProperties: false,
    } satisfies JSONSchema7,
    execute: async (input, context) => {
      const args = input as NoteInput;
      const run = await start(host, context);
      const { storage, provenance } = run;
      const stamps = async (action: string) => {
        if (!args.scope?.length) throw new Error(`${action} needs scope: the stamp scopes.`);
        const scopes: KnowledgePage[] = [];
        for (const address of new Set(args.scope)) scopes.push(await run.targetScope(address, 'contributor', action));
        return scopes.map(scope => scope.id);
      };

      if (args.op === 'add') {
        if (!args.page || !args.text) throw new Error('Adding a note needs page and text.');
        const when = args.when ? new Date(args.when) : undefined;
        if (when && Number.isNaN(when.getTime())) throw new Error(`Invalid when: "${args.when}".`);
        const page = await run.page(args.page);
        await run.require(await run.scopeOf(page), 'contributor', 'Adding a note');
        const stampScopeIds = await stamps('Adding a note');
        const note = await storage.addNote({
          pageId: page.id,
          text: args.text,
          when,
          stampScopeIds,
          mentions: await resolveMentions(run, args.text),
          provenance,
        });
        await reindex(host, index => index.indexNote(note));
        return { note: noteSummary(note), page: page.id };
      }

      if (!args.note) throw new Error(`op "${args.op}" needs note.`);
      const { note, page } = await visibleNote(run, args.note);
      await run.require(
        await run.scopeOf(page),
        'editor',
        args.op === 'remove' ? 'Removing a note' : 'Restamping a note',
      );
      if (args.op === 'restamp') {
        const restamped = await storage.restampNote({
          id: note.id,
          expectedVersion: note.version,
          stampScopeIds: await stamps('Restamping a note'),
          provenance,
        });
        return { note: noteSummary(restamped), page: page.id };
      }
      await storage.removeNote({ id: note.id, deletedBy: provenance.author, provenance });
      await reindex(host, index => index.remove([`note:${note.id}`]));
      return { removed: note.id };
    },
  });
}

function pinTool(host: KnowledgePageToolHost, onChange?: (context: unknown) => void) {
  return createTool({
    id: 'knowledge_pin',
    description:
      'Pin a page into the context of every run holding one of the audience scopes, every turn; or unpin it. Pinned pages cost tokens on every turn: pin only standing instructions, durable preferences and hard constraints that apply without being asked for. ' +
      "Needs editor on the page's scope and, for each audience, holding it or editor on it. A pinned page is delivered only to runs that can read it.",
    inputSchema: {
      type: 'object',
      properties: {
        op: { type: 'string', enum: ['pin', 'unpin'] },
        page: { type: 'string', minLength: 1, description: pageRefDescription },
        audience: { ...scopeListSchema, description: 'Scope addresses whose runs receive the pin.' },
      },
      required: ['op', 'page', 'audience'],
      additionalProperties: false,
    } satisfies JSONSchema7,
    execute: async (input, context) => {
      const { op, page: ref, audience } = input as { op: 'pin' | 'unpin'; page: string; audience: string[] };
      const run = await start(host, context);
      const page = await run.page(ref);
      await run.require(await run.scopeOf(page), 'editor', op === 'pin' ? 'Pinning a page' : 'Unpinning a page');
      await requireAudienceAuthority(run, audience);
      const author = run.provenance.author;
      const pin =
        op === 'pin'
          ? await run.storage.addPinAudience({ pageId: page.id, audience, createdBy: author })
          : await run.storage.removePinAudience({ pageId: page.id, audience, removedBy: author });
      onChange?.(context);
      return { page: page.id, audience: pin?.audience ?? [] };
    },
  });
}

/** The schema-4 Knowledge tools. @internal */
export function buildKnowledgePageTools(
  host: KnowledgePageToolHost,
  groups: KnowledgePageToolGroups,
  onPinChange?: (context: unknown) => void,
): Tools {
  const tools: Tools = {};
  if (groups.read) {
    tools.knowledge_search = searchTool(host);
    tools.knowledge_read = readTool(host);
  }
  if (groups.write) {
    tools.knowledge_page = pageTool(host);
    tools.knowledge_note = noteTool(host);
  }
  if (groups.pins) tools.knowledge_pin = pinTool(host, onPinChange);
  return tools;
}
