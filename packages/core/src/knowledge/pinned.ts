import { estimateTokenCount, sliceByTokens } from 'tokenx';
import { parseKnowledgePageRef } from '../storage/domains/knowledge';
import type { KnowledgeListedPin, KnowledgePage } from '../storage/domains/knowledge';
import { knowledgeScopeAddress } from './declarations';
import type { CompiledKnowledgeScopes } from './declarations';
import type { KnowledgeRun } from './run';

export const PINNED_KNOWLEDGE_STATE_ID = 'knowledge';

export const PINNED_SNAPSHOT_TAG = 'pinned-knowledge';
export const PINNED_DELTA_TAG = 'pinned-knowledge-update';

export const DEFAULT_MAX_PINS = 20;
export const DEFAULT_PINNED_MAX_TOKENS = 500;
export const MAX_PINNED_MAX_TOKENS = 2_000;

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

/** A config pin ref with `$params` bound from the held principal, split into scope address and key path. */
function bindConfigPin(ref: string, params: Record<string, string>): { address: string; path: string[] } | null {
  const parsed = parseKnowledgePageRef(ref);
  if (!parsed) return null;
  try {
    return { address: knowledgeScopeAddress(parsed.scope, params), path: parsed.path };
  } catch {
    return null;
  }
}

function render(page: KnowledgePage, maxTokens: number): string {
  const text = `${page.name} (${page.id}): ${page.body!.trim()}`;
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

async function configPinPages(run: KnowledgeRun): Promise<KnowledgePage[]> {
  const bound: { address: string; path: string[] }[] = [];
  for (const principal of run.principals) {
    const match = run.runtime.compiled.match(principal);
    if (!match) continue;
    for (const ref of [...(match.compiled.declaration.pinnedContext ?? []), ...(match.concrete?.pinnedContext ?? [])]) {
      const pin = bindConfigPin(ref, match.params);
      if (pin) bound.push(pin);
    }
  }
  if (bound.length === 0) return [];
  const scopes = await run.storage.getScopesByAddress([...new Set(bound.map(pin => pin.address))]);
  const pages = new Map<string, KnowledgePage>();
  for (const pin of bound) {
    const scope = scopes.find(candidate => candidate.address === pin.address);
    if (!scope) continue;
    // Resolved by path every run: a path with no page (not created yet, moved, deleted) delivers nothing.
    const page = await run.storage.getPageByPath({ scopeId: scope.id, path: pin.path, read: run.read });
    if (page && !page.deletedAt) pages.set(page.id, page);
  }
  return [...pages.values()];
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
  // pages, one for their scopes), plus the config-pin lookups; never one per pin.
  const configured = (await configPinPages(run)).filter(page => page.body?.trim());
  const entries: PinEntry[] = [];

  const full = configured.map(page => render(page, Number.POSITIVE_INFINITY));
  if (full.reduce((sum, text) => sum + estimateTokenCount(text), 0) > budget.maxTokens) {
    const share = Math.max(Math.floor(budget.maxTokens / configured.length), 1);
    for (const page of configured) entries.push({ id: page.id, text: render(page, share) });
  } else {
    configured.forEach((page, i) => entries.push({ id: page.id, text: full[i]! }));
  }

  const slots = Math.max(budget.maxPins - entries.length, 0);
  const { pins, total } = await rankedStoredPins(
    run,
    configured.map(page => page.id),
    slots + OVERFLOW_NAMES,
  );
  const pages = new Map(
    (await run.storage.getPages({ ids: pins.slice(0, slots).map(pin => pin.pageId), read: run.read })).map(page => [
      page.id,
      page,
    ]),
  );

  const minimum = estimateTokenCount(PIN_TRUNCATION_MARKER) + 8;
  let used = entries.reduce((sum, entry) => sum + estimateTokenCount(entry.text), 0);
  const delivered: PinEntry[] = [];
  const left: KnowledgeListedPin[] = [];
  for (const [i, pin] of pins.entries()) {
    const page = i < slots ? pages.get(pin.pageId) : undefined;
    const remaining = budget.maxTokens - used;
    if (!page || remaining < minimum) {
      left.push(pin);
      continue;
    }
    const text = render(page, remaining);
    used += estimateTokenCount(text);
    delivered.push({ id: page.id, text });
  }

  // The overflow line must fit too: give back the lowest-ranked delivered pins until it does.
  const line = () =>
    overflowLine(
      left.slice(0, OVERFLOW_NAMES).map(pin => pin.pageName),
      total - delivered.length - Math.min(left.length, OVERFLOW_NAMES),
    );
  while (total > delivered.length && delivered.length > 0 && used + estimateTokenCount(line()) > budget.maxTokens) {
    const dropped = delivered.pop()!;
    used -= estimateTokenCount(dropped.text);
    left.unshift(pins.find(pin => pin.pageId === dropped.id)!);
  }
  entries.push(...delivered);
  await labelEntries(run, entries, [...configured, ...pages.values()]);
  if (total > delivered.length) entries.push({ id: PIN_OVERFLOW_ID, text: line() });
  return entries;
}

/** Adds each entry's page name and home scope address, with one store call for all the scopes. */
async function labelEntries(run: KnowledgeRun, entries: PinEntry[], pages: KnowledgePage[]): Promise<void> {
  if (entries.length === 0) return;
  const byId = new Map(pages.map(page => [page.id, page]));
  const scopeIds = [...new Set(entries.map(entry => byId.get(entry.id)!.scopeId))];
  const addresses = new Map(
    (await run.storage.getPages({ ids: scopeIds, read: run.read })).map(scope => [scope.id, scope.address]),
  );
  for (const entry of entries) {
    const page = byId.get(entry.id)!;
    entry.name = page.name;
    const scope = addresses.get(page.scopeId);
    if (scope) entry.scope = scope;
  }
}
