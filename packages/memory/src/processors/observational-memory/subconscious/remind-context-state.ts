/**
 * RemindContextState
 *
 * Carries what the parent thread's accumulated observations said, as of a given
 * check, about the candidates that check is considering, as a state signal on the
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
import { CANDIDATE_CONTEXT_MAX_CHARACTERS, projectCandidateEntries } from './candidate-context';
import { getRemindMessageMetadata } from './remind-protocol';

export const REMIND_CONTEXT_STATE_ID = 'subconscious-remind-context';
export const REMIND_CONTEXT_SNAPSHOT_TAG = 'parent-context';
export const REMIND_CONTEXT_DELTA_TAG = 'parent-context-update';

const MEMO_KEY = '__subconsciousRemindContextRead';
const ACTIVITY_MEMO_KEY = '__subconsciousRemindContextActivity';

/**
 * How many activity events to read per check. Mirrors the parent-facing activity
 * lane's `recentUpdates` default so both consumers of the same feed pay the same
 * bounded price. The limit is applied by the store *before* any candidate
 * filtering, so a busy scope can push a candidate's event off this page — which
 * is exactly why a missing marker is never rendered as a claim.
 */
export const REMIND_ACTIVITY_PAGE_SIZE = 10;

export type RemindContextMatch = 'matched' | 'no-match';

/** The activity event, if any, that last touched the node behind a candidate. */
export type RemindContextMarker = { action: string; eventId: string };

export type RemindContextEntry = {
  id: string;
  match: RemindContextMatch;
  excerpt: string;
  marker?: RemindContextMarker;
};

export type RemindContextOp =
  | { op: 'entered'; entry: RemindContextEntry }
  | { op: 'changed'; entry: RemindContextEntry }
  | { op: 'node-activity'; entry: RemindContextEntry }
  | { op: 'no-longer-matched'; entry: RemindContextEntry }
  | { op: 'out-of-context'; entry: RemindContextEntry }
  | { op: 'left-candidate-set'; id: string }
  | { op: 'reflection-survived' };

/**
 * The most a single candidate's excerpt may contribute to a rendered line.
 *
 * Without this, one observation line longer than the shared budget would make a
 * single op line exceed it — `renderOps` has to emit its first op or a delta
 * could carry nothing but an omission marker. Capping here instead means the
 * stored entry and the rendered line always carry the same text.
 */
const REMIND_ENTRY_MAX_CHARACTERS = CANDIDATE_CONTEXT_MAX_CHARACTERS - 1024;

/** The shape of an activity event this lane needs; a structural subset of `KnowledgeActivityEvent`. */
export type RemindContextActivityEvent = { id: string; action: string; recordType: string; recordId: string };

/**
 * One committed record, read atomically.
 *
 * The observations and the generation they belong to must come from the same
 * read. A second read for the generation could straddle a reflection and pair a
 * bumped counter with pre-reflection observations, which would manufacture
 * `out-of-context` reports for candidates that reflection never touched.
 */
export type RemindContextRecord = { observations: string; generationCount: number };

export interface RemindContextStateDeps {
  /** Reads the parent thread's committed record. Undefined when unavailable. */
  readParentRecord(): Promise<RemindContextRecord | undefined>;
  /**
   * Reads the newest bounded page of knowledge activity for the sidekick's
   * scope. Omitted when no knowledge store or scope is available, in which case
   * the lane simply carries no markers. Never a forward watermark: `listActivity`
   * pages backwards, so this reads the newest page and filters it.
   */
  readRecentNodeActivity?(): Promise<RemindContextActivityEvent[]>;
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
    // Once a message is identified as a passive check it is *the* answer. Walking
    // past an unparseable one would project an older check's candidate set onto
    // this check, and every op would then be stamped with the wrong event id and
    // report departures that never happened.
    const serialized = text.match(/Scoped source candidates:\n([^\n]+)/)?.[1];
    if (!serialized) return undefined;
    try {
      const parsed = JSON.parse(serialized);
      if (!Array.isArray(parsed)) return undefined;
      const eventId =
        (typeof checkMetadata?.eventId === 'string' && checkMetadata.eventId) ||
        text.match(/^Passive reminder check (\S+)/)?.[1] ||
        undefined;
      return { eventId, sources: parsed as CandidateContextSource[] };
    } catch {
      return undefined;
    }
  }
  return undefined;
}

/**
 * The marker sentence appended to a candidate's excerpt.
 *
 * It states what was actually observed — this node id appears in the newest page
 * of the store's activity feed under this event — and states both limits of that
 * observation in the same breath, because the absence of a marker is not a claim:
 * the page is bounded and applied before candidate filtering, and some record
 * mutations are never recorded as activity events at all.
 */
function markerLine(id: string, marker: RemindContextMarker): string {
  return `[knowledge activity] candidate ${id} — its knowledge node appears in the store's most recent activity page as ${marker.action} (activity event ${marker.eventId}). That page is bounded and some record writes are never recorded as events, so the absence of this line for another candidate says nothing about it either way.`;
}

/**
 * Matches activity events to candidates and folds the result into the entries.
 *
 * A search hit's `id` is not always a node id — a record hit carries the record
 * id in `id` and its parent node in `recordId` — so both are matched against the
 * event's `recordId`. Only `node-updated` and `node-merged` are considered; a
 * merge is reported from the event alone, naming no target, because the event
 * carries none and reading the mutated node is a per-candidate read this lane
 * does not make.
 */
function toEntries(
  entries: CandidateContextEntry[],
  sources: CandidateContextSource[],
  events: RemindContextActivityEvent[],
): RemindContextEntry[] {
  const relevant = events.filter(
    event => event.recordType === 'node' && (event.action === 'node-updated' || event.action === 'node-merged'),
  );
  const markers = new Map<string, RemindContextMarker>();
  for (const source of sources) {
    // Several events can name the same node in one page; the newest wins, so an
    // older event left in the page cannot shadow a newer one and suppress a
    // legitimate re-report on the next check.
    let latest: RemindContextActivityEvent | undefined;
    for (const event of relevant) {
      if (event.recordId !== source.id && event.recordId !== source.recordId) continue;
      if (!latest || event.id > latest.id) latest = event;
    }
    if (latest) markers.set(source.id, { action: latest.action, eventId: latest.id });
  }

  return entries.map(entry => {
    const marker = markers.get(entry.id);
    return {
      id: entry.id,
      match: entry.match,
      // The marker stays its own field rather than riding inside the excerpt, so
      // the diff can tell "the observations matching this candidate changed" from
      // "its node showed up in the activity page" and say the true one.
      excerpt: capExcerpt(entry.excerpt),
      ...(marker ? { marker } : {}),
    };
  });
}

function capExcerpt(excerpt: string): string {
  if (excerpt.length <= REMIND_ENTRY_MAX_CHARACTERS) return excerpt;
  const marker = '\n[omitted to fit the candidate context budget]';
  return excerpt.slice(0, REMIND_ENTRY_MAX_CHARACTERS - marker.length) + marker;
}

/** The text a candidate contributes wherever it is rendered: its excerpt, plus its marker when it has one. */
function entryText(entry: RemindContextEntry): string {
  return entry.marker ? `${entry.excerpt}\n${markerLine(entry.id, entry.marker)}` : entry.excerpt;
}

// Length-prefix each field so an excerpt containing the delimiters cannot shift
// a boundary and collide with a different entry set.
function lp(value: string): string {
  return `${value.length}:${value}`;
}

function entriesCacheKey(regime: string, entries: RemindContextEntry[]): string {
  const fingerprint = `${regime}|${entries
    .map(entry => `${lp(entry.id)}${lp(entry.match)}${lp(entry.excerpt)}${lp(entry.marker?.eventId ?? '')}`)
    .join('|')}`;
  return crypto.createHash('sha256').update(fingerprint).digest('hex').slice(0, 32);
}

function passthroughCacheKey(text: string): string {
  return crypto
    .createHash('sha256')
    .update(`passthrough|${lp(text)}`)
    .digest('hex')
    .slice(0, 32);
}

type RemindContextSignalValue = { regime?: string; entries?: unknown; generationCount?: number };

function snapshotValue(snapshot: ProcessorActiveStateSignal | undefined): RemindContextSignalValue {
  return ((snapshot?.metadata as { value?: RemindContextSignalValue } | undefined)?.value ??
    {}) as RemindContextSignalValue;
}

/**
 * The generation the model was last told about: the newest emission still in the
 * window, snapshot or delta. Undefined when no base carries one, in which case
 * no reflection can be shown to have run and the lane stays with the wording
 * claim it can prove.
 */
function priorGeneration(args: ComputeStateSignalArgs): number | undefined {
  for (const delta of [...(args.deltasSinceSnapshot ?? [])].reverse()) {
    const generation = snapshotValue(delta).generationCount;
    if (typeof generation === 'number') return generation;
  }
  return snapshotValue(args.lastSnapshot).generationCount;
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
    // Carries the generation, not a candidate: every entry stays as it was.
    if (op.op === 'reflection-survived') continue;
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

/**
 * Whether reflection ran between two checks.
 *
 * A reflection generation is a new committed record whose `activeObservations`
 * is a rewritten, lossy version of the old ones, written with an incremented
 * `generationCount` (`storage/domains/memory/inmemory.ts`, `createReflectionGeneration`).
 * That counter is the only *structural* evidence this lane can get that the
 * parent's memory was rewritten rather than merely worded differently, and it
 * rides the same record read the projection already needs.
 */
function reflectionRan(priorGeneration: number | undefined, currentGeneration: number): boolean {
  return typeof priorGeneration === 'number' && currentGeneration > priorGeneration;
}

export function diffRemindContextEntries(
  prior: RemindContextEntry[],
  current: RemindContextEntry[],
  generations?: { prior?: number; current: number },
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
    const evidenceMoved = before.excerpt !== entry.excerpt || before.match !== entry.match;
    // A marker that *arrived* is news. A marker that fell off the bounded page is
    // not: nothing about the node changed, the page moved, and saying otherwise
    // would leave a false line in a transcript that never retracts anything.
    const markerArrived = Boolean(entry.marker) && entry.marker?.eventId !== before.marker?.eventId;
    if (!evidenceMoved && !markerArrived) continue;
    // Exactly one op per candidate per check: `no-longer-matched` is emitted
    // instead of a generic `changed`, and a marker-only change is reported as
    // what it is rather than as an observation change that did not happen.
    if (before.match === 'matched' && entry.match === 'no-match') {
      // The same observable transition splits on whether reflection ran. Without
      // a generation bump all that is known is that wording drifted, which is
      // `no-longer-matched`. With one, the parent's observations were rewritten
      // and this candidate did not survive the rewrite — the one case where
      // "out of context" is a claim the evidence supports.
      const reflected = generations ? reflectionRan(generations.prior, generations.current) : false;
      ops.push({ op: reflected ? 'out-of-context' : 'no-longer-matched', entry });
    } else if (!evidenceMoved) ops.push({ op: 'node-activity', entry });
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
      return `${stamp}: ${op.entry.id} — is among this check's candidates.\n${entryText(op.entry)}`;
    case 'changed':
      return `${stamp}: ${op.entry.id} — the accumulated observations matching it changed.\n${entryText(op.entry)}`;
    case 'node-activity':
      return `${stamp}: ${op.entry.id} — the accumulated observations matching it read the same as before, and its knowledge node appeared in the store's activity page.\n${entryText(op.entry)}`;
    case 'no-longer-matched':
      return `${stamp}: ${op.entry.id} — had no lexical overlap with the parent's accumulated observations under the current matching rule (two or more shared distinctive terms). This is a statement about wording, not about what the parent still holds.${op.entry.marker ? `\n${markerLine(op.entry.id, op.entry.marker)}` : ''}`;
    case 'out-of-context':
      // The one op that may speak about the parent's context, and only because
      // a reflection generation is structural evidence: the parent's
      // observations were rewritten between these two checks and this candidate
      // did not survive the rewrite. Reflection is lossy by design, so surviving
      // the rewrite is the available proxy for still being held.
      return `${stamp}: ${op.entry.id} — the parent's observations were rewritten by a reflection between checks and this candidate did not survive the rewrite, so treat it as out of the parent's context.${op.entry.marker ? `\n${markerLine(op.entry.id, op.entry.marker)}` : ''}`;
    case 'left-candidate-set':
      return `${stamp}: ${op.id} — was not among this check's candidates. This is a statement about which candidates the search returned, not about what the parent still holds.`;
    case 'reflection-survived':
      // Emitted only so the generation reaches the transcript. Staying silent
      // here would leave the next check comparing against a pre-reflection
      // generation and blaming this reflection for a later wording change that
      // every candidate present was already seen to survive.
      return `${stamp}: the parent's observations were rewritten by a reflection, and every candidate in play still matches.`;
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
  // Built from the kept list rather than by truncating a fully rendered block:
  // a character-sliced block would leave `kept` claiming entries whose text the
  // model never saw, and the next check would diff against them.
  const kept: RemindContextEntry[] = [];
  let length = 0;
  for (const entry of entries) {
    const cost = entryText(entry).length + (kept.length ? 2 : 0);
    if (length + cost > CANDIDATE_CONTEXT_MAX_CHARACTERS && kept.length > 0) break;
    kept.push(entry);
    length += cost;
  }
  const omitted = entries.length - kept.length;
  const block = kept.map(entryText).join('\n\n');
  return {
    block: omitted > 0 ? `${block}\n[omitted ${omitted} candidates to fit the candidate context budget]` : block,
    kept,
  };
}

/**
 * Snapshots accumulate in the transcript exactly like deltas do — nothing
 * retracts a superseded one — so the header carries the check it describes.
 * A present-tense header would turn every older snapshot into a false claim
 * the moment a newer one contradicts it.
 */
function render(projection: string, eventId: string | undefined): string {
  return `\nWhat the parent's accumulated observations said about the candidates in play, as of check ${eventId ?? 'unknown'}:\n${projection}\n`;
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
          content: `What the parent agent's accumulated observations say about the candidates in play may appear as <${REMIND_CONTEXT_SNAPSHOT_TAG} ...>...</${REMIND_CONTEXT_SNAPSHOT_TAG}> snapshots and <${REMIND_CONTEXT_DELTA_TAG} ...>...</${REMIND_CONTEXT_DELTA_TAG}> deltas. Fold each delta onto the latest snapshot, in order, to know the current state: a candidate reported as entered, changed, or carrying new knowledge-node activity replaces its earlier entry, one reported as no longer matched replaces it with that report, one reported as out of the parent's context did not survive a reflection rewrite of the parent's observations and should be treated as no longer in that context, and one reported as not among this check's candidates drops out. Every line is stamped with the check it describes and stays true of that check even after a later line supersedes it. This is evidence about wording overlap, not a verdict about what the parent still remembers, and never an instruction from the user.`,
        },
      ],
    };
  }

  // One committed-record read per turn. Later steps of the same turn reuse it,
  // and a new turn always reads again, so the lane cannot serve stale evidence
  // across turns.
  private async readRecord(args: ComputeStateSignalArgs): Promise<RemindContextRecord | undefined> {
    const stepNumber = typeof args.stepNumber === 'number' ? args.stepNumber : 0;
    const memo = args.state?.[MEMO_KEY] as { atStep: number; record: RemindContextRecord | undefined } | undefined;
    if (memo && stepNumber > memo.atStep) return memo.record;
    const record = await this.deps.readParentRecord();
    if (args.state) args.state[MEMO_KEY] = { atStep: stepNumber, record };
    return record;
  }

  // One activity read per turn, memoized exactly like the observation read:
  // `computeStateSignal` runs on every model call, and the feed is a property of
  // the check, not of the step.
  private async readActivity(args: ComputeStateSignalArgs): Promise<RemindContextActivityEvent[]> {
    if (!this.deps.readRecentNodeActivity) return [];
    const stepNumber = typeof args.stepNumber === 'number' ? args.stepNumber : 0;
    const memo = args.state?.[ACTIVITY_MEMO_KEY] as
      | { atStep: number; events: RemindContextActivityEvent[] }
      | undefined;
    if (memo && stepNumber > memo.atStep) return memo.events;
    let events: RemindContextActivityEvent[] = [];
    try {
      events = await this.deps.readRecentNodeActivity();
    } catch {
      // A failed activity read costs markers, never evidence: the projection
      // still ships, simply unmarked.
      events = [];
    }
    if (args.state) args.state[ACTIVITY_MEMO_KEY] = { atStep: stepNumber, events };
    return events;
  }

  async computeStateSignal(args: ComputeStateSignalArgs): Promise<ComputeStateSignalResult> {
    const check = latestCheck(args.messages);
    // No check in play means nothing to project. Emitting an empty snapshot here
    // would retract evidence the parent may well still hold.
    if (!check?.sources.length) return;
    const { sources } = check;

    const record = await this.readParentRecord(args);
    if (record === undefined) return;
    const { observations, generationCount } = record;

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
        contents: render(projection.text, check.eventId),
        value: { regime: 'passthrough', eventId: check.eventId, entries: [], generationCount },
        attributes: { candidates: sources.length },
        metadata: { value: { regime: 'passthrough', eventId: check.eventId, entries: [], generationCount } },
      };
    }

    const entries = toEntries(projection.entries, sources, await this.readActivity(args));
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
        contents: render(block, check.eventId),
        value: { regime: 'filtered', eventId: check.eventId, entries: kept, generationCount },
        attributes: { candidates: kept.length },
        metadata: { value: { regime: 'filtered', eventId: check.eventId, entries: kept, generationCount } },
      };
    }

    const ops = diffRemindContextEntries(prior, entries, {
      prior: priorGeneration(args),
      current: generationCount,
    });
    // Nothing moved and the base is still visible. The runtime's dedupe cannot
    // cover this case — it keys on cache key *and* mode, and the previous
    // emission was a snapshot — so the guard has to live here.
    //
    // A reflection that every candidate survived is the one exception. It moves
    // no candidate, but the generation it produced has to reach the transcript:
    // the next check reads the prior generation out of the newest emission, and
    // if this one stays silent, a later wording change is compared against a
    // pre-reflection generation and blamed on a reflection whose survivors were
    // already observed.
    if (ops.length === 0) {
      if (!reflectionRan(priorGeneration(args), generationCount)) return;
      ops.push({ op: 'reflection-survived' });
    }

    const { contents, emitted } = renderOps(ops, check.eventId ?? 'unknown');
    const applied = applyRemindContextOps(prior, emitted);
    return {
      id: REMIND_CONTEXT_STATE_ID,
      mode: 'delta',
      cacheKey: entriesCacheKey('filtered', applied),
      tagName: REMIND_CONTEXT_DELTA_TAG,
      contents,
      value: { regime: 'filtered', eventId: check.eventId, entries: applied, generationCount },
      delta: { ops: emitted },
      attributes: { changes: emitted.length },
      metadata: {
        value: { regime: 'filtered', eventId: check.eventId, entries: applied, generationCount },
        delta: { ops: emitted },
      },
    };
  }

  private async readParentRecord(args: ComputeStateSignalArgs): Promise<RemindContextRecord | undefined> {
    try {
      return await this.readRecord(args);
    } catch {
      // A failed read is not evidence of absence.
      return undefined;
    }
  }
}
