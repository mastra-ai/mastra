import type { JSONSchema7 } from 'json-schema';
import { estimateTokenCount } from 'tokenx';
import type {
  KnowledgeNote,
  KnowledgePage,
  KnowledgePageSearchHit,
  KnowledgePinKind,
  KnowledgeStorage,
} from '../storage/domains/knowledge';
import {
  KnowledgePageHasChildrenError,
  knowledgeScopeReadable,
  MAX_KNOWLEDGE_PIN_LIST_DEPTH,
} from '../storage/domains/knowledge';
import type { ToolAction } from '../tools';
import { createTool } from '../tools';
import { knowledgeRoleOn } from './access';
import { knowledgeRoleAtLeast } from './declarations';
import { refreshKnowledgeLinksTo, syncKnowledgePageBodyLinks, updateKnowledgeLinks } from './links';
import {
  KNOWLEDGE_READ_BODY_TOKENS,
  KNOWLEDGE_READ_INLINE_TOKENS,
  KNOWLEDGE_READ_OUTLINE_ENTRIES,
  KNOWLEDGE_READ_REST_OUTLINE_TOKENS,
  knowledgeBodySkeleton,
  KnowledgeBodyLines,
  knowledgeBodyGrep,
  knowledgeBodyOutline,
  knowledgeBodySection,
  knowledgeBodyWindow,
} from './page-body';
import type { KnowledgeLinePosition, KnowledgeLineRange } from './page-body';
import { knowledgePageRefs } from './page-refs';
import type { KnowledgePageRefs } from './page-refs';
import { KnowledgeNotFoundError, KnowledgeRun } from './run';
import type { KnowledgeRunContext } from './run';
import type { KnowledgeScopeRuntime } from './scope-runtime';
import { knowledgeEmbedFailedWarning } from './semantic';
import type { KnowledgeSemanticIndex } from './semantic';

/** What the page tools need from their Knowledge. @internal */
export interface KnowledgePageToolHost {
  runtime: KnowledgeScopeRuntime;
  getStorage(): Promise<KnowledgeStorage>;
  /** Set when Knowledge has a vector store and embedder: search is hybrid and writes are embedded. */
  semantic?: KnowledgeSemanticIndex;
  warn?: (message: string) => void;
  /** Most estimated tokens one read, match or list result returns; defaults to {@link KNOWLEDGE_READ_BODY_TOKENS}. */
  maxTokens?: number;
}

function maxTokensOf(host: KnowledgePageToolHost): number {
  return host.maxTokens ?? KNOWLEDGE_READ_BODY_TOKENS;
}

/** Search re-reads every vector hit, so a vector left behind by a removed page or note never surfaces. */
const UNEMBED_FAILED =
  'Knowledge semantic index removal failed; the removed content may keep its vectors, but search skips content that no longer exists';

/** Embeds after a committed write. A failure only costs recall, so it warns instead of failing the write. */
async function embed(
  host: KnowledgePageToolHost,
  work: (index: KnowledgeSemanticIndex) => Promise<void>,
  failure: string | (() => Promise<string>),
) {
  if (!host.semantic) return;
  try {
    await work(host.semantic);
  } catch (error) {
    host.warn?.(`${typeof failure === 'string' ? failure : await failure()}: ${String(error)}`);
  }
}

/** The embed-failure warning for `page`, naming its ref; only looked up when every try failed. */
function pageEmbedFailed(storage: KnowledgeStorage, page: KnowledgePage): () => Promise<string> {
  return async () => {
    const { refs } = await knowledgePageRefs(storage, 'all', [page]).catch(() => ({ refs: new Map<string, string>() }));
    return knowledgeEmbedFailedWarning(`page "${refs.get(page.id) ?? page.id}"`);
  };
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
/** Misses a note's mention linking may spend beyond its stored mentions (renamed or ambiguous refs). */
const MENTION_LOOKUP_SLACK = 2;

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

/** A read run creates no scope pages; a write run materializes (and late-links) the scopes it holds. */
async function start(host: KnowledgePageToolHost, context: unknown, write = false): Promise<KnowledgeRun> {
  return KnowledgeRun.start(host.runtime, await host.getStorage(), context as KnowledgeRunContext | undefined, {
    write,
  });
}

/** Full refs and scope addresses for pages a response shows. */
function pageRefs(run: KnowledgeRun, pages: KnowledgePage[]): Promise<KnowledgePageRefs> {
  return knowledgePageRefs(run.storage, run.read, pages);
}

/** A page as tools show it; `ref` is the full ref `knowledge_read` takes (scope address, `<scope>#<key>/<key>…`, or id). */
function pageSummary(page: KnowledgePage, { refs, scopes }: KnowledgePageRefs) {
  return {
    id: page.id,
    name: page.name,
    ref: refs.get(page.id) ?? page.id,
    ...(page.isScope ? { address: page.address } : { scope: scopes.get(page.scopeId) }),
    ...(page.description ? { description: page.description } : {}),
  };
}

function noteSummary(note: KnowledgeNote, mentions?: Record<string, string>) {
  return {
    id: note.id,
    text: note.text,
    ...(note.when ? { when: note.when.toISOString() } : {}),
    author: note.provenance.author,
    ...(mentions ? { mentions } : {}),
  };
}

/** Ref → page id (or null when it didn't resolve), shared by the notes of one tool response. */
type MentionCache = Map<string, string | null>;

/**
 * Which `[[ref]]` in a note's text names which page id, for a caller that links them. Each ref is
 * resolved the way the note's write resolved it and kept only when it lands on one of the note's
 * stored mentions; refs that no longer resolve (a renamed page) stay plain text. Lookups are
 * bounded: refs are cached across the response, resolving stops once every stored mention is
 * linked, and a note gets at most a couple of misses beyond its stored mentions.
 */
async function noteMentions(
  run: KnowledgeRun,
  note: KnowledgeNote,
  cache: MentionCache = new Map(),
): Promise<Record<string, string> | undefined> {
  if (!note.mentions.length) return undefined;
  // Null prototype, so `[[constructor]]` or `[[toString]]` is looked up like any other ref.
  const links: Record<string, string> = Object.create(null);
  const linked = new Set<string>();
  let lookups = 0;
  const maxLookups = note.mentions.length + MENTION_LOOKUP_SLACK;
  for (const [, raw] of note.text.matchAll(MENTION)) {
    if (linked.size === note.mentions.length) break;
    const ref = (raw ?? '').trim();
    if (ref in links) continue;
    let id = cache.get(ref);
    if (id === undefined) {
      if (lookups >= maxLookups) break;
      lookups++;
      try {
        id = (await run.page(ref)).id;
      } catch {
        // Not found or now ambiguous: leave it as text.
        id = null;
      }
      cache.set(ref, id);
    }
    if (id && note.mentions.includes(id)) {
      links[ref] = id;
      linked.add(id);
    }
  }
  return Object.keys(links).length ? links : undefined;
}

async function noteSummaries(run: KnowledgeRun, notes: KnowledgeNote[], cache: MentionCache = new Map()) {
  const summaries = [];
  for (const note of notes) summaries.push(noteSummary(note, await noteMentions(run, note, cache)));
  return summaries;
}

/** Scope pages for addresses the run names; each must be readable. */
async function readableScopes(run: KnowledgeRun, addresses: string[]): Promise<KnowledgePage[]> {
  const page = addresses.find(address => address.includes('#'));
  if (page) {
    throw new Error(
      `"${page}" is a page ref, not a scope. scope takes scope addresses such as "${page.slice(0, page.indexOf('#'))}"; to see what is under the page, use knowledge_list with from: "${page}".`,
    );
  }
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
      // Keyword search has no quoting: a quote mark would be matched as a literal character, so
      // `"api" "responses"` would find nothing. Search the quoted words instead.
      const words = query.replace(/["`\u201C\u201D]/g, ' ').trim();
      const lexical = words
        ? await run.storage.searchPages({ query: words, read: run.read, scopeIds, limit: max })
        : [];
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
      const addresses = await pageRefs(
        run,
        hits.map(hit => hit.page),
      );
      const mentionCache: MentionCache = new Map();
      return {
        results: await Promise.all(
          hits.map(async hit =>
            hit.type === 'page'
              ? { type: 'page' as const, page: pageSummary(hit.page, addresses) }
              : {
                  type: 'note' as const,
                  page: pageSummary(hit.page, addresses),
                  note: noteSummary(hit.note, await noteMentions(run, hit.note, mentionCache)),
                },
          ),
        ),
        ...(hits.length === 0
          ? {
              more: [
                `results: no page or note contains any word of ${JSON.stringify(words || query)}. Search again with different key words, or browse with knowledge_list.`,
              ],
            }
          : hits.length === max
            ? {
                more: [
                  max < MAX_LIMIT
                    ? `results: showing the top ${max}. If none of these is what you need, narrow the query, raise the limit (up to ${MAX_LIMIT}), or browse with knowledge_list.`
                    : `results: showing the top ${max}, the most one search returns. Narrow the query or scope, or browse with knowledge_list.`,
                ],
              }
            : {}),
      };
    },
  });
}

/** Estimated tokens a list adds to a `knowledge_read` result. */
function inlineSize(list: unknown[]): number {
  return list.length ? estimateTokenCount(JSON.stringify(list)) : 0;
}

/** "10 notes", or "more than 10 notes" when a cursor says there are more. */
function leftOut(count: number, hasMore: boolean, noun: string): string {
  return `${hasMore ? 'more than ' : ''}${count} ${noun}${count === 1 && !hasMore ? '' : 's'}`;
}

/** Lines shown before and after each `match` hit unless `context` says otherwise, and the most it may ask for. */
const KNOWLEDGE_READ_MATCH_CONTEXT = 2;
const KNOWLEDGE_READ_MATCH_CONTEXT_MAX = 20;

const linePositionSchema: JSONSchema7 = {
  type: 'object',
  properties: {
    line: { type: 'integer', minimum: 1 },
    col: { type: 'integer', minimum: 0 },
  },
  required: ['line'],
  additionalProperties: false,
};

/** How `from` was given, for telling the reader how to go on. */
function fromText(at: KnowledgeLinePosition): string {
  return JSON.stringify(at.col ? { line: at.line, col: at.col } : { line: at.line });
}

/** What `knowledge_read` returns of a body: the whole of it, its outline, a section or matches, a window at a time. */
function bodyView(
  body: string,
  input: {
    outline?: boolean;
    section?: string;
    match?: string[];
    context: number;
    from?: KnowledgeLinePosition;
    more: string[];
    maxTokens: number;
  },
): {
  body?: string;
  lines?: string;
  range?: KnowledgeLineRange;
  lineCount?: number;
  outline?: ReturnType<typeof knowledgeBodyOutline>;
  matches?: Array<{ range: KnowledgeLineRange; lines: string }>;
} {
  const { more } = input;
  if (!body) {
    if (input.outline || input.section || input.match) more.push('body: the page has no body.');
    return {};
  }
  if (input.outline) {
    const outline = knowledgeBodyOutline(body);
    if (outline.length > KNOWLEDGE_READ_OUTLINE_ENTRIES) {
      more.push(
        `outline: showing ${KNOWLEDGE_READ_OUTLINE_ENTRIES} of ${outline.length} headings. Read a section to see the headings under it.`,
      );
    }
    if (!outline.length) more.push('outline: the body has no headings. Read it by line with from instead.');
    return { outline: outline.slice(0, KNOWLEDGE_READ_OUTLINE_ENTRIES) };
  }
  const lines = new KnowledgeBodyLines(body);
  const from = input.from ? lines.startOffset(input.from) : 0;
  if (input.match) {
    const parts = knowledgeBodyGrep(lines, input.match, input.context, from);
    if (!parts.length) {
      more.push(
        `match: no line${input.from ? ` from line ${input.from.line}` : ''} contains ${input.match.map(term => JSON.stringify(term)).join(' or ')}.`,
      );
      return { matches: [], lineCount: lines.count };
    }
    const matches: Array<{ range: KnowledgeLineRange; lines: string }> = [];
    let tokens = 0;
    for (const part of parts) {
      const shown = lines.numbered(part.start, part.end);
      tokens += estimateTokenCount(shown);
      if (matches.length && tokens > input.maxTokens) {
        more.push(
          `match: stopped at about ${input.maxTokens.toLocaleString('en-US')} tokens; more matches from line ${lines.lineAt(part.start)}. Read again with the same match and from: ${fromText({ line: lines.lineAt(part.start) })}.`,
        );
        break;
      }
      matches.push({
        range: { start: lines.startPosition(part.start), end: lines.endPosition(part.end) },
        lines: shown,
      });
    }
    return { matches, lineCount: lines.count };
  }
  let start = from;
  let limit = body.length;
  let again = '';
  if (input.section) {
    const found = knowledgeBodySection(body, input.section);
    if ('candidates' in found) {
      const headings = found.candidates.map(title => `"${title}"`).join(', ');
      throw new Error(
        `knowledge_read: no section titled "${input.section}". ${headings ? `Headings include: ${headings}.` : 'The body has no headings.'}`,
      );
    }
    limit = found.section.end;
    if (body.endsWith('\n', limit) && limit > found.section.start) limit--;
    if (from > limit) {
      throw new Error(
        `knowledge_read: line ${input.from!.line} is past the end of section "${found.section.title}", which ends at line ${lines.lineAt(limit)}.`,
      );
    }
    start = Math.max(from, found.section.start);
    again = `section: ${JSON.stringify(input.section)}, `;
  }
  const window = knowledgeBodyWindow(lines, start, limit, input.maxTokens);
  // A whole body that fits comes as it is; any part comes numbered, with the range a write takes back.
  if (!input.section && start === 0 && window.next === undefined) return { body };
  // A first read cut short shows the whole body at a glance instead: every heading with its line
  // number and the first lines under it, so the reader can go straight to the section it needs.
  if (window.next !== undefined && !input.section && !input.from) {
    const headings = knowledgeBodyOutline(body);
    const skeleton = headings.length
      ? knowledgeBodySkeleton(
          lines,
          headings.map(heading => heading.line),
          input.maxTokens,
        )
      : undefined;
    if (skeleton !== undefined) {
      more.push(
        `body: the page is ${lines.count} lines, too long to show whole, so \`lines\` shows every heading and the first lines under it; ⋯ marks lines left out and … a line cut short. Read the part you need with section (a heading) or from (a line number), then answer. To edit, read that part first: this view has no range to write back.`,
      );
      return { lines: skeleton, lineCount: lines.count };
    }
  }
  const range = { start: lines.startPosition(window.start), end: lines.endPosition(window.end) };
  // A first read cut short also lists the headings it did not reach, so the reader can go
  // straight to the section it needs instead of paging toward it line by line.
  const below =
    window.next !== undefined && !input.section && !input.from
      ? knowledgeBodyOutline(body).filter(heading => heading.line > range.end.line)
      : [];
  const outline: typeof below = [];
  let outlineTokens = 0;
  for (const heading of below) {
    outlineTokens += estimateTokenCount(JSON.stringify(heading));
    if (outlineTokens > KNOWLEDGE_READ_REST_OUTLINE_TOKENS) break;
    outline.push(heading);
  }
  if (window.next !== undefined) {
    const next = lines.startPosition(window.next);
    more.push(
      outline.length
        ? `body: showing lines ${range.start.line}–${range.end.line} of ${lines.count}. \`outline\` lists the ${outline.length < below.length ? `first ${outline.length} of ${below.length} headings below (all of them with outline: true)` : 'headings below'}; read the one you need with section, or read on with from: ${fromText(next)}.`
        : `body: showing lines ${range.start.line}–${range.end.line} of ${lines.count}. Read on with ${again}from: ${fromText(next)}.`,
    );
  }
  return {
    lines: lines.numbered(window.start, window.end),
    range,
    lineCount: lines.count,
    ...(outline.length ? { outline } : {}),
  };
}

function readTool(host: KnowledgePageToolHost) {
  return createTool({
    id: 'knowledge_read',
    description:
      'Read a page: its body, its notes, its child pages and the notes on other pages that mention it. Read a scope address (org:acme) to browse that scope. Without `page`, lists the scopes this run holds. ' +
      `When a page's notes, or the notes mentioning it, come to more than ${KNOWLEDGE_READ_INLINE_TOKENS.toLocaleString('en-US')} tokens, a whole read leaves them out and counts them in \`more\`; read them on their own with \`notes\` or \`mentionedIn\`. ` +
      `A body returns at most ${maxTokensOf(host).toLocaleString('en-US')} tokens at a time. A body that fits comes whole as \`body\`; a longer one comes as numbered \`lines\` (\`12│text\`) with the \`range\` they cover, and \`more\` says where to read on; a first read of a long page shows every heading with its line number and the first lines under it, so you can pick the part to read. ` +
      'For a long page, ask for its `outline` of headings with their line numbers, read one `section`, or `match` terms to see only the lines that contain them, with `context` lines around each. ' +
      'Those part reads return just that part of the body. To edit part of a long body, pass the `range` a read gave you to knowledge_page.',
    inputSchema: {
      type: 'object',
      properties: {
        page: { type: 'string', minLength: 1, description: pageRefDescription },
        notes: {
          type: 'boolean',
          description: "Return only the page's notes, however long, without its body.",
        },
        mentionedIn: {
          type: 'boolean',
          description: 'Return only the notes on other pages that mention this page, however long, without its body.',
        },
        cursor: {
          type: 'string',
          minLength: 1,
          description: "The previous result's nextCursor: returns only the next notes.",
        },
        mentionedInCursor: {
          type: 'string',
          minLength: 1,
          description: "The previous result's mentionedInCursor: returns only the next notes that mention this page.",
        },
        outline: {
          type: 'boolean',
          description: "Return the body's headings with their sizes in tokens instead of the body.",
        },
        section: {
          type: 'string',
          minLength: 1,
          description:
            'Return only the section under this heading (its title, or a unique part of it), subsections included.',
        },
        match: {
          anyOf: [
            { type: 'string', minLength: 1 },
            { type: 'array', items: { type: 'string', minLength: 1 }, minItems: 1, maxItems: 10 },
          ],
          description:
            'Like grep: return only the lines that contain this term, or any of these terms (case-insensitive), as numbered lines with the range each covers.',
        },
        context: {
          type: 'integer',
          minimum: 0,
          maximum: KNOWLEDGE_READ_MATCH_CONTEXT_MAX,
          description: `With \`match\`: how many lines to show before and after each matching line, like grep -C. Defaults to ${KNOWLEDGE_READ_MATCH_CONTEXT}.`,
        },
        from: {
          ...linePositionSchema,
          description:
            "Where to start reading: a line (counted from 1) and, inside a very long line, a column (counted from 0). The read runs from there to the page's end or the read's token cap, whichever comes first; there is no line count to set. In a section, reads on within it; with `match`, searches from there. `more` gives it when a read stops early.",
        },
        limit: {
          ...limitSchema,
          description:
            'Maximum notes, children and mentioning notes. Defaults to 10. Not a line count: how much of the body comes back is set by the token cap.',
        },
      },
      additionalProperties: false,
    } satisfies JSONSchema7,
    execute: async (input, context) => {
      const {
        page: ref,
        notes: notesOnly,
        mentionedIn: mentionedInOnly,
        cursor,
        mentionedInCursor,
        outline,
        section,
        match: matchInput,
        context: matchContext = KNOWLEDGE_READ_MATCH_CONTEXT,
        from,
        limit: requested,
      } = input as {
        page?: string;
        notes?: boolean;
        mentionedIn?: boolean;
        cursor?: string;
        mentionedInCursor?: string;
        outline?: boolean;
        section?: string;
        match?: string | string[];
        context?: number;
        from?: KnowledgeLinePosition;
        limit?: number;
      };
      const match = matchInput === undefined ? undefined : typeof matchInput === 'string' ? [matchInput] : matchInput;
      if ([outline, section, match].filter(Boolean).length > 1) {
        throw new Error('knowledge_read: pass at most one of outline, section and match.');
      }
      const wantNotes = !!(notesOnly || cursor);
      const wantMentions = !!(mentionedInOnly || mentionedInCursor);
      if ((wantNotes || wantMentions) && (outline || section || match || from)) {
        throw new Error(
          'knowledge_read: read notes or mentionedIn on their own, without outline, section, match or from.',
        );
      }
      if (outline && from) throw new Error('knowledge_read: an outline covers the whole body; pass it without from.');
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

      const page = await run.pageOrCloseMatches(ref);
      // A part of the body (outline, section, matches, or a later window) comes alone: the notes,
      // children and mentions came with the first read and would only repeat.
      if (outline || section || match || from) {
        const more: string[] = [];
        const view = bodyView(page.body ?? '', {
          outline,
          section,
          match,
          context: matchContext,
          from,
          more,
          maxTokens: maxTokensOf(host),
        });
        return {
          page: { ...pageSummary(page, await pageRefs(run, [page])), version: page.version, ...view },
          ...(more.length ? { more } : {}),
        };
      }
      // Notes or mentioning notes asked for by name (or by cursor) come alone, whatever their size.
      if (wantNotes || wantMentions) {
        const [notes, mentioning] = await Promise.all([
          wantNotes ? run.storage.listNotes({ pageId: page.id, read: run.read, cursor, limit }) : undefined,
          wantMentions
            ? run.storage.listNotesMentioning({ pageId: page.id, read: run.read, cursor: mentionedInCursor, limit })
            : undefined,
        ]);
        const mentionPages = await Promise.all(
          (mentioning?.notes ?? []).map(note => run.storage.getPage({ id: note.pageId, read: run.read })),
        );
        const addresses = await pageRefs(run, [page, ...mentionPages.filter((p): p is KnowledgePage => p !== null)]);
        const mentionCache: MentionCache = new Map();
        const more: string[] = [];
        if (notes?.nextCursor) more.push(`notes: more than ${limit}. Read again with cursor: "${notes.nextCursor}".`);
        if (mentioning?.nextCursor) {
          more.push(`mentionedIn: more than ${limit}. Read again with mentionedInCursor: "${mentioning.nextCursor}".`);
        }
        return {
          page: { ...pageSummary(page, addresses), version: page.version },
          ...(notes
            ? {
                notes: await noteSummaries(run, notes.notes, mentionCache),
                ...(notes.nextCursor ? { nextCursor: notes.nextCursor } : {}),
              }
            : {}),
          ...(mentioning
            ? {
                mentionedIn: (await noteSummaries(run, mentioning.notes, mentionCache)).map((note, i) => ({
                  ...note,
                  page: mentionPages[i] ? pageSummary(mentionPages[i]!, addresses) : undefined,
                })),
                ...(mentioning.nextCursor ? { mentionedInCursor: mentioning.nextCursor } : {}),
              }
            : {}),
          ...(more.length ? { more } : {}),
        };
      }
      const [notes, children, mentioning] = await Promise.all([
        run.storage.listNotes({ pageId: page.id, read: run.read, limit }),
        run.storage.listChildPages({ parentId: page.id, read: run.read, limit }),
        run.storage.listNotesMentioning({ pageId: page.id, read: run.read, limit }),
      ]);
      let childScopesCut = false;
      let childScopes: Array<{ address?: string; name: string; description?: string; restricted?: true }> = [];
      if (page.isScope) {
        const ownsParent = (await run.roleOn(page)) === 'owner';
        const { pages, nextCursor } = await run.storage.listChildScopes({ parentId: page.id, limit });
        childScopesCut = !!nextCursor;
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
      const mentionCache: MentionCache = new Map();
      const addresses = await pageRefs(run, [
        page,
        ...children.pages,
        ...mentionPages.filter((p): p is KnowledgePage => p !== null),
      ]);
      const ownRef = addresses.refs.get(page.id) ?? page.id;
      const more: string[] = [];
      const view = bodyView(page.body ?? '', { context: matchContext, more, maxTokens: maxTokensOf(host) });
      const noteList = await noteSummaries(run, notes.notes, mentionCache);
      const mentionList = (await noteSummaries(run, mentioning.notes, mentionCache)).map((note, i) => ({
        ...note,
        page: mentionPages[i] ? pageSummary(mentionPages[i]!, addresses) : undefined,
      }));
      // Small lists ride along; big ones would crowd out the body, so they are counted and left for
      // a read of their own.
      const notesInline = inlineSize(noteList) <= KNOWLEDGE_READ_INLINE_TOKENS;
      const mentionsInline = inlineSize(mentionList) <= KNOWLEDGE_READ_INLINE_TOKENS;
      if (!notesInline) {
        more.push(
          `notes: ${leftOut(noteList.length, !!notes.nextCursor, 'note')} (about ${inlineSize(noteList).toLocaleString('en-US')} tokens) left out. Read them with notes: true.`,
        );
      } else if (notes.nextCursor) {
        more.push(`notes: more than ${limit}. Read again with cursor: "${notes.nextCursor}".`);
      }
      if (children.nextCursor) {
        more.push(
          `children: more than ${limit}. List them with knowledge_list from: "${ownRef}"${page.isScope ? '' : `, cursor: "p${children.nextCursor}"`}.`,
        );
      }
      if (childScopesCut)
        more.push(`childScopes: more than ${limit}. List them with knowledge_list from: "${ownRef}".`);
      if (!mentionsInline) {
        more.push(
          `mentionedIn: ${leftOut(mentionList.length, !!mentioning.nextCursor, 'note')} mentioning this page (about ${inlineSize(mentionList).toLocaleString('en-US')} tokens) left out. Read them with mentionedIn: true.`,
        );
      } else if (mentioning.nextCursor) {
        more.push(`mentionedIn: more than ${limit}. Read again with mentionedInCursor: "${mentioning.nextCursor}".`);
      }
      return {
        page: {
          ...pageSummary(page, addresses),
          version: page.version,
          ...view,
        },
        ...(notesInline
          ? { notes: noteList, ...(notes.nextCursor ? { nextCursor: notes.nextCursor } : {}) }
          : { notesLeftOut: noteList.length }),
        children: children.pages.map(child => pageSummary(child, addresses)),
        ...(childScopes.length ? { childScopes } : {}),
        ...(mentionsInline
          ? {
              mentionedIn: mentionList,
              ...(mentioning.nextCursor ? { mentionedInCursor: mentioning.nextCursor } : {}),
            }
          : { mentionedInLeftOut: mentionList.length }),
        ...(more.length ? { more } : {}),
      };
    },
  });
}

const LIST_DEFAULT_LIMIT = 50;
const LIST_MAX_LIMIT = 100;
const LIST_MAX_DEPTH = 3;

/** One entry of a `knowledge_list` result. */
export interface ListEntry {
  ref: string;
  name: string;
  description?: string;
  /** 1 for the starting point's children, 2 for theirs, and so on. */
  depth: number;
  /** Readable child pages, plus readable child scopes for a scope. */
  children: number;
  scope?: true;
}

/** A child's ref built from its parent's: `<scope>#<key>` under a scope, `<parent ref>/<key>` deeper, else its id. */
function childRef(parent: KnowledgePage, parentRef: string, child: KnowledgePage): string {
  if (child.isScope) return child.address ?? child.id;
  if (!child.key || (!parent.isScope && parentRef === parent.id)) return child.id;
  return parent.isScope ? `${parentRef}#${child.key}` : `${parentRef}/${child.key}`;
}

/** What {@link listKnowledgeTree} found: the entries in tree order, and where the listing stopped. */
export interface KnowledgeTreeListing {
  /** The starting point's ref; absent when listing the run's own scopes. */
  originRef?: string;
  entries: ListEntry[];
  /** More entries at depth 1, for the next call's `cursor` (`s<n>` or `p<store cursor>`). */
  nextCursor?: string;
  /** Deeper levels stopped at `limit` entries. */
  truncated: boolean;
}

/**
 * The readable page tree under `origin` (or the run's own scopes without one), `depth` levels down
 * and at most `limit` entries: each with its ref, name and readable child count. A scope's readable
 * child scopes come before its child pages. Store calls grow with depth, not with entries.
 */
export async function listKnowledgeTree(
  run: KnowledgeRun,
  {
    origin,
    depth,
    limit,
    cursor,
    descriptions,
  }: { origin?: KnowledgePage; depth: number; limit: number; cursor?: string; descriptions?: boolean },
): Promise<KnowledgeTreeListing> {
  /**
   * Readable scopes directly under a scope page, up to `max`. The store leaves out unreadable
   * ones; core checks again so a custom store that ignores `read` can't list private scopes.
   */
  const childScopes = async (parentId: string, max = Infinity): Promise<KnowledgePage[]> => {
    const out: KnowledgePage[] = [];
    let next: string | undefined;
    do {
      const { pages, nextCursor } = await run.storage.listChildScopes({
        parentId,
        read: run.read,
        cursor: next,
        limit: Math.min(max - out.length, LIST_MAX_LIMIT),
      });
      out.push(...pages.filter(scope => knowledgeScopeReadable(scope, run.read)));
      next = nextCursor;
    } while (next && out.length < max);
    return out;
  };
  /** Child pages of `parentId`, up to `max`, a store page at a time, with the cursor where they stopped. */
  const childPages = async (parentId: string, max: number, cursor?: string) => {
    const pages: KnowledgePage[] = [];
    let next = cursor;
    do {
      const batch = await run.storage.listChildPages({
        parentId,
        read: run.read,
        cursor: next,
        limit: Math.min(max - pages.length, LIST_MAX_LIMIT),
      });
      pages.push(...batch.pages);
      next = batch.nextCursor;
      if (!batch.pages.length) break;
    } while (next && pages.length < max);
    return { pages, nextCursor: next };
  };

  // Cursors are ours: `s<n>` continues the scopes at this level from the n-th, `p<store cursor>`
  // continues the child pages (`p` alone starts them).
  if (cursor && !/^[sp]/.test(cursor)) throw new Error('knowledge_list: that cursor did not come from knowledge_list.');
  const scopeOffset = cursor?.startsWith('s') ? Number(cursor.slice(1)) || 0 : 0;
  const pageCursor = cursor?.startsWith('p') ? cursor.slice(1) || undefined : undefined;
  let originRef: string | undefined;
  let scopes: KnowledgePage[] = [];
  if (!origin) {
    if (cursor?.startsWith('p')) throw new Error('knowledge_list: a page cursor needs the `from` it came from.');
    const held = await run.storage.getScopesByAddress(run.principals);
    const order = (scope: KnowledgePage) => run.principals.indexOf(scope.address ?? '');
    scopes = held.filter(scope => knowledgeScopeReadable(scope, run.read)).sort((a, b) => order(a) - order(b));
  } else {
    originRef = (await pageRefs(run, [origin])).refs.get(origin.id) ?? origin.id;
    if (origin.isScope && !cursor?.startsWith('p')) scopes = await childScopes(origin.id);
  }
  // A scope's readable child scopes come first, then its child pages; both count against `limit`.
  const shownScopes = scopes.slice(scopeOffset, scopeOffset + limit);
  let roots: KnowledgePage[] = shownScopes;
  let nextCursor: string | undefined;
  if (scopeOffset + shownScopes.length < scopes.length) {
    nextCursor = `s${scopeOffset + shownScopes.length}`;
  } else if (origin) {
    const room = limit - shownScopes.length;
    if (room > 0) {
      const pages = await childPages(origin.id, room, pageCursor);
      roots = [...shownScopes, ...pages.pages];
      if (pages.nextCursor) nextCursor = `p${pages.nextCursor}`;
    } else if ((await run.storage.countChildPages({ parentIds: [origin.id], read: run.read }))[origin.id]) {
      nextCursor = 'p';
    }
  }

  type Node = { page: KnowledgePage; ref: string; depth: number; children: number; below: Node[] };
  const nodeOf = (page: KnowledgePage, ref: string, level: number): Node => ({
    page,
    ref,
    depth: level,
    children: 0,
    below: [],
  });
  const top = roots.map(page =>
    nodeOf(page, origin && originRef ? childRef(origin, originRef, page) : (page.address ?? page.id), 1),
  );
  let budget = Math.max(limit - top.length, 0);
  let truncated = false;
  let level = top;
  for (let current = 1; current <= depth && level.length; current++) {
    const parentIds = level.map(node => node.page.id);
    const scopeParents = level.filter(node => node.page.isScope).map(node => node.page.id);
    const [pageCounts, scopeCounts] = await Promise.all([
      run.storage.countChildPages({ parentIds, read: run.read }),
      scopeParents.length
        ? run.storage.countChildScopes({ parentIds: scopeParents, read: run.read })
        : Promise.resolve({} as Record<string, number>),
    ]);
    for (const node of level) {
      node.children = (pageCounts[node.page.id] ?? 0) + (scopeCounts[node.page.id] ?? 0);
    }
    if (current === depth) break;
    const nextLevel: Node[] = [];
    for (const node of level) {
      if (!node.children) continue;
      if (budget <= 0) {
        truncated = true;
        break;
      }
      const scopes = scopeCounts[node.page.id] ? await childScopes(node.page.id, budget) : [];
      budget -= scopes.length;
      const pages = budget > 0 ? (await childPages(node.page.id, budget)).pages : [];
      budget -= pages.length;
      node.below = [...scopes, ...pages].map(child => nodeOf(child, childRef(node.page, node.ref, child), current + 1));
      if (node.below.length < node.children) truncated = true;
      nextLevel.push(...node.below);
    }
    level = nextLevel;
  }

  const entries: ListEntry[] = [];
  const flatten = (nodes: Node[]) => {
    for (const node of nodes) {
      entries.push({
        ref: node.ref,
        name: node.page.name,
        ...(descriptions && node.page.description ? { description: node.page.description } : {}),
        depth: node.depth,
        children: node.children,
        ...(node.page.isScope ? { scope: true as const } : {}),
      });
      flatten(node.below);
    }
  };
  flatten(top);

  return { ...(originRef ? { originRef } : {}), entries, ...(nextCursor ? { nextCursor } : {}), truncated };
}

function listTool(host: KnowledgePageToolHost) {
  const maxTokens = maxTokensOf(host);
  return createTool({
    id: 'knowledge_list',
    description:
      'List the page tree under a starting point: each child with its ref (pass it to knowledge_read or knowledge_list), name and how many children it has. Pass `descriptions: true` to include page descriptions too. ' +
      'Without `from`, lists the scopes this run can read. Use it to find your way around a scope before searching or reading. ' +
      `One result holds at most \`limit\` entries and about ${maxTokens.toLocaleString('en-US')} tokens of them; when it stops early, \`more\` says how many entries were left out and gives the \`cursor\` to list the rest (pass the same \`from\`).`,
    inputSchema: {
      type: 'object',
      properties: {
        from: { type: 'string', minLength: 1, description: `Where to start. ${pageRefDescription}` },
        depth: {
          type: 'integer',
          minimum: 1,
          maximum: LIST_MAX_DEPTH,
          description: `How many levels below the starting point to list, up to ${LIST_MAX_DEPTH}. Defaults to 1.`,
        },
        limit: {
          type: 'integer',
          minimum: 1,
          maximum: LIST_MAX_LIMIT,
          description: `Maximum entries. Defaults to ${LIST_DEFAULT_LIMIT}.`,
        },
        cursor: {
          type: 'string',
          minLength: 1,
          description: "The previous result's nextCursor, for the entries after it (pass the same `from`).",
        },
        descriptions: {
          type: 'boolean',
          description:
            "Include each page's description. Off by default; knowledge_read returns a page's description too.",
        },
      },
      additionalProperties: false,
    } satisfies JSONSchema7,
    execute: async (input, context) => {
      const {
        from,
        depth: requestedDepth,
        limit: requestedLimit,
        cursor: requestedCursor,
        descriptions,
      } = input as {
        from?: string;
        depth?: number;
        limit?: number;
        cursor?: string;
        descriptions?: boolean;
      };
      // A `t<depth>.<limit>.<skip>.<cursor>` cursor resumes a result cut short by tokens: it lists
      // the same entries again (same depth, limit and underlying cursor) and skips those already
      // returned, so paging returns every entry once at any depth.
      let cursor = requestedCursor;
      let depth = Math.min(Math.max(requestedDepth ?? 1, 1), LIST_MAX_DEPTH);
      let limit = Math.min(Math.max(requestedLimit ?? LIST_DEFAULT_LIMIT, 1), LIST_MAX_LIMIT);
      let skip = 0;
      if (cursor?.startsWith('t')) {
        const match = /^t(\d+)\.(\d+)\.(\d+)\.(.*)$/s.exec(cursor);
        if (!match) throw new Error('knowledge_list: that cursor did not come from knowledge_list.');
        depth = Math.min(Math.max(Number(match[1]), 1), LIST_MAX_DEPTH);
        limit = Math.min(Math.max(Number(match[2]), 1), LIST_MAX_LIMIT);
        skip = Number(match[3]);
        cursor = match[4] || undefined;
      }
      const run = await start(host, context);
      const origin = from ? await run.pageOrCloseMatches(from) : undefined;
      const { originRef, entries, nextCursor, truncated } = await listKnowledgeTree(run, {
        origin,
        depth,
        limit,
        cursor,
        descriptions,
      });

      const more: string[] = [];
      if (nextCursor) {
        more.push(
          `entries: more at depth 1. List again with ${from ? `from: ${JSON.stringify(from)}, ` : ''}cursor: "${nextCursor}".`,
        );
      }
      if (truncated) {
        more.push(
          `entries: stopped listing deeper levels at ${limit} entries. List an entry by its ref to see the rest of its children.`,
        );
      }

      // Stop once the entries reach the token budget (always at least one), and hand back a cursor
      // to the rest of this same listing.
      const sizes = entries.map(entry => estimateTokenCount(JSON.stringify(entry)));
      const begin = Math.min(skip, entries.length);
      let end = begin;
      let used = 0;
      while (end < entries.length && (end === begin || used + sizes[end]! <= maxTokens)) used += sizes[end++]!;
      if (end < entries.length) {
        const left = entries.length - end;
        const leftTokens = sizes.slice(end).reduce((sum, size) => sum + size, 0);
        const tokenCursor = `t${depth}.${limit}.${end}.${cursor ?? ''}`;
        return {
          ...(origin ? { from: { ref: originRef!, name: origin.name } } : {}),
          entries: entries.slice(begin, end),
          nextCursor: tokenCursor,
          more: [
            `entries: stopped at about ${maxTokens.toLocaleString('en-US')} tokens; ${left} more ${left === 1 ? 'entry' : 'entries'} (about ${leftTokens.toLocaleString('en-US')} tokens) left out. List again with ${from ? `from: ${JSON.stringify(from)}, ` : ''}cursor: "${tokenCursor}".`,
          ],
        };
      }
      return {
        ...(origin ? { from: { ref: originRef!, name: origin.name } } : {}),
        entries: entries.slice(begin),
        ...(nextCursor ? { nextCursor } : {}),
        ...(more.length ? { more } : {}),
      };
    },
  });
}

const NUMBERED_LINE = /^\s*\d+│/;

/**
 * The body a write stores. With `range`, its text spliced into the body read at `expectedVersion`.
 * Without one, a body longer than one read returns is refused: the writer can only have seen part
 * of it, and writing that part back would drop the rest.
 */
function writtenBody(args: PageInput, page: KnowledgePage, maxTokens: number): string | undefined {
  const stored = page.body ?? '';
  if (args.body !== undefined) {
    const written = args.body.split('\n').filter(line => line.trim());
    if (written.length && written.every(line => NUMBERED_LINE.test(line))) {
      throw new Error(
        'This body still has the line numbers a knowledge_read put in front of each line ("12│"). Write the text without them.',
      );
    }
  }
  if (args.range) {
    if (args.body === undefined) throw new Error('range needs body: the text that replaces those lines.');
    if (args.expectedVersion === undefined) {
      throw new Error('A range write needs expectedVersion, the version the range was read at.');
    }
    // At another version the store refuses the write anyway; the range only means something at this one.
    if (args.expectedVersion !== page.version) return args.body;
    const lines = new KnowledgeBodyLines(stored);
    let start = lines.startOffset(args.range.start);
    let end = lines.endOffset(args.range.end);
    if (start > end) {
      throw new Error(`The range starts after it ends. Pass the range a knowledge_read returned.`);
    }
    // A read from `start` returns at most this window, so a wider range can't be one a read gave.
    if (end > knowledgeBodyWindow(lines, start, stored.length, maxTokens).end) {
      throw new Error(
        `Lines ${args.range.start.line}–${args.range.end.line} run past what one knowledge_read from line ${args.range.start.line} shows, so this can't be a range a read gave you. ` +
          'Edit the body part by part: write each part back with the range its own read returned.',
      );
    }
    // Writing nothing over whole lines removes them, newline included.
    const wholeLines = args.range.start.col === undefined && args.range.end.col === undefined;
    if (wholeLines && args.body === '') {
      if (end < stored.length) end++;
      else if (start > 0) start--;
    }
    return stored.slice(0, start) + args.body + stored.slice(end);
  }
  if (args.body !== undefined && estimateTokenCount(stored) > maxTokens) {
    throw new Error(
      `This page's body is ${stored.length} characters, more than one knowledge_read returns, and a body write without a range replaces all of it. ` +
        'Write back only the lines you read, with the range that read returned and its expectedVersion; ' +
        'read other parts with from, section or match and write each back with its own range.',
    );
  }
  return args.body;
}

type PageInput = {
  range?: KnowledgeLineRange;
  op: 'write' | 'move' | 'merge' | 'delete';
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
      'Write, move, merge or delete pages. A page body is the curated summary of its topic (needs editor to change); discrete attributed details belong in notes (knowledge_note). ' +
      'op "write": with `page`, edits that page (name, description, body; a scope page takes body only); without `page`, creates a page named `name` in `scope`. ' +
      'op "move": moves `page` under `parent` or to the top of `scope`. op "merge": merges `page` into `into`, keeping both pages\' notes. ' +
      'op "delete": deletes `page` (needs owner on its scope); a page with child pages, a scope page and a page declared in config can\'t be deleted. ' +
      '`scope` is only for where content lands (create, move destination); edits and merges take none. ' +
      'Pages declared in config can be edited and merged into, but not moved, merged away or deleted.',
    inputSchema: {
      type: 'object',
      properties: {
        op: { type: 'string', enum: ['write', 'move', 'merge', 'delete'] },
        page: {
          type: 'string',
          minLength: 1,
          description: `The page to edit, move, merge or delete. ${pageRefDescription}`,
        },
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
        body: {
          type: 'string',
          description:
            'The curated long-form summary, in markdown, without line numbers. Replaces the whole body, or with `range` only those lines.',
        },
        range: {
          type: 'object',
          description:
            'Edit: a range a knowledge_read returned (or part of one), e.g. {"start": {"line": 12}, "end": {"line": 14}}. `body` then replaces lines 12 through 14; an empty body removes them. A `col` limits it to part of a very long line. Needs expectedVersion.',
          properties: { start: linePositionSchema, end: linePositionSchema },
          required: ['start', 'end'],
          additionalProperties: false,
        },
        expectedVersion: {
          type: 'integer',
          minimum: 1,
          description: 'The version you read or saw pinned; the write is refused if the page changed since.',
        },
      },
      required: ['op'],
      additionalProperties: false,
    } satisfies JSONSchema7,
    execute: async (input, context) => {
      const args = input as PageInput;
      const run = await start(host, context, true);
      const { storage, provenance } = run;
      const done = async (page: KnowledgePage) => ({
        page: { ...pageSummary(page, await pageRefs(run, [page])), version: page.version },
      });

      if (args.op === 'write') {
        if (args.page) {
          if (args.scope || args.parent || args.key) {
            throw new Error('Editing a page takes no scope, parent or key; use op "move" to relocate it.');
          }
          if (args.name === undefined && args.description === undefined && args.body === undefined) {
            throw new Error('Editing a page needs at least one of name, description or body.');
          }
          const page = await run.page(args.page, 'editor');
          await run.require(await run.scopeOf(page), 'editor', 'Editing a page');
          if (page.isScope && (args.name !== undefined || args.description !== undefined)) {
            throw new Error(
              `"${args.page}" is a scope page; its name and description come from config, so only its body can be written.`,
            );
          }
          const updated = await storage.updatePage({
            id: page.id,
            expectedVersion: args.expectedVersion ?? page.version,
            name: args.name,
            description: args.description,
            body: writtenBody(args, page, maxTokensOf(host)),
            provenance,
          });
          await embed(host, index => index.indexPage(updated), pageEmbedFailed(storage, updated));
          await updateKnowledgeLinks(host.warn, async () => {
            if (args.body !== undefined) await syncKnowledgePageBodyLinks(storage, updated);
            // Only the name can change a page's ref keys here; its id, path and address stay.
            if (updated.name !== page.name) await refreshKnowledgeLinksTo(storage, [updated]);
          });
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
        await embed(host, index => index.indexPage(created), pageEmbedFailed(storage, created));
        await updateKnowledgeLinks(host.warn, async () => {
          await syncKnowledgePageBodyLinks(storage, created);
          await refreshKnowledgeLinksTo(storage, [created]);
        });
        return done(created);
      }

      if (!args.page) throw new Error(`op "${args.op}" needs page.`);
      const page = await run.page(args.page);
      if (page.isScope)
        throw new Error(`"${args.page}" is a scope page; scope pages can't be moved, merged or deleted.`);
      const home = await run.scopeOf(page);
      const template = await host.runtime.templatePageRef(page);
      if (template) {
        throw new Error(
          `"${template}" is declared in config; change the scope's pages to ${args.op === 'move' ? 'move' : 'remove'} it.`,
        );
      }

      if (args.op === 'delete') {
        await run.require(home, 'owner', 'Deleting a page');
        let deleted: KnowledgePage;
        try {
          deleted = await storage.deletePage({
            id: page.id,
            expectedVersion: args.expectedVersion ?? page.version,
            deletedBy: provenance.author,
          });
        } catch (error) {
          if (error instanceof KnowledgePageHasChildrenError) {
            throw new Error(`"${page.name}" has child pages; move or delete them first.`);
          }
          throw error;
        }
        await embed(host, index => index.removePage(page.id), UNEMBED_FAILED);
        await updateKnowledgeLinks(host.warn, async () => {
          await syncKnowledgePageBodyLinks(storage, deleted);
          await refreshKnowledgeLinksTo(storage, [deleted]);
        });
        return done(deleted);
      }

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
        const moved = await storage.movePage({
          id: page.id,
          expectedVersion: args.expectedVersion ?? page.version,
          parentId: parent.id,
          provenance,
        });
        // The subtree's `scope#key/key` paths changed: links by old path stop resolving, new ones may.
        await updateKnowledgeLinks(host.warn, async () => {
          await syncKnowledgePageBodyLinks(storage, moved);
          await refreshKnowledgeLinksTo(storage, [moved], { withDescendants: true });
        });
        return done(moved);
      }

      if (!args.into) throw new Error('Merging needs into: the page that remains.');
      const target = await run.page(args.into, 'editor');
      await run.require(home, 'owner', 'Merging a page away');
      const targetHome = await run.scopeOf(target);
      // Merging carries the source's child pages into the target's scope, so across scopes it is a move.
      await run.require(
        targetHome,
        targetHome.id === home.id ? 'editor' : 'owner',
        targetHome.id === home.id ? 'Merging into a page' : 'Merging a page across scopes',
      );
      const merged = await storage.mergePages({
        sourceId: page.id,
        sourceVersion: args.expectedVersion ?? page.version,
        targetId: target.id,
        provenance,
      });
      await embed(host, index => index.removePage(page.id), UNEMBED_FAILED);
      // The source is gone and its children now live under the target, at new paths.
      await updateKnowledgeLinks(host.warn, async () => {
        const source = { ...page, deletedAt: merged.updatedAt, mergedInto: merged.id };
        await syncKnowledgePageBodyLinks(storage, source);
        await refreshKnowledgeLinksTo(storage, [source, merged], { withDescendants: true });
      });
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
        text: {
          type: 'string',
          minLength: 1,
          description: 'Add: the note, about 250 tokens at most; inline markdown is fine.',
        },
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
      const run = await start(host, context, true);
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
        const page = await run.page(args.page, 'contributor');
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
        await embed(host, index => index.indexNote(note), knowledgeEmbedFailedWarning(`note ${note.id}`));
        return { note: noteSummary(note, await noteMentions(run, note)), page: page.id };
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
        return { note: noteSummary(restamped, await noteMentions(run, restamped)), page: page.id };
      }
      await storage.removeNote({ id: note.id, deletedBy: provenance.author, provenance });
      await embed(host, index => index.remove([`note:${note.id}`]), UNEMBED_FAILED);
      return { removed: note.id };
    },
  });
}

function pinTool(host: KnowledgePageToolHost, onChange?: (context: unknown) => void) {
  return createTool({
    id: 'knowledge_pin',
    description:
      'Pin a page into the context of every run holding one of the audience scopes, every turn; or unpin it. With kind "list", pin a listing of the pages under it instead (refs, names and child counts, like knowledge_list from it, `depth` levels down), kept current as pages are added, renamed or removed. Pinned pages cost tokens on every turn: pin only standing instructions, durable preferences and hard constraints that apply without being asked for, and listings agents need to find their way. ' +
      "Needs editor on the page's scope and, for each audience, holding it or editor on it. A pinned page is delivered only to runs that can read it, and a listing shows only the pages they can read.",
    inputSchema: {
      type: 'object',
      properties: {
        op: { type: 'string', enum: ['pin', 'unpin'] },
        page: { type: 'string', minLength: 1, description: pageRefDescription },
        audience: { ...scopeListSchema, description: 'Scope addresses whose runs receive the pin.' },
        kind: {
          type: 'string',
          enum: ['page', 'list'],
          description:
            '"page" (default) pins the page; "list" pins a listing of the pages under it. Each is pinned and unpinned on its own.',
        },
        depth: {
          type: 'integer',
          minimum: 1,
          maximum: MAX_KNOWLEDGE_PIN_LIST_DEPTH,
          description: `Levels a "list" pin shows below the page, 1 to ${MAX_KNOWLEDGE_PIN_LIST_DEPTH}. Default 1; pinning again sets a new depth.`,
        },
      },
      required: ['op', 'page', 'audience'],
      additionalProperties: false,
    } satisfies JSONSchema7,
    execute: async (input, context) => {
      const {
        op,
        page: ref,
        audience,
        kind = 'page',
        depth,
      } = input as { op: 'pin' | 'unpin'; page: string; audience: string[]; kind?: KnowledgePinKind; depth?: number };
      if (depth !== undefined && (kind !== 'list' || op !== 'pin')) {
        throw new Error('depth only goes with op "pin" and kind "list".');
      }
      if (op === 'pin' && kind === 'list' && !(await host.getStorage()).getCapabilities().supportsPinKinds) {
        throw new Error(
          'This Knowledge storage adapter predates listing pins. Upgrade the storage package to pin a page listing.',
        );
      }
      const run = await start(host, context, true);
      const page = await run.page(ref, 'editor');
      const what = kind === 'list' ? 'a page listing' : 'a page';
      await run.require(await run.scopeOf(page), 'editor', op === 'pin' ? `Pinning ${what}` : `Unpinning ${what}`);
      await requireAudienceAuthority(run, audience);
      const author = run.provenance.author;
      const pin =
        op === 'pin'
          ? await run.storage.addPinAudience({ pageId: page.id, kind, depth, audience, createdBy: author })
          : await run.storage.removePinAudience({ pageId: page.id, kind, audience, removedBy: author });
      onChange?.(context);
      return {
        page: page.id,
        kind,
        ...(pin?.depth === undefined ? {} : { depth: pin.depth }),
        audience: pin?.audience ?? [],
      };
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
    tools.knowledge_list = listTool(host);
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
