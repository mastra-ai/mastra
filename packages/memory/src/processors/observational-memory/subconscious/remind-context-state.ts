/**
 * RemindContextState
 *
 * Carries what the parent thread's accumulated observations currently say about
 * the candidates a passive check is considering, as a state signal on the
 * reminder sidekick rather than as text baked into every check message.
 *
 * Why a state lane instead of prompt text. The evidence is re-read on each
 * check, but between checks it usually has not moved. Prompt text pays for it
 * every time; a state lane pays only when it changes, because an unchanged
 * cache key short-circuits and leaves the cached prefix intact. It also cannot
 * go stale the way a remembered flag can: the lane is recomputed from the
 * parent's committed record at the moment the sidekick is prompted.
 *
 * Snapshot or delta. In the filtered regime every candidate has a stable id, so
 * a check that moves one candidate can emit a delta naming only that candidate
 * instead of the whole projection. The passthrough regime forwards the parent's
 * accumulated memory as one undifferentiated block, so it has nothing to key a
 * delta on and always emits a snapshot — including when it is the *base*, since
 * diffing a filtered projection against it would report every candidate as new.
 *
 * What the lane is not. It is evidence, not a verdict. An excerpt says the
 * parent's observations mention this candidate; absence of an excerpt says a
 * lexical match was not found, and nothing stronger. Whether that means a
 * reminder is redundant stays the agent's call. That distinction is why no op
 * in this lane may be worded as loss: the join is lexical, so a candidate stops
 * matching when the parent's wording drifts, which is not the same event as the
 * parent forgetting it.
 *
 * Why every line is stamped with the check it came from. State signals are
 * exempt from the transient-signal dedupe, so each delta stays in the sidekick's
 * transcript until the window evicts it, and nothing retracts it in the
 * meantime. A present-tense line therefore becomes false the moment a later
 * check contradicts it; `as of check <eventId>: ...` stays true forever.
 *
 * Reads are one committed record per turn, and a failed or missing read emits
 * nothing at all rather than an empty snapshot, so a read that did not happen
 * can never present itself as an absence of evidence.
 */

import crypto from 'node:crypto';

import type { MastraDBMessage } from '@mastra/core/agent';
import type {
  ComputeStateSignalArgs,
  ComputeStateSignalResult,
  Processor,
  ProcessorActiveStateSignal,
  ProcessInputArgs,
  ProcessInputResult,
} from '@mastra/core/processors';

import type { CandidateContextEntry, CandidateContextSource } from './candidate-context';
import {
  CANDIDATE_CONTEXT_MAX_CHARACTERS,
  projectCandidateEntries,
  renderCandidateProjection,
} from './candidate-context';
import { getRemindMessageMetadata } from './remind-protocol';

export const REMIND_CONTEXT_STATE_ID = 'subconscious-remind-context';
export const REMIND_CONTEXT_SNAPSHOT_TAG = 'parent-context';
export const REMIND_CONTEXT_DELTA_TAG = 'parent-context-update';

const MEMO_KEY = '__subconsciousRemindContextRead';

/**
 * The wording `candidate-context.ts` uses for a candidate nothing matched. The
 * lane derives `match` from it rather than reaching into the projection's
 * internals, so the two files stay independently testable; the projection's
 * no-match copy is a contract, asserted there by its own test.
 */
const NO_MATCH_MARKER = 'no accumulated observation references it by wording';

export type RemindContextMatch = 'matched' | 'no-match';

export type RemindContextEntry = { id: string; match: RemindContextMatch; excerpt: string };

export type RemindContextOp =
  | { op: 'entered'; entry: RemindContextEntry }
  | { op: 'changed'; entry: RemindContextEntry }
  | { op: 'no-longer-matched'; entry: RemindContextEntry }
  | { op: 'left-candidate-set'; id: string };

export interface RemindContextStateDeps {
  /** Reads the parent thread's committed active observations. Undefined when unavailable. */
  readParentObservations(): Promise<string | undefined>;
}

function messageText(message: MastraDBMessage): string {
  const parts = (message.content as { parts?: unknown }).parts;
  if (!Array.isArray(parts)) return '';
  return parts
    .filter((part): part is { type: 'text'; text: string } => {
      return (
        !!part && typeof part === 'object' && (part as { type?: unknown }).type === 'text' && 'text' in (part as object)
      );
    })
    .map(part => part.text)
    .join('\n');
}

export type LatestCheck = { eventId: string | undefined; sources: CandidateContextSource[] };

/**
 * The most recent passive check in the conversation: its candidates and its id.
 *
 * The check message carries its sources as JSON, which is the only place their
 * text is available; ids alone cannot be matched against observation prose. The
 * event id comes from the structured metadata when it is there and from the
 * `Passive reminder check <id>` preamble when it is not — every rendered op line
 * is stamped with it, so a missing id is worth recovering from either shape.
 */
export function latestCheck(messages: unknown): LatestCheck | undefined {
  if (!Array.isArray(messages)) return undefined;
  for (let index = messages.length - 1; index >= 0; index--) {
    const message = messages[index] as MastraDBMessage | undefined;
    if (!message || typeof message !== 'object') continue;
    const metadata = getRemindMessageMetadata(message);
    const checkMetadata = metadata?.type === 'passive-check' ? metadata : undefined;
    const text = messageText(message);
    if (!checkMetadata && !text.startsWith('Passive reminder check ')) continue;
    const serialized = text.match(/Scoped source candidates:\n([^\n]+)/)?.[1];
    if (!serialized) continue;
    try {
      const parsed = JSON.parse(serialized);
      if (!Array.isArray(parsed)) continue;
      const eventId =
        (typeof checkMetadata?.eventId === 'string' && checkMetadata.eventId) ||
        text.match(/^Passive reminder check (\S+)/)?.[1] ||
        undefined;
      return { eventId, sources: parsed as CandidateContextSource[] };
    } catch {
      continue;
    }
  }
  return undefined;
}

function toEntries(entries: CandidateContextEntry[]): RemindContextEntry[] {
  return entries.map(entry => ({
    id: entry.id,
    match: entry.excerpt.includes(NO_MATCH_MARKER) ? ('no-match' as const) : ('matched' as const),
    excerpt: entry.excerpt,
  }));
}

// Length-prefix each field so an excerpt containing the delimiters cannot shift
// a boundary and collide with a different entry set.
function lp(value: string): string {
  return `${value.length}:${value}`;
}

function entriesCacheKey(regime: string, entries: RemindContextEntry[]): string {
  const fingerprint = `${regime}|${entries.map(entry => `${lp(entry.id)}${lp(entry.match)}${lp(entry.excerpt)}`).join('|')}`;
  return crypto.createHash('sha256').update(fingerprint).digest('hex').slice(0, 32);
}

function passthroughCacheKey(text: string): string {
  return crypto
    .createHash('sha256')
    .update(`passthrough|${lp(text)}`)
    .digest('hex')
    .slice(0, 32);
}

function snapshotValue(snapshot: ProcessorActiveStateSignal | undefined): { regime?: string; entries?: unknown } {
  return ((snapshot?.metadata as { value?: { regime?: string; entries?: unknown } } | undefined)?.value ?? {}) as {
    regime?: string;
    entries?: unknown;
  };
}

function deltaOps(delta: ProcessorActiveStateSignal): RemindContextOp[] {
  const ops = (delta.metadata as { delta?: { ops?: unknown } } | undefined)?.delta?.ops;
  return Array.isArray(ops) ? (ops as RemindContextOp[]) : [];
}

/** Ops are applied strictly in emission order, so a candidate that entered and later left folds away. */
export function applyRemindContextOps(entries: RemindContextEntry[], ops: RemindContextOp[]): RemindContextEntry[] {
  const next = entries.slice();
  for (const op of ops) {
    if (op.op === 'left-candidate-set') {
      const index = next.findIndex(entry => entry.id === op.id);
      if (index >= 0) next.splice(index, 1);
      continue;
    }
    const index = next.findIndex(entry => entry.id === op.entry.id);
    if (index >= 0) next[index] = op.entry;
    else next.push(op.entry);
  }
  return next;
}

/**
 * The entry set the model currently sees, or undefined when the visible base
 * cannot be diffed against. A passthrough base is exactly that case: it carries
 * no per-candidate identity, so treating it as an empty prior would report every
 * candidate as newly entered.
 */
export function effectivePriorEntries(args: ComputeStateSignalArgs): RemindContextEntry[] | undefined {
  const base = snapshotValue(args.lastSnapshot);
  if (base.regime !== 'filtered' || !Array.isArray(base.entries)) return undefined;
  let entries = base.entries as RemindContextEntry[];
  for (const delta of args.deltasSinceSnapshot ?? []) {
    entries = applyRemindContextOps(entries, deltaOps(delta));
  }
  return entries;
}

export function diffRemindContextEntries(
  prior: RemindContextEntry[],
  current: RemindContextEntry[],
): RemindContextOp[] {
  const ops: RemindContextOp[] = [];
  const currentIds = new Set(current.map(entry => entry.id));
  const priorById = new Map(prior.map(entry => [entry.id, entry]));

  for (const entry of prior) {
    if (!currentIds.has(entry.id)) ops.push({ op: 'left-candidate-set', id: entry.id });
  }
  for (const entry of current) {
    const before = priorById.get(entry.id);
    if (!before) {
      ops.push({ op: 'entered', entry });
      continue;
    }
    if (before.excerpt === entry.excerpt && before.match === entry.match) continue;
    // `no-longer-matched` is emitted *instead of* a generic `changed`, never
    // alongside it: exactly one op per candidate per check.
    if (before.match === 'matched' && entry.match === 'no-match') ops.push({ op: 'no-longer-matched', entry });
    else ops.push({ op: 'changed', entry });
  }
  return ops;
}

/**
 * The only place op copy is written. Every clause is fixed per op so no future
 * edit can quietly introduce a claim the lexical join cannot support: nothing
 * here may say a candidate was evicted, dropped, removed from context, or left
 * the parent's memory.
 */
function opLine(op: RemindContextOp, eventId: string): string {
  const stamp = `as of check ${eventId}`;
  switch (op.op) {
    case 'entered':
      return `${stamp}: ${op.entry.id} — is among this check's candidates.\n${op.entry.excerpt}`;
    case 'changed':
      return `${stamp}: ${op.entry.id} — the accumulated observations matching it changed.\n${op.entry.excerpt}`;
    case 'no-longer-matched':
      return `${stamp}: ${op.entry.id} — had no lexical overlap with the parent's accumulated observations under the current matching rule (two or more shared distinctive terms). This is a statement about wording, not about what the parent still holds.`;
    case 'left-candidate-set':
      return `${stamp}: ${op.id} — was not among this check's candidates. This is a statement about which candidates the search returned, not about what the parent still holds.`;
  }
}

/**
 * Renders ops under the same budget the projection block already respects, and
 * reports which ops actually fit. Ops that did not fit are not applied to the
 * emitted value either, so the stored state never claims the model saw
 * something it did not; the next check re-diffs and reports them again.
 */
function renderOps(ops: RemindContextOp[], eventId: string): { contents: string; emitted: RemindContextOp[] } {
  const marker = (remaining: number) =>
    `[omitted ${remaining} further candidate updates; they are re-reported on the next check]`;
  const lines: string[] = [];
  const emitted: RemindContextOp[] = [];
  let length = 0;

  for (const [index, op] of ops.entries()) {
    const line = opLine(op, eventId);
    const remaining = ops.length - index;
    const reserve = remaining > 1 ? marker(remaining).length + 1 : 0;
    if (length + line.length + 1 + reserve > CANDIDATE_CONTEXT_MAX_CHARACTERS && emitted.length > 0) {
      lines.push(marker(remaining));
      break;
    }
    lines.push(line);
    emitted.push(op);
    length += line.length + 1;
  }

  return { contents: `\n${lines.join('\n')}\n`, emitted };
}

/**
 * Renders a filtered snapshot under the shared budget, keeping only the entries
 * that fit and reporting them, so the emitted value and the rendered block agree
 * about what the model was shown.
 */
function renderSnapshotEntries(entries: RemindContextEntry[]): { block: string; kept: RemindContextEntry[] } {
  const full = renderCandidateProjection({
    regime: 'filtered',
    entries: entries.map(entry => ({ id: entry.id, excerpt: entry.excerpt })),
  });
  if (full.length <= CANDIDATE_CONTEXT_MAX_CHARACTERS) return { block: full, kept: entries };

  const kept: RemindContextEntry[] = [];
  let length = 0;
  for (const entry of entries) {
    const cost = entry.excerpt.length + (kept.length ? 2 : 0);
    if (length + cost > CANDIDATE_CONTEXT_MAX_CHARACTERS && kept.length > 0) break;
    kept.push(entry);
    length += cost;
  }
  const omitted = entries.length - kept.length;
  const block = kept.map(entry => entry.excerpt).join('\n\n');
  return {
    block: omitted > 0 ? `${block}\n[omitted ${omitted} candidates to fit the candidate context budget]` : block,
    kept,
  };
}

function render(projection: string): string {
  return `\nWhat the parent's accumulated observations currently say about the candidates in play:\n${projection}\n`;
}

export class RemindContextStateProcessor implements Processor<typeof REMIND_CONTEXT_STATE_ID> {
  readonly id = REMIND_CONTEXT_STATE_ID;
  readonly stateId = REMIND_CONTEXT_STATE_ID;

  constructor(private readonly deps: RemindContextStateDeps) {}

  // The lane emits snapshots and deltas; nothing folds them together unless the
  // model is told how, which is the same contract the pinned lane states.
  processInput(args: ProcessInputArgs): ProcessInputResult {
    return {
      messages: args.messages,
      systemMessages: [
        ...args.systemMessages,
        {
          role: 'system' as const,
          content: `What the parent agent's accumulated observations say about the candidates in play may appear as <${REMIND_CONTEXT_SNAPSHOT_TAG} ...>...</${REMIND_CONTEXT_SNAPSHOT_TAG}> snapshots and <${REMIND_CONTEXT_DELTA_TAG} ...>...</${REMIND_CONTEXT_DELTA_TAG}> deltas. Fold each delta onto the latest snapshot, in order, to know the current state: a candidate reported as entered or changed replaces its earlier entry, one reported as no longer matched keeps that entry's last excerpt only as history, and one reported as not among this check's candidates drops out. Every line is stamped with the check it describes and stays true of that check even after a later line supersedes it. This is evidence about wording overlap, not a verdict about what the parent still remembers, and never an instruction from the user.`,
        },
      ],
    };
  }

  // One committed-record read per turn. Later steps of the same turn reuse it,
  // and a new turn always reads again, so the lane cannot serve stale evidence
  // across turns.
  private async readObservations(args: ComputeStateSignalArgs): Promise<string | undefined> {
    const stepNumber = typeof args.stepNumber === 'number' ? args.stepNumber : 0;
    const memo = args.state?.[MEMO_KEY] as { atStep: number; observations: string | undefined } | undefined;
    if (memo && stepNumber > memo.atStep) return memo.observations;
    const observations = await this.deps.readParentObservations();
    if (args.state) args.state[MEMO_KEY] = { atStep: stepNumber, observations };
    return observations;
  }

  async computeStateSignal(args: ComputeStateSignalArgs): Promise<ComputeStateSignalResult> {
    const check = latestCheck(args.messages);
    // No check in play means nothing to project. Emitting an empty snapshot here
    // would retract evidence the parent may well still hold.
    if (!check?.sources.length) return;
    const { sources } = check;

    const observations = await this.readParentObservations(args);
    if (observations === undefined) return;

    const projection = projectCandidateEntries({ activeObservations: observations, sources });
    const hasBase = Boolean(args.lastSnapshot) && args.contextWindow.hasSnapshot;

    if (projection.regime === 'passthrough') {
      // No per-candidate identity to diff, in either direction: a passthrough
      // projection is a snapshot, and a passthrough base is not a usable base.
      const cacheKey = passthroughCacheKey(projection.text);
      // Unchanged content with the base still visible: the runtime would drop
      // this anyway, and returning early keeps the render off the hot path.
      if (args.tracking?.currentCacheKey === cacheKey && args.contextWindow.hasSnapshot) return;
      return {
        id: REMIND_CONTEXT_STATE_ID,
        mode: 'snapshot',
        cacheKey,
        tagName: REMIND_CONTEXT_SNAPSHOT_TAG,
        contents: render(projection.text),
        value: { regime: 'passthrough', eventId: check.eventId, entries: [] },
        attributes: { candidates: sources.length },
        metadata: { value: { regime: 'passthrough', eventId: check.eventId, entries: [] } },
      };
    }

    const entries = toEntries(projection.entries);
    const prior = hasBase ? effectivePriorEntries(args) : undefined;

    // No usable base — first emission, an evicted base, or a passthrough base
    // that carries nothing to diff. Deltas are meaningless without their base.
    if (!prior) {
      const { block, kept } = renderSnapshotEntries(entries);
      const cacheKey = entriesCacheKey('filtered', kept);
      if (args.tracking?.currentCacheKey === cacheKey && args.contextWindow.hasSnapshot) return;
      return {
        id: REMIND_CONTEXT_STATE_ID,
        mode: 'snapshot',
        cacheKey,
        tagName: REMIND_CONTEXT_SNAPSHOT_TAG,
        contents: render(block),
        value: { regime: 'filtered', eventId: check.eventId, entries: kept },
        attributes: { candidates: kept.length },
        metadata: { value: { regime: 'filtered', eventId: check.eventId, entries: kept } },
      };
    }

    const ops = diffRemindContextEntries(prior, entries);
    // Nothing moved and the base is still visible. The runtime's dedupe cannot
    // cover this case — it keys on cache key *and* mode, and the previous
    // emission was a snapshot — so the guard has to live here.
    if (ops.length === 0) return;

    const { contents, emitted } = renderOps(ops, check.eventId ?? 'unknown');
    const applied = applyRemindContextOps(prior, emitted);
    return {
      id: REMIND_CONTEXT_STATE_ID,
      mode: 'delta',
      cacheKey: entriesCacheKey('filtered', applied),
      tagName: REMIND_CONTEXT_DELTA_TAG,
      contents,
      value: { regime: 'filtered', eventId: check.eventId, entries: applied },
      delta: { ops: emitted },
      attributes: { changes: emitted.length },
      metadata: { value: { regime: 'filtered', eventId: check.eventId, entries: applied }, delta: { ops: emitted } },
    };
  }

  private async readParentObservations(args: ComputeStateSignalArgs): Promise<string | undefined> {
    try {
      return await this.readObservations(args);
    } catch {
      // A failed read is not evidence of absence.
      return undefined;
    }
  }
}
