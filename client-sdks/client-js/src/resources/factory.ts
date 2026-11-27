import { fromWireWorkItem, toWireCreateInput } from '@internal/factory-contract';
import type {
  BoardCatalogResponse,
  IntakeRouteListResponse,
  ReplaceBoardBody,
  StoredBoardResponse,
  BoardPhasesRequest,
  BoardPhasesResponse,
  BoardSnapshot,
  CreateWorkItemInput,
  FactoryBoard,
  FactoryDecisionAction,
  FactoryDecisionPage,
  FactoryDecisionStatus,
  FactoryDecisionSummary,
  FactoryRuleStage,
  FactoryTransitionResult,
  RunQueueResponse,
  SessionActivityResponse,
  SubmittedTransition,
  UpdateWorkItemInput,
  WireAuditPage,
  WireWorkItem,
  WorkItem,
  WorkItemActivityResponse,
  WorkItemFilterOptionsResponse,
  WorkItemListResponse,
  WorkItemSessionRepositoryResponse,
  WorkItemStartersResponse,
} from '@internal/factory-contract';
import type { ClientOptions } from '../types';
import { MastraClientError } from '../types';

import { BaseResource } from './base';

export type {
  BoardCatalogResponse,
  InstalledBoardInfo,
  InstalledPhaseInfo,
  IntakeRouteInfo,
  IntakeRouteListResponse,
  ReplaceBoardBody,
  StoredBoardResponse,
  BoardPhasesFilter,
  BoardPhasesRequest,
  BoardPhasesResponse,
  BoardPhasesSort,
  BoardSnapshot,
  CreateWorkItemInput,
  FactoryBoard,
  FactoryDecisionAction,
  FactoryDecisionPage,
  FactoryDecisionStatus,
  FactoryDecisionSummary,
  FactoryRuleStage,
  RuleCondition,
  RuleGroup,
  RuleOperator,
  RuleValue,
  FactoryTransitionResult,
  RunQueueResponse,
  SessionActivityResponse,
  SubmittedTransition,
  TransitionOutcome,
  WireAuditPage,
  UpdateWorkItemInput,
  WorkItem,
  WorkItemActivityResponse,
  WorkItemBoardSource,
  WorkItemFilterOptionsResponse,
  WorkItemSessionRef,
  WorkItemSessionRepositoryResponse,
  WorkItemStageEntry,
  WorkItemStartersResponse,
} from '@internal/factory-contract';

/** The board read's answer. It holds the cards' bodies only when they were asked for. */
export interface BoardPhasesAnswer extends Omit<BoardPhasesResponse, 'workItems'> {
  workItems?: WorkItem[];
}

/** Which cards a list read asks for; there is no read of the whole project. */
export type WorkItemListQuery =
  | { sessionId: string }
  | { scope: 'sessions' }
  | { started: 'false'; q: string }
  | { source: string[] }
  | { workItemId: string[] };

export interface TransitionWorkItemInput {
  board: FactoryBoard;
  stage: FactoryRuleStage;
  expectedRevision: number;
  requestId: string;
  cause: string;
  /** Re-enter the lane the card is already in, so its rule runs again. */
  reenter?: boolean;
}

export interface FactoryOptions {
  /** Where the host serves Factory's routes. Defaults to Factory's own `/web/factory`. */
  basePath?: string;
}

interface Read {
  signal?: AbortSignal;
}

/** A request Factory refused, keeping its error code (such as `revision_mismatch`) and, when it lists them, each conflict. */
export class FactoryRequestError extends MastraClientError {
  readonly code: string | undefined;
  readonly conflicts: string[];

  constructor(status: number, statusText: string, message: string, body?: unknown) {
    super(status, statusText, message, body);
    this.name = 'FactoryRequestError';
    const refusal = body as { error?: unknown; conflicts?: unknown } | undefined;
    this.code = typeof refusal?.error === 'string' ? refusal.error : undefined;
    this.conflicts = Array.isArray(refusal?.conflicts)
      ? refusal.conflicts.filter((conflict): conflict is string => typeof conflict === 'string')
      : [];
  }

  /** The server's own reasons when it lists them, its message otherwise. */
  get reasons(): string {
    return this.conflicts.length > 0 ? this.conflicts.join(' ') : this.message;
  }
}

/**
 * One Factory project's board: its cards, phases, moves, decisions and run queue.
 * Every host (Factory itself, Platform) serves the same routes, under its own `basePath`.
 */
export class Factory extends BaseResource {
  private readonly project: string;

  constructor(
    options: ClientOptions,
    readonly factoryProjectId: string,
    { basePath = '/web/factory' }: FactoryOptions = {},
  ) {
    // React Query owns retries for Factory's board; one attempt per call keeps failures visible to it.
    super({ ...options, apiPrefix: basePath, retries: options.retries ?? 0 });
    this.project = `/projects/${encodeURIComponent(factoryProjectId)}`;
  }

  /** Factory answers failures with `{ message }` or `{ error }`; that text, not the raw body, is the error's message. */
  public override async request<T>(...args: Parameters<BaseResource['request']>): Promise<T> {
    try {
      return await super.request<T>(...args);
    } catch (error) {
      if (!(error instanceof MastraClientError)) throw error;
      const body = error.body as { message?: unknown; error?: unknown } | undefined;
      const said = typeof body?.message === 'string' ? body.message : body?.error;
      const message = typeof said === 'string' && said ? said : `Request failed (${error.status})`;
      throw new FactoryRequestError(error.status, error.statusText, message, error.body);
    }
  }

  async listWorkItems(only: WorkItemListQuery, { signal }: Read = {}): Promise<BoardSnapshot> {
    const pairs: Array<[string, string]> =
      'source' in only
        ? only.source.map(source => ['source', source])
        : 'workItemId' in only
          ? only.workItemId.map(id => ['workItemId', id])
          : Object.entries(only);
    const params = new URLSearchParams(pairs);
    // No id and no source asked for: no card. Sent bare, the request would read the whole project.
    if (params.size === 0) return { workItems: [] };
    const { workItems, total } = await this.request<
      Partial<Omit<WorkItemListResponse, 'workItems'>> & { workItems: WireWorkItem[] }
    >(`${this.project}/work-items?${params}`, { signal });
    return { workItems: workItems.map(fromWireWorkItem), ...(total === undefined ? {} : { total }) };
  }

  /**
   * Which cards each phase of a board view lists, in the view's order, and how many match.
   * `cards` also asks for the body of every card the answer names.
   */
  async boardPhases(
    request: BoardPhasesRequest,
    { cards, signal }: Read & { cards: boolean },
  ): Promise<BoardPhasesAnswer> {
    // One order of parameters per view: the browser revalidates an address it has already read.
    const params = new URLSearchParams({ sort: request.sort });
    if (request.q) params.set('q', request.q);
    for (const [filter, picked] of Object.entries(request.filters).sort(([left], [right]) =>
      left.localeCompare(right),
    )) {
      for (const value of picked) params.append(filter, value);
    }
    for (const [phase, count] of Object.entries(request.windows).sort(([left], [right]) => left.localeCompare(right))) {
      params.append('window', `${phase}:${count}`);
    }
    if (request.item) params.set('item', request.item);
    if (cards) params.set('cards', 'true');
    const { workItems, ...answer } = await this.request<
      Omit<BoardPhasesResponse, 'workItems'> & { workItems?: WireWorkItem[] }
    >(`${this.project}/boards/${encodeURIComponent(request.board)}/phases?${params}`, { signal });
    return workItems ? { ...answer, workItems: workItems.map(fromWireWorkItem) } : answer;
  }

  /** The labels and people the project's cards can be filtered by. */
  filterOptions({ signal }: Read = {}): Promise<WorkItemFilterOptionsResponse> {
    return this.request(`${this.project}/work-items/filter-options`, { signal });
  }

  /** What the draft page's starter buttons count on the project's default board. */
  starters({ signal }: Read = {}): Promise<WorkItemStartersResponse> {
    return this.request(`${this.project}/work-items/starters`, { signal });
  }

  sessionRepository(workItemId: string, { signal }: Read = {}): Promise<WorkItemSessionRepositoryResponse> {
    return this.request(`${this.project}/work-items/${encodeURIComponent(workItemId)}/session-repository`, { signal });
  }

  /** When the project's cards were created and completed since `since`, and how many cards it has in all. */
  activity(since: number, { signal }: Read = {}): Promise<WorkItemActivityResponse> {
    const query = new URLSearchParams({ since: new Date(since).toISOString() });
    return this.request(`${this.project}/work-items/activity?${query}`, { signal });
  }

  /** Create a work item; the server upserts on its external source identity so repeats reuse the card. */
  async createWorkItem(input: CreateWorkItemInput): Promise<WorkItem> {
    const { workItem } = await this.request<{ workItem: WireWorkItem }>(`${this.project}/work-items`, {
      method: 'POST',
      body: toWireCreateInput(input),
    });
    return fromWireWorkItem(workItem);
  }

  /**
   * Move a card. The server answers at once, or (202) takes the move on and answers it later on
   * the feed stream under the returned input id. A refused move is an answer, not an error.
   */
  async transitionWorkItem(
    workItemId: string,
    input: TransitionWorkItemInput,
  ): Promise<FactoryTransitionResult | SubmittedTransition> {
    let body: { result?: FactoryTransitionResult; inputId?: string };
    try {
      body = await this.request(`${this.project}/work-items/${encodeURIComponent(workItemId)}/transition`, {
        method: 'POST',
        body: input,
      });
    } catch (error) {
      const refused = error instanceof MastraClientError ? (error.body as { result?: FactoryTransitionResult }) : null;
      if (refused?.result) return refused.result;
      throw error;
    }
    if (body.result) return body.result;
    if (typeof body.inputId === 'string') return { status: 'submitted', inputId: body.inputId };
    throw new Error('Factory answered a move with neither a result nor an input id');
  }

  /** Patch a work item's non-stage metadata, session refs, title, or description. */
  async updateWorkItem(workItemId: string, patch: UpdateWorkItemInput): Promise<WorkItem> {
    const { workItem } = await this.request<{ workItem: WireWorkItem }>(
      `/work-items/${encodeURIComponent(workItemId)}`,
      { method: 'PATCH', body: patch },
    );
    return fromWireWorkItem(workItem);
  }

  /** Remove a work item from the board. */
  async deleteWorkItem(workItemId: string): Promise<void> {
    await this.request(`/work-items/${encodeURIComponent(workItemId)}`, { method: 'DELETE' });
  }

  decisions(
    options: { statuses?: FactoryDecisionStatus[]; before?: string; limit?: number } = {},
    { signal }: Read = {},
  ): Promise<FactoryDecisionPage> {
    const query = new URLSearchParams();
    if (options.statuses?.length) query.set('statuses', options.statuses.join(','));
    if (options.before) query.set('before', options.before);
    if (options.limit) query.set('limit', String(options.limit));
    return this.request(`${this.project}/decisions${query.size > 0 ? `?${query}` : ''}`, { signal });
  }

  actOnDecision(decisionId: string, action: FactoryDecisionAction): Promise<{ decision: FactoryDecisionSummary }> {
    return this.request(`${this.project}/decisions/${encodeURIComponent(decisionId)}/${action}`, { method: 'POST' });
  }

  /** The project's automated runs waiting for a run slot, oldest first, and the runs holding one. */
  runQueue({ signal }: Read = {}): Promise<RunQueueResponse> {
    return this.request(`${this.project}/run-queue`, { signal });
  }

  /** Audit events of the project, newest first; `before` takes the previous page's `nextCursor`. */
  auditEvents(
    options: { actorIds?: string[]; before?: string; limit?: number } = {},
    { signal }: Read = {},
  ): Promise<WireAuditPage> {
    const query = new URLSearchParams();
    if (options.actorIds?.length) query.set('actorIds', options.actorIds.join(','));
    if (options.before) query.set('before', options.before);
    if (options.limit) query.set('limit', String(options.limit));
    return this.request(`${this.project}/audit${query.size > 0 ? `?${query}` : ''}`, { signal });
  }

  /** Which sessions are running or parked, and which cards they hold. */
  sessionActivity({ signal }: Read = {}): Promise<SessionActivityResponse> {
    return this.request(`${this.project}/session-activity`, { signal });
  }

  /** The boards the project has installed, with each board's phases. */
  boardCatalog({ signal }: Read = {}): Promise<BoardCatalogResponse> {
    return this.request(`${this.project}/boards`, { signal });
  }

  /** One board's stored definition, with the revision to send back when saving it. */
  board(boardKey: string, { signal }: Read = {}): Promise<StoredBoardResponse> {
    return this.request(`${this.project}/boards/${encodeURIComponent(boardKey)}`, { signal });
  }

  /** Replaces a board's definition; refuses with `revision_mismatch` when someone saved it first. */
  replaceBoard(boardKey: string, body: ReplaceBoardBody): Promise<StoredBoardResponse> {
    return this.request(`${this.project}/boards/${encodeURIComponent(boardKey)}`, { method: 'PATCH', body });
  }

  /** The project's intake routes in the order they are tried, and whether the caller may change them. */
  intakeRoutes({ signal }: Read = {}): Promise<IntakeRouteListResponse> {
    return this.request(`${this.project}/intake-routes`, { signal });
  }
}
