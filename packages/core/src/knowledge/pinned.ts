import { estimateTokenCount, sliceByTokens } from 'tokenx';
import { parseKnowledgePageRef } from '../storage/domains/knowledge';
import type { KnowledgePage, KnowledgePin } from '../storage/domains/knowledge';
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
const STORED_PIN_PAGE = 100;

export interface PinEntry {
  id: string;
  text: string;
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

/** Highest `pinPriority` among the run's principals in a pin's audience. */
function priorityOf(compiled: CompiledKnowledgeScopes, pin: KnowledgePin, held: Set<string>): number {
  let best = Number.NEGATIVE_INFINITY;
  for (const address of pin.audience) {
    if (!held.has(address)) continue;
    const match = compiled.match(address);
    best = Math.max(best, match?.concrete?.pinPriority ?? match?.compiled.declaration.pinPriority ?? 0);
  }
  return best;
}

async function configPinPages(run: KnowledgeRun): Promise<KnowledgePage[]> {
  const pages = new Map<string, KnowledgePage>();
  for (const principal of run.principals) {
    const match = run.runtime.compiled.match(principal);
    if (!match) continue;
    for (const ref of [...(match.compiled.declaration.pins ?? []), ...(match.concrete?.pins ?? [])]) {
      const bound = bindConfigPin(ref, match.params);
      if (!bound) continue;
      const [scope] = await run.storage.getScopesByAddress([bound.address]);
      if (!scope) continue;
      // Resolved by path every run: a path with no page (not created yet, moved, deleted) delivers nothing.
      const page = await run.storage.getPageByPath({ scopeId: scope.id, path: bound.path, read: run.read });
      if (page && !page.deletedAt) pages.set(page.id, page);
    }
  }
  return [...pages.values()];
}

async function storedPins(run: KnowledgeRun): Promise<KnowledgePin[]> {
  const pins: KnowledgePin[] = [];
  let cursor: string | undefined;
  do {
    const result = await run.storage.listPins({
      audience: run.principals,
      read: run.read,
      cursor,
      limit: STORED_PIN_PAGE,
    });
    pins.push(...result.pins);
    cursor = result.nextCursor;
  } while (cursor);
  return pins;
}

/**
 * The pinned pages a run receives, rendered: config pins first (always delivered; an equal share each
 * when they alone exceed the token budget), then stored pins by `pinPriority` and recency while the
 * pin and token budgets last, then one line naming the stored pins that didn't fit. Only pages the
 * run can read and that have a body are delivered.
 */
export async function knowledgeDeliveredPins(run: KnowledgeRun, budget: PinBudget): Promise<PinEntry[]> {
  const configured = (await configPinPages(run)).filter(page => page.body?.trim());
  const configIds = new Set(configured.map(page => page.id));
  const entries: PinEntry[] = [];

  const full = configured.map(page => render(page, Number.POSITIVE_INFINITY));
  if (full.reduce((sum, text) => sum + estimateTokenCount(text), 0) > budget.maxTokens) {
    const share = Math.max(Math.floor(budget.maxTokens / configured.length), 1);
    for (const page of configured) entries.push({ id: page.id, text: render(page, share) });
  } else {
    configured.forEach((page, i) => entries.push({ id: page.id, text: full[i]! }));
  }

  const held = new Set(run.principals);
  const ranked = (await storedPins(run))
    .filter(pin => !configIds.has(pin.pageId))
    .map(pin => ({ pin, priority: priorityOf(run.runtime.compiled, pin, held) }))
    .sort((a, b) => b.priority - a.priority || b.pin.createdAt.getTime() - a.pin.createdAt.getTime());

  const minimum = estimateTokenCount(PIN_TRUNCATION_MARKER) + 8;
  let used = entries.reduce((sum, entry) => sum + estimateTokenCount(entry.text), 0);
  const overflow: string[] = [];
  for (const { pin } of ranked) {
    const page = await run.storage.getPage({ id: pin.pageId, read: run.read });
    if (!page || page.deletedAt || !page.body?.trim()) continue;
    const remaining = budget.maxTokens - used;
    if (entries.length >= budget.maxPins || remaining < minimum) {
      overflow.push(page.name);
      continue;
    }
    const text = render(page, remaining);
    used += estimateTokenCount(text);
    entries.push({ id: page.id, text });
  }
  if (overflow.length > 0) {
    entries.push({ id: PIN_OVERFLOW_ID, text: `Also pinned (open with knowledge_read): ${overflow.join(', ')}` });
  }
  return entries;
}
