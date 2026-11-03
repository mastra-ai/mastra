import { estimateTokenCount, sliceByTokens } from 'tokenx';
import { knowledgeScopeReadable } from '../storage/domains/knowledge';
import type { KnowledgeListedPin, KnowledgePage } from '../storage/domains/knowledge';
import { knowledgePinTarget, knowledgeScopeAddress } from './declarations';
import type { CompiledKnowledgeScopes, KnowledgePinnedList } from './declarations';
import { knowledgePageRefs } from './page-refs';
import { listKnowledgeTree } from './page-tools';
import type { KnowledgeRun } from './run';

export const PINNED_KNOWLEDGE_STATE_ID = 'knowledge';

export const PINNED_SNAPSHOT_TAG = 'pinned-knowledge';
export const PINNED_DELTA_TAG = 'pinned-knowledge-update';

export const DEFAULT_MAX_PINS = 20;
export const DEFAULT_PINNED_MAX_TOKENS = 500;

export const PIN_TRUNCATION_MARKER = '[truncated — knowledge_read for the rest]';
/** Entry id of the line listing stored pins that didn't fit the budget. */
export const PIN_OVERFLOW_ID = 'overflow';
/** Most stored pins the overflow line names; the rest are counted. */
export const OVERFLOW_NAMES = 10;

export interface PinEntry {
  id: string;
  /** What the model reads; the only field in the prompt and the cache key. */
  text: string;
  /** The page's name, for display. Left off the overflow entry. */
  name?: string;
  /** The address of the page's home scope, e.g. `policy:acme`, for display. Left off the overflow entry. */
  scope?: string;
}

export interface PinBudget {
  maxPins: number;
  maxTokens: number;
}

/** A config pin with `$params` bound from the held principal: scope address, key path, and depth for a listing. */
interface BoundPin {
  address: string;
  path: string[];
  depth?: number;
}

function bindConfigPin(entry: string | KnowledgePinnedList, params: Record<string, string>): BoundPin | null {
  const parsed = knowledgePinTarget(entry);
  if (!parsed) return null;
  try {
    return { ...parsed, address: knowledgeScopeAddress(parsed.scope, params) };
  } catch {
    return null;
  }
}

/** Prefix of a pinned listing's entry id; the rest is the listed page's id. */
export const PIN_LIST_ID_PREFIX = 'list:';

/** A pinned listing, resolved for this run. */
interface PinnedListing {
  origin: KnowledgePage;
  depth: number;
  /** `- <ref> — <name> (<n> children)` per entry, indented by depth, in tree order. */
  lines: Array<{ text: string; depth: number }>;
  /** Entries the walk left out, beyond the lines fetched. */
  more: boolean;
}

/** Fewest tokens a listing line costs (`- a#b — B`): how many entries a token budget could hold. */
const LISTING_LINE_MIN_TOKENS = 5;
/** Most entries one listing walk fetches, however large the budget, to bound store calls per turn. */
const LISTING_MAX_ENTRIES = 1_000;

/** Walks the tree for as many entries as `maxTokens` could hold; rendering then fills it level by level. */
async function resolveListing(
  run: KnowledgeRun,
  origin: KnowledgePage,
  depth: number,
  maxTokens: number,
): Promise<PinnedListing> {
  const limit = Math.min(Math.max(Math.ceil(maxTokens / LISTING_LINE_MIN_TOKENS), 1), LISTING_MAX_ENTRIES);
  const listing = await listKnowledgeTree(run, { origin, depth, limit });
  const lines = listing.entries.map(entry => ({
    depth: entry.depth,
    text: `${'  '.repeat(entry.depth - 1)}- ${entry.ref} — ${entry.name}${entry.children ? ` (${entry.children} ${entry.children === 1 ? 'child' : 'children'})` : ''}`,
  }));
  return { origin, depth, lines, more: Boolean(listing.nextCursor) || listing.truncated };
}

/**
 * Fills `maxTokens` a level at a time: every depth-1 line that fits, then depth 2, and so on, stopping
 * at the first line that doesn't fit (always at least one). Lines print in tree order, so each child
 * still sits under its parent; a cut ends with a pointer to knowledge_list.
 */
function renderListing(listing: PinnedListing, ref: string, maxTokens: number): string {
  const head = `Pages under ${listing.origin.name} (${ref}, depth ${listing.depth}):`;
  if (listing.lines.length === 0) return `${head} none.`;
  const tail = (left: number) =>
    `…${left > 0 && !listing.more ? `and ${left} more` : 'and more'}; knowledge_list from: "${ref}"`;
  const all = [head, ...listing.lines.map(line => line.text), ...(listing.more ? [tail(0)] : [])].join('\n');
  if (estimateTokenCount(all) <= maxTokens) return all;
  // Tree order filtered to one depth is that level's order, so a stable sort by depth is breadth-first.
  const levelOrder = listing.lines.map((line, index) => ({ ...line, index })).sort((a, b) => a.depth - b.depth);
  const shown = new Set<number>();
  let used = estimateTokenCount(head) + estimateTokenCount(tail(listing.lines.length)) + 2;
  for (const line of levelOrder) {
    const cost = estimateTokenCount(line.text) + 1;
    if (shown.size > 0 && used + cost > maxTokens) break;
    shown.add(line.index);
    used += cost;
  }
  const kept = listing.lines.filter((_, index) => shown.has(index)).map(line => line.text);
  return [head, ...kept, tail(listing.lines.length - kept.length)].join('\n');
}

/** What a pinned entry says about its page besides the body: where to read it, and how many notes it has. */
interface PinLabel {
  /** `<scope>#<key path>` when every page on the way up has a key, else the page id. */
  ref: string;
  /** Undefined when the adapter can't count notes; the entry then goes out without a count. */
  notes?: number;
}

function render(page: KnowledgePage, label: PinLabel, maxTokens: number): string {
  const notes =
    label.notes === undefined
      ? ''
      : label.notes === 0
        ? ', no notes'
        : label.notes === 1
          ? ', 1 note'
          : `, ${label.notes} notes`;
  const text = `${page.name} (${label.ref}, v${page.version}${notes}): ${page.body!.trim()}`;
  if (estimateTokenCount(text) <= maxTokens) return text;
  const room = Math.max(maxTokens - estimateTokenCount(PIN_TRUNCATION_MARKER) - 1, 1);
  return `${sliceByTokens(text, 0, room).trimEnd()} ${PIN_TRUNCATION_MARKER}`;
}

/** The run's principals grouped by `pinnedContextPriority`, highest first. */
function priorityTiers(compiled: CompiledKnowledgeScopes, principals: string[]): string[][] {
  const tiers = new Map<number, string[]>();
  for (const address of principals) {
    const match = compiled.match(address);
    if (!match) continue;
    const priority = match.concrete?.pinnedContextPriority ?? match.compiled.declaration.pinnedContextPriority ?? 0;
    tiers.set(priority, [...(tiers.get(priority) ?? []), address]);
  }
  return [...tiers.entries()].sort(([a], [b]) => b - a).map(([, addresses]) => addresses);
}

async function configPins(
  run: KnowledgeRun,
  maxTokens: number,
): Promise<{ pages: KnowledgePage[]; listings: PinnedListing[] }> {
  const bound: BoundPin[] = [];
  for (const principal of run.principals) {
    const match = run.runtime.compiled.match(principal);
    if (!match) continue;
    for (const entry of [
      ...(match.compiled.declaration.pinnedContext ?? []),
      ...(match.concrete?.pinnedContext ?? []),
    ]) {
      const pin = bindConfigPin(entry, match.params);
      if (pin) bound.push(pin);
    }
  }
  if (bound.length === 0) return { pages: [], listings: [] };
  const scopes = await run.storage.getScopesByAddress([...new Set(bound.map(pin => pin.address))]);
  const pages = new Map<string, KnowledgePage>();
  const listings = new Map<string, PinnedListing>();
  for (const pin of bound) {
    const scope = scopes.find(candidate => candidate.address === pin.address);
    if (!scope) continue;
    // Resolved by path every run: a path with no page (not created yet, moved, deleted) delivers nothing.
    const page =
      pin.path.length === 0
        ? knowledgeScopeReadable(scope, run.read)
          ? scope
          : null
        : await run.storage.getPageByPath({ scopeId: scope.id, path: pin.path, read: run.read });
    if (!page || page.deletedAt) continue;
    if (pin.depth === undefined) pages.set(page.id, page);
    else if ((listings.get(page.id)?.depth ?? 0) < pin.depth) {
      listings.set(page.id, await resolveListing(run, page, pin.depth, maxTokens));
    }
  }
  return { pages: [...pages.values()], listings: [...listings.values()] };
}

/**
 * Stored pins in delivery order, at most `want`: the run's principals tier by tier from the highest
 * `pinnedContextPriority` (a pin ranks by its best audience entry), newest first within a tier. Also returns how
 * many stored pins the run could receive in all.
 */
async function rankedStoredPins(
  run: KnowledgeRun,
  excludePageIds: string[],
  want: number,
): Promise<{ pins: KnowledgeListedPin[]; total: number }> {
  const tiers = priorityTiers(run.runtime.compiled, run.principals);
  const base = { read: run.read, withBody: true, excludePageIds } as const;
  const pins: KnowledgeListedPin[] = [];
  const seen = new Set<string>();
  let total: number | undefined;
  for (const audience of tiers) {
    let cursor: string | undefined;
    do {
      const result = await run.storage.listPins({
        ...base,
        audience,
        cursor,
        limit: want - pins.length,
        count: tiers.length === 1 && cursor === undefined,
      });
      if (result.total !== undefined) total = result.total;
      for (const pin of result.pins) {
        if (seen.has(pin.id)) continue;
        seen.add(pin.id);
        pins.push(pin);
      }
      cursor = result.nextCursor;
    } while (cursor && pins.length < want);
    if (pins.length >= want) break;
  }
  if (total === undefined) {
    total =
      tiers.length === 0
        ? 0
        : ((await run.storage.listPins({ ...base, audience: run.principals, limit: 1, count: true })).total ?? 0);
  }
  return { pins, total };
}

function overflowLine(names: string[], more: number): string {
  const listed = names.join(', ');
  const rest = more > 0 ? `${listed ? `${listed}, ` : ''}…and ${more} more` : listed;
  return `Also pinned (open with knowledge_read): ${rest}`;
}

/**
 * The pinned pages a run receives, rendered: config pins first (always delivered; an equal share each
 * when they alone exceed the token budget), then stored pins by `pinnedContextPriority` and recency while the
 * pin and token budgets last, then one line naming up to ten stored pins that didn't fit and counting
 * the rest. The line counts against the token budget. Only pages the run can read and that have a body
 * are delivered. A run costs a fixed handful of store calls however many pins exist.
 */
export async function knowledgeDeliveredPins(run: KnowledgeRun, budget: PinBudget): Promise<PinEntry[]> {
  // Store calls per turn: (pinnedContextPriority tiers the run holds) + 3 (one count, one getPages for pin
  // pages, one countNotes) + one getPages per page-tree level above the pinned pages, plus the config-pin
  // lookups and one tree walk per pinned listing; never one per page pin.
  const configPinned = await configPins(run, budget.maxTokens);
  const configured = configPinned.pages.filter(page => page.body?.trim());
  const listings = configPinned.listings;

  const slots = Math.max(budget.maxPins - configured.length - listings.length, 0);
  const ranked = await rankedStoredPins(
    run,
    configured.map(page => page.id),
    slots + OVERFLOW_NAMES,
  );
  // A stored listing of a page config already lists is delivered once, as the config listing.
  const configListed = new Set(listings.map(listing => listing.origin.id));
  const pins = ranked.pins.filter(pin => !(pin.kind === 'list' && configListed.has(pin.pageId)));
  const total = ranked.total - (ranked.pins.length - pins.length);
  const slotPins = pins.slice(0, slots);
  const pages = new Map(
    (await run.storage.getPages({ ids: [...new Set(slotPins.map(pin => pin.pageId))], read: run.read })).map(page => [
      page.id,
      page,
    ]),
  );
  // One tree walk per stored listing, as for config listings.
  const storedListings = new Map<string, PinnedListing>();
  for (const pin of slotPins) {
    const page = pages.get(pin.pageId);
    if (pin.kind === 'list' && page)
      storedListings.set(pin.id, await resolveListing(run, page, pin.depth ?? 1, budget.maxTokens));
  }
  const pinnedPages = slotPins.flatMap(pin => {
    // A store from before pin kinds returns no kind: those are page pins.
    const page = pin.kind !== 'list' ? pages.get(pin.pageId) : undefined;
    return page ? [page] : [];
  });
  const { labels, scopes } = await pinLabels(run, [...configured, ...pinnedPages]);
  const labelOf = (page: KnowledgePage) => labels.get(page.id)!;
  const allListings = [...listings, ...storedListings.values()];
  const listingRefs = allListings.length
    ? (
        await knowledgePageRefs(
          run.storage,
          run.read,
          allListings.map(listing => listing.origin),
        )
      ).refs
    : new Map<string, string>();
  for (const listing of allListings) {
    if (!listing.origin.isScope) continue;
    const scope = listing.origin.address;
    if (scope) listingRefs.set(listing.origin.id, scope);
  }
  const listingRef = (listing: PinnedListing) => listingRefs.get(listing.origin.id) ?? listing.origin.id;

  // Config pages and listings are always delivered: whole when they fit together, else an equal share each.
  const entries: PinEntry[] = [];
  const configCount = configured.length + listings.length;
  const renderConfig = (room: number) => {
    for (const page of configured) entries.push({ id: page.id, text: render(page, labelOf(page), room) });
    for (const listing of listings) {
      entries.push({
        id: `${PIN_LIST_ID_PREFIX}${listing.origin.id}`,
        text: renderListing(listing, listingRef(listing), room),
      });
    }
  };
  renderConfig(Number.POSITIVE_INFINITY);
  if (entries.reduce((sum, entry) => sum + estimateTokenCount(entry.text), 0) > budget.maxTokens) {
    entries.length = 0;
    renderConfig(Math.max(Math.floor(budget.maxTokens / configCount), 1));
  }

  const minimum = estimateTokenCount(PIN_TRUNCATION_MARKER) + 8;
  let used = entries.reduce((sum, entry) => sum + estimateTokenCount(entry.text), 0);
  const delivered: Array<{ entry: PinEntry; pin: KnowledgeListedPin }> = [];
  const left: KnowledgeListedPin[] = [];
  for (const [i, pin] of pins.entries()) {
    const page = i < slots ? pages.get(pin.pageId) : undefined;
    const listing = pin.kind === 'list' ? storedListings.get(pin.id) : undefined;
    const remaining = budget.maxTokens - used;
    if (!page || (pin.kind === 'list' && !listing) || remaining < minimum) {
      left.push(pin);
      continue;
    }
    const entry: PinEntry = listing
      ? { id: `${PIN_LIST_ID_PREFIX}${page.id}`, text: renderListing(listing, listingRef(listing), remaining) }
      : { id: page.id, text: render(page, labelOf(page), remaining) };
    used += estimateTokenCount(entry.text);
    delivered.push({ entry, pin });
  }

  // The overflow line must fit too: give back the lowest-ranked delivered pins until it does.
  const line = () =>
    overflowLine(
      left.slice(0, OVERFLOW_NAMES).map(pin => (pin.kind === 'list' ? `${pin.pageName} (listing)` : pin.pageName)),
      total - delivered.length - Math.min(left.length, OVERFLOW_NAMES),
    );
  while (total > delivered.length && delivered.length > 0 && used + estimateTokenCount(line()) > budget.maxTokens) {
    const dropped = delivered.pop()!;
    used -= estimateTokenCount(dropped.entry.text);
    left.unshift(dropped.pin);
  }
  entries.push(...delivered.map(({ entry }) => entry));
  const byId = new Map([...configured, ...pinnedPages].map(page => [page.id, page]));
  for (const listing of allListings) byId.set(`${PIN_LIST_ID_PREFIX}${listing.origin.id}`, listing.origin);
  for (const entry of entries) {
    const page = byId.get(entry.id)!;
    entry.name = page.name;
    const scope = scopes.get(page.scopeId);
    if (scope) entry.scope = scope;
  }
  if (total > delivered.length) entries.push({ id: PIN_OVERFLOW_ID, text: line() });
  return entries;
}

/**
 * Each page's ref and visible note count, plus the address of every home scope reached. Walks the page
 * tree up one level per store call for all the pages together, so the cost is the tree depth, not the
 * pin count.
 */
async function pinLabels(
  run: KnowledgeRun,
  pages: KnowledgePage[],
): Promise<{ labels: Map<string, PinLabel>; scopes: Map<string, string> }> {
  const labels = new Map<string, PinLabel>();
  if (pages.length === 0) return { labels, scopes: new Map() };
  // An adapter older than countNotes (or a failing count) must not cost the pins themselves.
  const counts = run.storage
    .countNotes({ pageIds: pages.map(page => page.id), read: run.read })
    .catch((): Record<string, number> | undefined => undefined);
  const [noteCounts, { refs, scopes }] = await Promise.all([counts, knowledgePageRefs(run.storage, run.read, pages)]);
  for (const page of pages) {
    labels.set(page.id, { ref: refs.get(page.id)!, notes: noteCounts ? (noteCounts[page.id] ?? 0) : undefined });
  }
  return { labels, scopes };
}
