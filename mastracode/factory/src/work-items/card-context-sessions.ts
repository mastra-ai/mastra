interface SessionRef {
  readonly sessionId: string;
  readonly threadId: string;
}

interface ContextCard<Ref extends SessionRef> {
  readonly sessions: Readonly<Record<string, Ref>>;
  readonly stageHistory: readonly { readonly stage: string }[];
}

/**
 * The card's single conversation. A work item keeps one threadId for its whole
 * lifecycle — every run reuses the worktree's thread — so the card title links
 * to exactly one thread. Items filed while session scoping was broken may
 * still carry divergent role refs; prefer the earliest lifecycle role because
 * JSON object key order is not a stable record of which ref was filed first.
 */
export function itemThreadSession<Ref extends SessionRef>(sessions: Readonly<Record<string, Ref>>): Ref | undefined {
  return (
    sessions.triage ?? sessions.plan ?? sessions.work ?? sessions.review ?? sessions.chat ?? Object.values(sessions)[0]
  );
}

export interface ContextPhase {
  readonly id: string;
  readonly title: string;
  readonly name?: string;
  readonly context?: string;
  readonly role?: string;
}

export interface CardContextSession<Ref extends SessionRef = SessionRef> {
  context: string;
  label: string;
  ref: Ref;
  /** The card's current phase runs in this context. */
  current: boolean;
}

const CONTEXT_LABELS: Record<string, string> = {
  triage: 'Triage',
  work: 'Work',
  review: 'Review',
  plan: 'Planning',
  chat: 'Chat',
};

/** The session context a phase runs in; `role` is its deprecated name. */
export function phaseContext(phase: Pick<ContextPhase, 'context' | 'role'>): string | undefined {
  return phase.context ?? phase.role;
}

/** A context named after its one phase, else by its well-known name, else by its key. */
export function contextLabel(context: string, phases: readonly ContextPhase[] | undefined): string {
  const [only, ...others] = phases?.filter(phase => phaseContext(phase) === context) ?? [];
  if (only && others.length === 0) return only.name ?? only.title;
  return CONTEXT_LABELS[context] ?? context.charAt(0).toUpperCase() + context.slice(1);
}

/**
 * The session a card holds in a context. Cards planned before Planning moved
 * into `work` hold their planner under the old `plan` key, which stands in for
 * `work` until the card gets a `work` session, unless a phase runs in `plan`.
 */
function contextSession<Ref extends SessionRef>(
  item: Pick<ContextCard<Ref>, 'sessions'>,
  phases: readonly ContextPhase[],
  context: string,
): Ref | undefined {
  const legacyPlanner = context === 'work' && !phases.some(phase => phaseContext(phase) === 'plan');
  return item.sessions[context] ?? (legacyPlanner ? item.sessions.plan : undefined);
}

/** Contexts holding a session, by the card's current phase first, then its most recently visited phases. */
function visitedContexts<Ref extends SessionRef>(
  item: ContextCard<Ref>,
  phases: readonly ContextPhase[],
  columnStage: string,
): string[] {
  const contexts: string[] = [];
  for (const stage of [columnStage, ...item.stageHistory.map(entry => entry.stage).reverse()]) {
    const phase = phases.find(candidate => candidate.id === stage);
    const context = phase && phaseContext(phase);
    if (context !== undefined && contextSession(item, phases, context) && !contexts.includes(context)) {
      contexts.push(context);
    }
  }
  return contexts;
}

/**
 * Every session a card holds, one per context: the context its current phase
 * runs in first, then the contexts of its most recently visited phases, then
 * the rest. A session filed under two keys is listed once, under the first.
 */
export function cardContextSessions<Ref extends SessionRef>(
  item: ContextCard<Ref>,
  phases: readonly ContextPhase[] | undefined,
  columnStage: string,
): CardContextSession<Ref>[] {
  const currentPhase = phases?.find(phase => phase.id === columnStage);
  const currentContext = currentPhase && phaseContext(currentPhase);
  const visited = phases ? visitedContexts(item, phases, columnStage) : [];
  const order = [...new Set([...visited, ...Object.keys(item.sessions)])];
  const seen = new Set<string>();
  return order.flatMap(context => {
    const ref = (phases && contextSession(item, phases, context)) ?? item.sessions[context];
    if (!ref) return [];
    const key = `${ref.sessionId}:${ref.threadId}`;
    if (seen.has(key)) return [];
    seen.add(key);
    return [{ context, label: contextLabel(context, phases), ref, current: context === currentContext }];
  });
}

/**
 * The session a card opens: its current phase's context, else the context of
 * the phase it last visited. Without a board catalog, or when no visited phase
 * holds a session, it keeps the lifecycle order of `itemThreadSession`.
 */
export function cardThreadSession<Ref extends SessionRef>(
  item: ContextCard<Ref>,
  phases: readonly ContextPhase[] | undefined,
  columnStage: string,
): Ref | undefined {
  const context = phases ? visitedContexts(item, phases, columnStage)[0] : undefined;
  return phases && context !== undefined ? contextSession(item, phases, context) : itemThreadSession(item.sessions);
}
