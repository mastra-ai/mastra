import { fromWireWorkItem, toWireCreateInput } from '@internal/factory-contract';
import type {
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
  SubmittedTransition,
  UpdateWorkItemInput,
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
  FactoryTransitionResult,
  RunQueueResponse,
  SubmittedTransition,
  TransitionOutcome,
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
    super({ ...options, apiPrefix: basePath });
    this.project = `/projects/${encodeURIComponent(factoryProjectId)}`;
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
}
