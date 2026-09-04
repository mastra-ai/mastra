import { FACTORY_ROLE_STAGES } from '@mastra/factory/rules/types';
import { toast } from '@mastra/playground-ui/components/Toaster';
import { useRef, useState } from 'react';
import { useNavigate } from 'react-router';

import { useStartFactoryRun } from '../../../../hooks/useStartFactoryRun';
import type { FactoryRunPhase } from '../../../../hooks/useStartFactoryRun';
import type { useWorkItemsQuery } from '../../../../hooks/useWorkItems';
import type { BoardCandidate } from '../boardCandidates';
import { itemThreadSession } from '../boardItems';
import { itemRunSpec, itemSessionSpec } from '../boardRunSpecs';
import type { RunAction } from '../boardRunSpecs';
import { inferredParentWorkItemId } from '../services/relationships';
import type { WorkItem, WorkItemSessionRef } from '../services/workItems';

const EMPTY_PENDING_ROLES: ReadonlyMap<string, FactoryRunPhase | undefined> = new Map();

type PendingRoles = ReadonlyMap<string, FactoryRunPhase | undefined>;

/** Starting agent runs from cards and candidates, and reopening the threads they left behind. */
export function useBoardRuns({
  factoryProjectId,
  workItems,
  refetchItems,
}: {
  factoryProjectId: string;
  workItems: readonly WorkItem[];
  refetchItems: ReturnType<typeof useWorkItemsQuery>['refetch'];
}) {
  const { start, pendingRuns, enabled } = useStartFactoryRun();
  const navigate = useNavigate();

  // A card click refetches items before it can decide whether to open an
  // existing thread or mint a new session. That wait is a round trip long and
  // the run mutation isn't pending yet, so without this the card sits
  // completely silent after the click.
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

  // Refetch failures here used to be silent: an expired auth cookie made every
  // board click a no-op with no feedback. Toast so the click never dies quietly.
  const refreshItem = async (itemId: string) => {
    const refreshedItems = await refetchItems();
    if (!refreshedItems.isSuccess) {
      const cause = refreshedItems.error;
      toast.error(cause instanceof Error ? cause.message : 'Failed to refresh the board — try reloading the page');
      return;
    }
    const item = refreshedItems.data.find(candidate => candidate.id === itemId);
    if (!item) {
      toast.error('This card no longer exists — the board may be out of date');
      return;
    }
    return item;
  };

  const openOrCreateSession = async (item: WorkItem, destinationStage: string) => {
    if (!beginPreparingItem(item.id, 'Preparing session…')) return;
    try {
      const refreshed = await refreshItem(item.id);
      if (!refreshed) return;
      const existingSession = itemThreadSession(refreshed.sessions);
      if (existingSession) {
        await openThread(existingSession);
        return;
      }
      const spec = itemSessionSpec(refreshed);
      await start.mutateAsync({
        branch: spec.branch,
        threadTitle: spec.threadTitle,
        workItem: {
          id: refreshed.id,
          role: 'chat',
          stages: [destinationStage],
          source: refreshed.source,
          sourceKey: refreshed.sourceKey,
          title: refreshed.title,
        },
      });
    } finally {
      clearPreparingItem(item.id);
    }
  };

  const openOrStartRun = async (item: WorkItem, role: RunAction['role'], options?: { preapprovePlans?: boolean }) => {
    if (!beginPreparingItem(item.id, 'Preparing run…')) return;
    try {
      await startRunForItem(item, role, { openExisting: true, preapprovePlans: options?.preapprovePlans });
    } finally {
      clearPreparingItem(item.id);
    }
  };

  // Re-run a role's agent even though the card already has a live session for
  // it — e.g. re-reviewing a Done-lane PR that got new commits. All of an
  // item's runs share one branch/worktree, so the kickoff lands in the
  // existing thread as a follow-up instead of minting a parallel session.
  const restartRun = async (item: WorkItem, role: RunAction['role'], options?: { preapprovePlans?: boolean }) => {
    if (!beginPreparingItem(item.id, 'Preparing run…')) return;
    try {
      await startRunForItem(item, role, { openExisting: false, preapprovePlans: options?.preapprovePlans });
    } finally {
      clearPreparingItem(item.id);
    }
  };

  const startRunForItem = async (
    item: WorkItem,
    role: RunAction['role'],
    { openExisting, preapprovePlans }: { openExisting: boolean; preapprovePlans?: boolean },
  ) => {
    const refreshed = await refreshItem(item.id);
    if (!refreshed) return;
    const existingSession = refreshed.sessions[role];
    if (openExisting && existingSession) {
      await openThread(existingSession);
      return;
    }
    const spec = itemRunSpec(refreshed);
    const action = spec?.actions.find(candidate => candidate.role === role);
    if (!spec || !action) {
      toast.error(`This card can't start a ${role} run from its current state`);
      return;
    }
    await start.mutateAsync({
      branch: spec.branch,
      threadTitle: spec.threadTitle,
      threadTags: action.threadTags,
      invocation: action.invocation,
      preapprovePlans,
      workItem: {
        id: refreshed.id,
        role: action.role,
        existingRoles: Object.keys(refreshed.sessions),
        stages: [FACTORY_ROLE_STAGES[action.role]],
        source: refreshed.source,
        sourceKey: refreshed.sourceKey,
        title: refreshed.title,
      },
    });
  };

  const startCandidateRun = async (candidate: BoardCandidate, action: RunAction, prompt?: string) => {
    if (!beginPreparingItem(candidate.sourceKey, 'Starting run…')) return;
    try {
      await start.mutateAsync({
        branch: candidate.branch,
        threadTitle: candidate.threadTitle,
        threadTags: action.threadTags,
        invocation:
          prompt === undefined ? action.invocation : { type: 'prompt', prompt: candidate.customPrompt(prompt) },
        workItem: {
          role: action.role,
          stages: [FACTORY_ROLE_STAGES[action.role]],
          source: candidate.source,
          sourceKey: candidate.sourceKey,
          parentWorkItemId:
            candidate.source === 'github-pr' ? inferredParentWorkItemId(candidate.metadata, workItems) : undefined,
          title: candidate.title,
          url: candidate.url,
          metadata: candidate.metadata,
        },
      });
    } finally {
      clearPreparingItem(candidate.sourceKey);
    }
  };

  const pendingByItem = new Map<string, Map<string, FactoryRunPhase | undefined>>();
  const pendingBySource = new Map<string, Map<string, FactoryRunPhase | undefined>>();
  for (const run of pendingRuns) {
    if (run.id !== undefined) addPendingRun(pendingByItem, run.id, run.role, run.phase);
    if (run.sourceKey !== null) addPendingRun(pendingBySource, run.sourceKey, run.role, run.phase);
  }

  return {
    enabled,
    disabled: !enabled,
    error: start.error,
    pendingRolesFor: (itemId: string): PendingRoles => pendingByItem.get(itemId) ?? EMPTY_PENDING_ROLES,
    preparingFor: (itemId: string): string | undefined => preparingItems[itemId],
    pendingRolesForSource: (sourceKey: string): PendingRoles => pendingBySource.get(sourceKey) ?? EMPTY_PENDING_ROLES,
    preparingForSource: (sourceKey: string): string | undefined => preparingItems[sourceKey],
    openOrCreateSession,
    openOrStartRun,
    restartRun,
    startCandidateRun,
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
