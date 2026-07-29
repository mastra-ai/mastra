import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router';

import {
  useProjectIssuesQuery,
  useProjectPullRequestsQuery,
  useStartIssueTriageMutation,
} from '../../../../hooks/useFactoryData';
import { useFactoryDecisionStatus, useRetryFactoryDecision } from '../../../../hooks/useFactoryDecisions';
import { useIntakeConfigQuery } from '../../../../hooks/useIntakeConfig';
import { useLinearIssuesQuery, useLinearStatusQuery } from '../../../../hooks/useLinearData';
import { useStartFactoryRun } from '../../../../hooks/useStartFactoryRun';
import type { FactoryRunPhase } from '../../../../hooks/useStartFactoryRun';
import {
  useDeleteWorkItemMutation,
  useTransitionWorkItemMutation,
  useUpdateWorkItemMutation,
  useUpsertWorkItemMutation,
  useWorkItemsQuery,
} from '../../../../hooks/useWorkItems';
import { useWorkspacesQuery } from '../../../../hooks/useWorkspaces';
import type { FactoryProject, LinkedRepositoryPayload } from '../../workspaces/services/github';
import { issueCandidate, linearCandidate, pullRequestCandidate } from '../boardCandidates';
import type { BoardCandidate, IntakeSource } from '../boardCandidates';
import type { DragPayload } from '../boardDrag';
import {
  AUTO_TRIAGED_LABEL,
  candidateSourceKeyForItem,
  hasLabel,
  itemThreadSession,
  liveSessions,
} from '../boardItems';
import { itemRunSpec, itemSessionSpec } from '../boardRunSpecs';
import type { RunAction } from '../boardRunSpecs';
import { belongsToBoard, boardStages } from '../boardStages';
import type { BoardKind } from '../boardStages';
import type { FactoryDecisionStatus, FactoryDecisionSummary } from '../services/decisions';
import type { GithubIssue } from '../services/factory';
import { inferredParentWorkItemId } from '../services/relationships';
import type { WorkItem, WorkItemSessionRef } from '../services/workItems';
import type { BoardStageId } from '../stages';

const ACTIVE_DECISION_STATUSES: FactoryDecisionStatus[] = ['pending', 'leased', 'retry', 'failed'];

const EMPTY_PENDING_RUN_ROLES = new Map<string, FactoryRunPhase | undefined>();

type PendingRunRoles = ReadonlyMap<string, FactoryRunPhase | undefined>;

/**
 * Everything the board page needs that isn't markup: the queries feeding each
 * column, the mutations behind card actions, and the refs the lanes use for
 * focus restoration and first-paint scrolling.
 */
export function useBoardState({
  factory,
  repository,
  kind,
}: {
  factory: FactoryProject;
  repository: LinkedRepositoryPayload;
  kind: BoardKind;
}) {
  const projectRepositoryId = repository.projectRepositoryId;
  const factoryProjectId = factory.id;
  const review = kind === 'review';
  const stages = boardStages(kind);

  const items = useWorkItemsQuery(factoryProjectId);
  const decisionStatus = useFactoryDecisionStatus(factoryProjectId, ACTIVE_DECISION_STATUSES);
  const retryDecision = useRetryFactoryDecision(factoryProjectId);
  const decisionByItem = useMemo(() => {
    const byItem = new Map<string, FactoryDecisionSummary>();
    for (const decision of decisionStatus.data?.decisions ?? []) {
      if (decision.workItemId && !byItem.has(decision.workItemId)) byItem.set(decision.workItemId, decision);
    }
    return byItem;
  }, [decisionStatus.data]);

  const configQuery = useIntakeConfigQuery();
  const linearStatusQuery = useLinearStatusQuery();

  // Intake sources mirror the old Intake page gating: issues sync only once
  // picked in Settings › General. Open PRs always feed the board; they start
  // in Intake and only move once the Factory acts on them.
  const config = configQuery.data;
  const githubEnabled = config?.github.enabled ?? true;
  const githubSelected = config ? (config.github.sourceIds?.includes(repository.slug) ?? false) : true;
  const linearFeature = linearStatusQuery.data?.enabled ?? false;
  const linearConnected = Boolean(linearFeature && linearStatusQuery.data?.connected);
  const linearReady =
    (config?.linear.enabled ?? false) && linearConnected && (config?.linear.sourceIds?.length ?? 0) > 0;

  // Work intake owns issues; Review intake owns pull requests. Keeping the
  // feeds on separate routes prevents review-producing PR work from being
  // confused with the Work board's review-receiving lane.
  const githubIntakeActive = githubEnabled && githubSelected;
  const availableIntakeSources: IntakeSource[] = review
    ? ['github-prs']
    : [...(githubIntakeActive ? (['github'] as const) : []), ...(linearReady ? (['linear'] as const) : [])];
  const [intakeSource, setIntakeSource] = useState<IntakeSource>(review ? 'github-prs' : 'github');
  const activeIntakeSource: IntakeSource | null = availableIntakeSources.includes(intakeSource)
    ? intakeSource
    : (availableIntakeSources[0] ?? null);

  // Only the active intake feed fetches; the other feeds load on switch.
  const issues = useProjectIssuesQuery(activeIntakeSource === 'github' ? projectRepositoryId : undefined);
  const triageIssues = useProjectIssuesQuery(!review ? projectRepositoryId : undefined, AUTO_TRIAGED_LABEL);
  const pulls = useProjectPullRequestsQuery(activeIntakeSource === 'github-prs' ? projectRepositoryId : undefined);
  const linearIssues = useLinearIssuesQuery(activeIntakeSource === 'linear' ? factoryProjectId : undefined);

  const upsert = useUpsertWorkItemMutation(factoryProjectId);
  const manualCreate = useUpsertWorkItemMutation(factoryProjectId);
  const manualUpdate = useUpdateWorkItemMutation(factoryProjectId);
  const manualTransition = useTransitionWorkItemMutation(factoryProjectId);
  const transition = useTransitionWorkItemMutation(factoryProjectId);
  const remove = useDeleteWorkItemMutation(factoryProjectId);
  const [transitionReasons, setTransitionReasons] = useState<Record<string, string>>({});
  const { start, pendingRuns, enabled: runEnabled } = useStartFactoryRun();
  const { triage, pendingIssueNumbers } = useStartIssueTriageMutation(projectRepositoryId, factoryProjectId);
  const navigate = useNavigate();

  const composer = useBoardComposer();

  // Workspaces that still exist. A card's session ref whose workspace was
  // deleted is stale: its thread is gone (workspace deletion cascades onto its
  // threads), so it neither renders a Thread link nor blocks re-running.
  const workspaces = useWorkspacesQuery(projectRepositoryId);
  const liveWorktreePaths = useMemo(
    () => new Set((workspaces.data?.workspaces ?? []).map(workspace => workspace.sessionId)),
    [workspaces.data],
  );

  const openThread = async (session: WorkItemSessionRef) => {
    navigate(`/factories/${factoryProjectId}/workspaces/${session.sessionId}/threads/${session.threadId}`);
  };

  const refreshItemAndWorktrees = async (itemId: string) => {
    const [refreshedWorkspaces, refreshedItems] = await Promise.all([workspaces.refetch(), items.refetch()]);
    if (!refreshedWorkspaces.isSuccess || !refreshedItems.isSuccess) return;
    const item = refreshedItems.data.find(candidate => candidate.id === itemId);
    if (!item) return;
    return {
      item,
      paths: new Set(refreshedWorkspaces.data.workspaces.map(workspace => workspace.sessionId)),
    };
  };

  const openOrCreateSession = async (item: WorkItem, destinationStage: string) => {
    const refreshed = await refreshItemAndWorktrees(item.id);
    if (!refreshed) return;
    const existingSession = itemThreadSession(liveSessions(refreshed.item.sessions, refreshed.paths));
    if (existingSession) {
      await openThread(existingSession);
      return;
    }
    const spec = itemSessionSpec(refreshed.item);
    start.mutate({
      branch: spec.branch,
      threadTitle: spec.threadTitle,
      workItem: {
        id: refreshed.item.id,
        role: 'chat',
        stages: [destinationStage],
        source: refreshed.item.source,
        sourceKey: refreshed.item.sourceKey,
        title: refreshed.item.title,
      },
    });
  };

  const openOrStartRun = async (item: WorkItem, role: RunAction['role']) => {
    const refreshed = await refreshItemAndWorktrees(item.id);
    if (!refreshed) return;
    const existingSession = refreshed.item.sessions[role];
    if (existingSession && refreshed.paths.has(existingSession.sessionId)) {
      await openThread(existingSession);
      return;
    }
    const spec = itemRunSpec(refreshed.item);
    const action = spec?.actions.find(candidate => candidate.role === role);
    if (!spec || !action) return;
    start.mutate({
      branch: spec.branch,
      threadTitle: spec.threadTitle,
      threadTags: action.threadTags,
      invocation: action.invocation,
      workItem: {
        id: refreshed.item.id,
        role: action.role,
        existingRoles: Object.keys(refreshed.item.sessions),
        stages: [action.stage],
        source: refreshed.item.source,
        sourceKey: refreshed.item.sourceKey,
        title: refreshed.item.title,
      },
    });
  };

  const allWorkItems = useMemo(() => items.data ?? [], [items.data]);
  const workItems = allWorkItems.filter(item => belongsToBoard(item, kind));

  // Live candidates minus anything already persisted in either workflow.
  const candidates = useMemo(() => {
    const known = new Set<string>();
    for (const item of allWorkItems) {
      if (item.sourceKey) known.add(item.sourceKey);
      const candidateSourceKey = candidateSourceKeyForItem(item);
      if (candidateSourceKey) known.add(candidateSourceKey);
    }
    const intakeIssues = (activeIntakeSource === 'github' ? (issues.data ?? []) : []).filter(
      issue => !hasLabel(issue.labels, AUTO_TRIAGED_LABEL),
    );
    const all: BoardCandidate[] = review
      ? (pulls.data ?? []).map(pullRequestCandidate)
      : [
          ...intakeIssues.map(issueCandidate),
          ...(triageIssues.data ?? []).map(issueCandidate),
          ...(activeIntakeSource === 'linear' ? (linearIssues.data ?? []).map(linearCandidate) : []),
        ];
    return all.filter(candidate => !known.has(candidate.sourceKey));
  }, [allWorkItems, issues.data, triageIssues.data, pulls.data, linearIssues.data, activeIntakeSource, review]);

  const intakeDataPending =
    (!review && (configQuery.isPending || ((config?.linear.enabled ?? false) && linearStatusQuery.isPending))) ||
    (activeIntakeSource === 'github' && issues.isPending) ||
    (activeIntakeSource === 'github-prs' && pulls.isPending) ||
    (activeIntakeSource === 'linear' && linearIssues.isPending);
  const loadingStages = new Set<BoardStageId>();
  if (items.isPending) {
    for (const stage of stages) loadingStages.add(stage.id);
  }
  if (intakeDataPending) loadingStages.add('intake');
  if (!review && triageIssues.isPending) loadingStages.add('triage');

  const scroll = useBoardScroll({
    boardKey: `${factoryProjectId}:${kind}`,
    settled: loadingStages.size === 0,
    stages,
    workItems,
    candidates,
  });

  const requestTransition = (item: WorkItem, toStage: string) => {
    setTransitionReasons(current => {
      if (!(item.id in current)) return current;
      const next = { ...current };
      delete next[item.id];
      return next;
    });
    transition.mutate(
      { item, board: review ? 'review' : 'work', stage: toStage },
      {
        onSuccess: result => {
          if (result.status !== 'rejected') return;
          setTransitionReasons(current => ({ ...current, [item.id]: result.reason }));
        },
        onError: error => {
          setTransitionReasons(current => ({
            ...current,
            [item.id]: error instanceof Error ? error.message : 'The transition could not be evaluated.',
          }));
        },
      },
    );
  };

  const moveItem = (id: string, toStage: string) => {
    const item = workItems.find(candidate => candidate.id === id);
    if (!item || (item.stages.length === 1 && item.stages[0] === toStage)) return;
    requestTransition(item, toStage);
  };

  const handleDrop = (payload: DragPayload, toStage: BoardStageId) => {
    if (payload.kind === 'work-item') {
      if (payload.fromStage === toStage) return;
      moveItem(payload.id, toStage);
      return;
    }
    // Filing a candidate never starts a run — it only creates the card.
    const { source, sourceKey, title, url, metadata } = payload.candidate;
    const parentWorkItemId = source === 'github-pr' ? inferredParentWorkItemId(metadata, allWorkItems) : undefined;
    void (async () => {
      const item = await upsert.mutateAsync({
        source,
        sourceKey,
        parentWorkItemId,
        title,
        url,
        stages: ['intake'],
        metadata,
      });
      if (toStage !== 'intake') requestTransition(item, toStage);
    })();
  };

  const startCandidateRun = (candidate: BoardCandidate, action: RunAction, prompt?: string) => {
    start.mutate({
      branch: candidate.branch,
      threadTitle: candidate.threadTitle,
      threadTags: action.threadTags,
      invocation: prompt === undefined ? action.invocation : { type: 'prompt', prompt: candidate.customPrompt(prompt) },
      workItem: {
        role: action.role,
        stages: [action.stage],
        source: candidate.source,
        sourceKey: candidate.sourceKey,
        parentWorkItemId:
          candidate.source === 'github-pr' ? inferredParentWorkItemId(candidate.metadata, allWorkItems) : undefined,
        title: candidate.title,
        url: candidate.url,
        metadata: candidate.metadata,
      },
    });
  };

  /**
   * Composer submits are re-entrant: a rejected transition keeps the composer
   * open, so a retry must update the card it already created instead of
   * filing a duplicate.
   */
  const createManualItem = async (stage: BoardStageId, title: string) => {
    const pendingItem = composer.pendingItemRef.current?.stage === stage ? composer.pendingItemRef.current : undefined;
    let item: WorkItem;
    if (pendingItem === undefined) {
      item = await manualCreate.mutateAsync({ source: 'manual', sourceKey: null, title, stages: ['intake'] });
      composer.pendingItemRef.current = { stage, title, item };
    } else if (pendingItem.title !== title) {
      item = await manualUpdate.mutateAsync({ id: pendingItem.item.id, patch: { title } });
      composer.pendingItemRef.current = { stage, title, item };
    } else {
      item = pendingItem.item;
    }
    if (stage !== 'intake') {
      const result = await manualTransition.mutateAsync({ item, board: 'work', stage, cause: 'manual_creation' });
      if (result.status === 'rejected') throw new Error(result.reason);
    }
    composer.pendingItemRef.current = undefined;
  };

  const mutationError = [start, triage, upsert, transition, remove].find(mutation => mutation.isError)?.error;
  const pendingRunRolesByItem = new Map<string, Map<string, FactoryRunPhase | undefined>>();
  const pendingRunRolesBySource = new Map<string, Map<string, FactoryRunPhase | undefined>>();
  for (const run of pendingRuns) {
    if (run.id !== undefined) addPendingRun(pendingRunRolesByItem, run.id, run.role, run.phase);
    if (run.sourceKey !== null) addPendingRun(pendingRunRolesBySource, run.sourceKey, run.role, run.phase);
  }
  const triagingIssueNumbers = new Set(pendingIssueNumbers);

  return {
    review,
    stages,
    itemsError: items.isError ? items.error : undefined,
    mutationError,

    allWorkItems,
    workItems,
    candidates,
    totalTaskCount: workItems.length + candidates.length,
    loadingStages,
    liveWorktreePaths,

    intake: {
      available: availableIntakeSources,
      active: activeIntakeSource,
      showSwitch: availableIntakeSources.length > 1,
      select: setIntakeSource,
      issues,
      pulls,
      linearIssues,
    },
    composer: {
      stage: composer.stage,
      open: composer.open,
      close: composer.close,
      registerTrigger: composer.registerTrigger,
      create: createManualItem,
    },
    scroll,

    // Until the worktree listing settles, liveness is unknown and every session
    // ref looks stale — a card title would render as a create button and a click
    // would mint a replacement session for a perfectly live thread.
    runDisabled: !runEnabled || !workspaces.isSuccess,
    runEnabled,
    decisionByItem,
    retryDecision,
    evaluatingStages: new Map(transition.pendingTransitions.map(({ itemId, stage }) => [itemId, stage])),
    transitionReasons,
    triagingIssueNumbers,
    pendingRunRolesFor: (itemId: string): PendingRunRoles =>
      pendingRunRolesByItem.get(itemId) ?? EMPTY_PENDING_RUN_ROLES,
    pendingRunRolesForSource: (sourceKey: string): PendingRunRoles =>
      pendingRunRolesBySource.get(sourceKey) ?? EMPTY_PENDING_RUN_ROLES,

    moveItem,
    removeItem: (id: string) => remove.mutate(id),
    handleDrop,
    openOrCreateSession,
    openOrStartRun,
    startCandidateRun,
    fileCandidate: (candidate: BoardCandidate) => handleDrop({ kind: 'candidate', candidate }, candidate.column),
    triageCandidate: (issue: GithubIssue) => triage.mutate(issue),
  };
}

function addPendingRun(
  target: Map<string, Map<string, FactoryRunPhase | undefined>>,
  key: string,
  role: string,
  phase: FactoryRunPhase | undefined,
) {
  const roles = target.get(key);
  if (roles) roles.set(role, phase);
  else target.set(key, new Map([[role, phase]]));
}

/** Which lane's inline composer is open, plus the focus return to its "+" trigger. */
function useBoardComposer() {
  const [stage, setStage] = useState<BoardStageId>();
  const triggerRefs = useRef(new Map<BoardStageId, HTMLButtonElement>());
  const pendingItemRef = useRef<{ stage: BoardStageId; title: string; item: WorkItem } | undefined>(undefined);
  const closedStageRef = useRef<BoardStageId | undefined>(undefined);

  useEffect(() => {
    const closedStage = closedStageRef.current;
    if (stage !== undefined || closedStage === undefined) return;
    closedStageRef.current = undefined;
    triggerRefs.current.get(closedStage)?.focus();
  }, [stage]);

  return {
    stage,
    open: setStage,
    close: (closing: BoardStageId) => {
      if (pendingItemRef.current?.stage === closing) pendingItemRef.current = undefined;
      closedStageRef.current = closing;
      setStage(current => (current === closing ? undefined : current));
    },
    registerTrigger: (forStage: BoardStageId) => (element: HTMLButtonElement | null) => {
      if (element) triggerRefs.current.set(forStage, element);
      else triggerRefs.current.delete(forStage);
    },
    pendingItemRef,
  };
}

/**
 * Scrolls the board to its first populated lane once, on first paint. A
 * pointer or wheel gesture claims the scroll position for the user and the
 * board never repositions itself again for that board.
 */
function useBoardScroll({
  boardKey,
  settled,
  stages,
  workItems,
  candidates,
}: {
  boardKey: string;
  settled: boolean;
  stages: ReadonlyArray<{ id: BoardStageId }>;
  workItems: readonly WorkItem[];
  candidates: readonly BoardCandidate[];
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const laneRefs = useRef(new Map<BoardStageId, HTMLElement>());
  const autoPositionedRef = useRef<string | undefined>(undefined);
  const userPositionedRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (!settled || autoPositionedRef.current === boardKey || userPositionedRef.current === boardKey) return;

    const firstPopulatedStage = stages.find(
      stage =>
        workItems.some(item => item.stages.includes(stage.id)) ||
        candidates.some(candidate => candidate.column === stage.id),
    );
    const container = containerRef.current;
    const lane = firstPopulatedStage ? laneRefs.current.get(firstPopulatedStage.id) : undefined;
    if (!container || !lane) return;
    autoPositionedRef.current = boardKey;
    container.scrollTo?.({ left: Math.max(0, lane.offsetLeft - container.offsetLeft), behavior: 'auto' });
  }, [settled, boardKey, candidates, stages, workItems]);

  return {
    containerRef,
    registerLane: (stage: BoardStageId) => (element: HTMLElement | null) => {
      if (element) laneRefs.current.set(stage, element);
      else laneRefs.current.delete(stage);
    },
    claimForUser: () => {
      userPositionedRef.current = boardKey;
    },
  };
}
