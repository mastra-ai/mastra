import { useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router';

import { useStartIssueTriageMutation } from '../../../../hooks/useFactoryData';
import { useStartFactoryRun } from '../../../../hooks/useStartFactoryRun';
import type { FactoryRunPhase } from '../../../../hooks/useStartFactoryRun';
import type { useWorkItemsQuery } from '../../../../hooks/useWorkItems';
import { useWorkspacesQuery } from '../../../../hooks/useWorkspaces';
import type { BoardCandidate } from '../boardCandidates';
import { itemThreadSession, liveSessions } from '../boardItems';
import { itemRunSpec, itemSessionSpec } from '../boardRunSpecs';
import type { RunAction } from '../boardRunSpecs';
import type { GithubIssue } from '../services/factory';
import { inferredParentWorkItemId } from '../services/relationships';
import type { WorkItem, WorkItemSessionRef } from '../services/workItems';

const EMPTY_PENDING_ROLES: ReadonlyMap<string, FactoryRunPhase | undefined> = new Map();

type PendingRoles = ReadonlyMap<string, FactoryRunPhase | undefined>;

/** Starting agent runs from cards and candidates, and reopening the threads they left behind. */
export function useBoardRuns({
  factoryProjectId,
  projectRepositoryId,
  workItems,
  refetchItems,
}: {
  factoryProjectId: string;
  projectRepositoryId: string;
  workItems: readonly WorkItem[];
  refetchItems: ReturnType<typeof useWorkItemsQuery>['refetch'];
}) {
  const { start, pendingRuns, enabled } = useStartFactoryRun();
  const { triage, pendingIssueNumbers } = useStartIssueTriageMutation(projectRepositoryId, factoryProjectId);
  const navigate = useNavigate();

  // Workspaces that still exist. A card's session ref whose workspace was
  // deleted is stale: its thread is gone (workspace deletion cascades onto its
  // threads), so it neither renders a Thread link nor blocks re-running.
  const workspaces = useWorkspacesQuery(projectRepositoryId);
  const liveWorktreePaths = useMemo(
    () => new Set((workspaces.data?.workspaces ?? []).map(workspace => workspace.sessionId)),
    [workspaces.data],
  );

  // A card click refetches worktrees and items before it can decide whether to
  // open an existing thread or mint a new session. That wait is several round
  // trips long and the run mutation isn't pending yet, so without this the card
  // sits completely silent after the click.
  const [preparingItems, setPreparingItems] = useState<Record<string, string>>({});
  // Guarded by a ref, not by preparingItems: two clicks landing in the same
  // render both read the pre-click state, so the state value can't reject the
  // second one. Preparing is several round trips long and each pass mints its
  // own kickoffKey, so the server's start lock keys differently per click and
  // won't collapse them either.
  const preparingRef = useRef<Set<string>>(new Set());
  const beginPreparingItem = (itemId: string, label: string) => {
    if (preparingRef.current.has(itemId)) return false;
    preparingRef.current.add(itemId);
    setPreparingItems(current => ({ ...current, [itemId]: label }));
    return true;
  };
  const clearPreparingItem = (itemId: string) => {
    preparingRef.current.delete(itemId);
    setPreparingItems(current => {
      if (!(itemId in current)) return current;
      const { [itemId]: _cleared, ...rest } = current;
      return rest;
    });
  };

  const openThread = async (session: WorkItemSessionRef) => {
    navigate(`/factories/${factoryProjectId}/workspaces/${session.sessionId}/threads/${session.threadId}`);
  };

  const refreshItemAndWorktrees = async (itemId: string) => {
    const [refreshedWorkspaces, refreshedItems] = await Promise.all([workspaces.refetch(), refetchItems()]);
    if (!refreshedWorkspaces.isSuccess || !refreshedItems.isSuccess) return;
    const item = refreshedItems.data.find(candidate => candidate.id === itemId);
    if (!item) return;
    return {
      item,
      paths: new Set(refreshedWorkspaces.data.workspaces.map(workspace => workspace.sessionId)),
    };
  };

  const openOrCreateSession = async (item: WorkItem, destinationStage: string) => {
    if (!beginPreparingItem(item.id, 'Preparing session…')) return;
    try {
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
    } finally {
      clearPreparingItem(item.id);
    }
  };

  const openOrStartRun = async (item: WorkItem, role: RunAction['role']) => {
    if (!beginPreparingItem(item.id, 'Preparing run…')) return;
    try {
      await startRunForItem(item, role);
    } finally {
      clearPreparingItem(item.id);
    }
  };

  const startRunForItem = async (item: WorkItem, role: RunAction['role']) => {
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
          candidate.source === 'github-pr' ? inferredParentWorkItemId(candidate.metadata, workItems) : undefined,
        title: candidate.title,
        url: candidate.url,
        metadata: candidate.metadata,
      },
    });
  };

  const pendingByItem = new Map<string, Map<string, FactoryRunPhase | undefined>>();
  const pendingBySource = new Map<string, Map<string, FactoryRunPhase | undefined>>();
  for (const run of pendingRuns) {
    if (run.id !== undefined) addPendingRun(pendingByItem, run.id, run.role, run.phase);
    if (run.sourceKey !== null) addPendingRun(pendingBySource, run.sourceKey, run.role, run.phase);
  }

  return {
    enabled,
    // Until the worktree listing settles, liveness is unknown and every session
    // ref looks stale — a card title would render as a create button and a click
    // would mint a replacement session for a perfectly live thread.
    disabled: !enabled || !workspaces.isSuccess,
    liveWorktreePaths,
    error: [start, triage].find(mutation => mutation.isError)?.error,
    triagingIssueNumbers: new Set(pendingIssueNumbers),
    pendingRolesFor: (itemId: string): PendingRoles => pendingByItem.get(itemId) ?? EMPTY_PENDING_ROLES,
    preparingFor: (itemId: string): string | undefined => preparingItems[itemId],
    pendingRolesForSource: (sourceKey: string): PendingRoles => pendingBySource.get(sourceKey) ?? EMPTY_PENDING_ROLES,
    openOrCreateSession,
    openOrStartRun,
    startCandidateRun,
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
