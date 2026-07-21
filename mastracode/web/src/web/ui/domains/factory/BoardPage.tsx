import { Button, buttonVariants } from '@mastra/playground-ui/components/Button';
import { DropdownMenu } from '@mastra/playground-ui/components/DropdownMenu';
import { Notice } from '@mastra/playground-ui/components/Notice';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { CircleDot, EllipsisVertical, ExternalLink, GitPullRequest, Plus } from 'lucide-react';
import type { ComponentType, DragEvent } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router';

import { useApiConfig } from '../../../../shared/api/config';
import { useSelectWorkspaceMutation, useWorkspacesQuery } from '../../../../shared/hooks/useWorkspaces';
import { relativeTime } from '../../../../shared/lib/date';
import { SkeletonRows } from '../../ui';
import { AGENT_CONTROLLER_ID } from '../chat/services/constants';
import type { GithubFactory } from '../workspaces/services/factories';
import { FactoryItemActions } from './components/FactoryItemActions';
import { FactoryPageShell } from './components/FactoryPageShell';
import { LoadMoreSentinel } from './components/LoadMoreSentinel';
import {
  useProjectIssuesQuery,
  useProjectPullRequestsQuery,
  useStartIssueTriageMutation,
} from '../../../../shared/hooks/useFactoryData';
import { useIntakeConfigQuery } from '../../../../shared/hooks/useIntakeConfig';
import { useLinearIssuesQuery, useLinearStatusQuery } from '../../../../shared/hooks/useLinearData';
import { useStartFactoryRun } from '../../../../shared/hooks/useStartFactoryRun';
import type { FactoryRunInvocation } from '../../../../shared/hooks/useStartFactoryRun';
import {
  useDeleteWorkItemMutation,
  useUpdateWorkItemMutation,
  useUpsertWorkItemMutation,
} from '../../../../shared/hooks/useWorkItems';
import { useWorkItemsQuery } from '../../../../shared/hooks/useWorkItems';
import type { GithubIssue, GithubPullRequest } from './services/factory';
import type { LinearIssue } from './services/linear';
import { connectLinear, isLinearReauthError } from './services/linear';
import type { WorkItem, WorkItemSessionRef, WorkItemSource } from './services/workItems';
import { BOARD_STAGES, stageLabel } from './stages';
import type { BoardStageId } from './stages';

const AUTO_TRIAGED_LABEL = 'auto-triaged';
const NEEDS_APPROVAL_LABEL = 'needs-approval';

function hasLabel(labels: readonly string[], label: string): boolean {
  return labels.some(item => item.toLowerCase() === label);
}

function githubNewIssueUrl(repoFullName: string): string | undefined {
  const [owner, repo, extra] = repoFullName.split('/');
  if (extra || !owner || !repo || repo === '.' || repo === '..') return undefined;
  if (!/^[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?$/.test(owner) || !/^[A-Za-z0-9_.-]+$/.test(repo)) {
    return undefined;
  }
  return `https://github.com/${owner}/${repo}/issues/new`;
}

function metadataLabels(metadata: Record<string, unknown>): string[] {
  return Array.isArray(metadata.labels)
    ? metadata.labels.filter((label): label is string => typeof label === 'string')
    : [];
}

function issueTriageThreadTags(issueNumber: number): Record<string, string> {
  return { role: 'triage', source: 'github-issue', purpose: 'issue-triage', issueNumber: String(issueNumber) };
}

/**
 * Candidate feeds the Intake swimlane can browse. Only one paginated list is
 * shown at a time; a pill switcher inside the column picks the active feed
 * when more than one is available.
 */
const INTAKE_SOURCES = [
  { id: 'github', label: 'Issues' },
  { id: 'github-prs', label: 'PRs' },
  { id: 'linear', label: 'Linear' },
] as const;

type IntakeSource = (typeof INTAKE_SOURCES)[number]['id'];

/**
 * Stage list after moving a card out of `from` into `to`. Other concurrent
 * stages are kept — except `done`, which replaces everything (the item is
 * finished, all open stages exit).
 */
function stagesAfterMove(stages: string[], from: string | null, to: string): string[] {
  if (to === 'done') return ['done'];
  const rest = stages.filter(stage => stage !== from && stage !== to && stage !== 'done');
  return [...rest, to];
}

/** Pre-work stages a card exits when a run starts on it. */
const PRE_RUN_STAGES: string[] = ['intake', 'triage', 'planning'];

function stagesAfterRunStart(stages: string[], to: string): string[] {
  return stagesAfterMove(
    stages.filter(stage => !PRE_RUN_STAGES.includes(stage)),
    null,
    to,
  );
}

/**
 * Custom prompts keep the same base context as the default run (what the
 * issue/PR is and how to pick it up) — the typed text guides the run instead
 * of directing an explicit skill.
 */
function guidedPrompt(base: string, instructions: string): string {
  return `${base}\n\nGuidance for this run: ${instructions}`;
}

// ── Run actions ─────────────────────────────────────────────────────────────

/**
 * One agent run a card or candidate can start, and the lane it lands the card
 * in. Cards offer several: e.g. an issue can be investigated (understand it →
 * Planning) or built right away (implement it → Building). All of an item's
 * runs share one branch/worktree, so a later run continues the same
 * conversation as a follow-up.
 */
interface RunAction {
  label: 'Investigate' | 'Build' | 'Prepare approval' | 'Review';
  /** Session slot the run fills on the card, e.g. `plan` or `work`. */
  role: 'triage' | 'plan' | 'work' | 'review';
  /** Lane the card lands in once the run is underway. */
  stage: BoardStageId;
  invocation: FactoryRunInvocation;
  threadTags?: Record<string, string>;
}

// ── Candidates (live issues/PRs with no board record yet) ───────────────────

/** A live GitHub/Linear issue or PR that has not been materialized as a work item. */
interface BoardCandidate {
  sourceKey: string;
  source: WorkItemSource;
  title: string;
  url: string;
  /** Meta line under the title, e.g. `#12 · alice · opened 3 days ago`. */
  meta: string;
  icon: ComponentType<{ size?: number; className?: string }>;
  iconClassName: string;
  /** Column the candidate is offered in: everything starts in Intake (auto-triaged issues in Triage). */
  column: BoardStageId;
  /** Runs the candidate can start; the first is the one-click default. */
  runActions: RunAction[];
  branch: string;
  threadTitle: string;
  customPrompt: (instructions: string) => string;
  metadata: Record<string, unknown>;
  issue?: GithubIssue;
}

/** Investigate (understand → Planning) + Build (implement → Building) runs for an issue. */
function issueRunActions(ref: string, extra?: { context?: string }): RunAction[] {
  const context = extra?.context ? `\n\n${extra.context}` : '';
  return [
    {
      label: 'Investigate',
      role: 'plan',
      stage: 'planning',
      invocation: {
        type: 'skill',
        skillName: 'understand-issue',
        arguments: `${ref}${context}`,
      },
    },
    {
      label: 'Build',
      role: 'work',
      stage: 'execute',
      invocation: {
        type: 'prompt',
        prompt: `Implement a fix for ${ref}: investigate the root cause, make the change with tests, and open a pull request.${extra?.context ? ` ${extra.context}` : ''}`,
      },
    },
  ];
}

function issueCandidate(issue: GithubIssue): BoardCandidate {
  const labels = issue.labels;
  const autoTriaged = hasLabel(labels, AUTO_TRIAGED_LABEL);
  const needsApproval = hasLabel(labels, NEEDS_APPROVAL_LABEL);
  const ref = `GitHub issue #${issue.number} (${issue.url})`;
  const investigateBase = `Investigate ${ref}.`;
  const approvalBase = `Prepare approval for ${ref}.`;
  return {
    sourceKey: `github-issue:${issue.number}`,
    source: 'github-issue',
    title: issue.title,
    url: issue.url,
    meta: `#${issue.number}${issue.author ? ` · ${issue.author}` : ''} · opened ${relativeTime(issue.createdAt)}`,
    icon: CircleDot,
    iconClassName: 'text-accent1',
    column: autoTriaged ? 'triage' : 'intake',
    runActions: needsApproval
      ? [
          {
            label: 'Prepare approval',
            role: 'triage',
            stage: 'triage',
            invocation: {
              type: 'prompt',
              prompt: `Prepare approval for ${ref}. Review the existing triage comment and summarize the decision needed before implementation or closure.`,
            },
            threadTags: issueTriageThreadTags(issue.number),
          },
        ]
      : issueRunActions(ref),
    branch: `factory/issue-${issue.number}`,
    threadTitle: needsApproval ? `Triage #${issue.number}: ${issue.title}` : `Issue #${issue.number}: ${issue.title}`,
    customPrompt: instructions => guidedPrompt(needsApproval ? approvalBase : investigateBase, instructions),
    metadata: { number: issue.number, author: issue.author, labels },
    issue,
  };
}

function pullRequestCandidate(pr: GithubPullRequest): BoardCandidate {
  const ref = `GitHub pull request #${pr.number} (${pr.url})`;
  const checkout = `Check out the PR in this worktree first with \`gh pr checkout ${pr.number}\`. Expected head branch: ${pr.headBranch}.`;
  const base = `Review ${ref}. ${checkout}`;
  return {
    sourceKey: `github-pr:${pr.number}`,
    source: 'github-pr',
    title: pr.title,
    url: pr.url,
    meta: `#${pr.number}${pr.author ? ` · ${pr.author}` : ''} · ${pr.headBranch} → ${pr.baseBranch}`,
    icon: GitPullRequest,
    iconClassName: 'text-accent1',
    column: 'intake',
    runActions: [
      {
        label: 'Review',
        role: 'review',
        stage: 'review',
        invocation: {
          type: 'skill',
          skillName: 'understand-pr',
          arguments: `${ref}\n\n${checkout}`,
        },
      },
    ],
    branch: `factory/pr-${pr.number}`,
    threadTitle: `PR #${pr.number}: ${pr.title}`,
    customPrompt: instructions => guidedPrompt(base, instructions),
    metadata: { number: pr.number, author: pr.author, headBranch: pr.headBranch, baseBranch: pr.baseBranch },
  };
}

function linearCandidate(issue: LinearIssue): BoardCandidate {
  const ref = `Linear issue ${issue.identifier} (${issue.url})`;
  const fetchHint = `Start by fetching the issue's full details (description and comments) with the linear_get_issue tool.`;
  const base = `Investigate ${ref}. ${fetchHint}`;
  return {
    sourceKey: `linear:${issue.identifier}`,
    source: 'linear-issue',
    title: issue.title,
    url: issue.url,
    meta: `${issue.identifier} · ${issue.state}${issue.assignee ? ` · ${issue.assignee}` : ''}`,
    icon: CircleDot,
    iconClassName: 'text-accent3',
    column: 'intake',
    runActions: issueRunActions(ref, { context: fetchHint }),
    branch: `factory/linear-${issue.identifier.toLowerCase()}`,
    threadTitle: `${issue.identifier}: ${issue.title}`,
    customPrompt: instructions => guidedPrompt(base, instructions),
    metadata: { identifier: issue.identifier, state: issue.state, assignee: issue.assignee },
  };
}

// ── Runs on persisted items ─────────────────────────────────────────────────

interface ItemRunSpec {
  branch: string;
  threadTitle: string;
  /** Runs the card can start; each lands the card in its own lane. */
  actions: RunAction[];
}

/**
 * The runs a persisted card can start, derived from its source + metadata.
 * Issues can be investigated (→ Planning) or built (→ Building); PRs get a
 * review run. Manual cards (or cards missing the needed metadata) can't
 * start runs.
 */
function itemRunSpec(item: WorkItem): ItemRunSpec | null {
  const meta = item.metadata;
  if (item.source === 'github-issue' && typeof meta.number === 'number') {
    const labels = metadataLabels(meta);
    const needsApproval = hasLabel(labels, NEEDS_APPROVAL_LABEL);
    const ref = `GitHub issue #${meta.number}${item.url ? ` (${item.url})` : ''}`;
    return {
      branch: `factory/issue-${meta.number}`,
      threadTitle: needsApproval ? `Triage #${meta.number}: ${item.title}` : `Issue #${meta.number}: ${item.title}`,
      actions: needsApproval
        ? [
            {
              label: 'Prepare approval',
              role: 'triage',
              stage: 'triage',
              invocation: {
                type: 'prompt',
                prompt: `Prepare approval for ${ref}. Review the existing triage comment and summarize the decision needed before implementation or closure.`,
              },
              threadTags: issueTriageThreadTags(meta.number),
            },
          ]
        : issueRunActions(ref),
    };
  }
  if (item.source === 'linear-issue' && typeof meta.identifier === 'string') {
    const ref = `Linear issue ${meta.identifier}${item.url ? ` (${item.url})` : ''}`;
    const fetchHint = `Start by fetching the issue's full details (description and comments) with the linear_get_issue tool.`;
    return {
      branch: `factory/linear-${meta.identifier.toLowerCase()}`,
      threadTitle: `${meta.identifier}: ${item.title}`,
      actions: issueRunActions(ref, { context: fetchHint }),
    };
  }
  if (item.source === 'github-pr' && typeof meta.number === 'number' && typeof meta.headBranch === 'string') {
    const ref = `GitHub pull request #${meta.number}${item.url ? ` (${item.url})` : ''}`;
    const checkout = `Check out the PR in this worktree first with \`gh pr checkout ${meta.number}\`. Expected head branch: ${meta.headBranch}.`;
    return {
      branch: `factory/pr-${meta.number}`,
      threadTitle: `PR #${meta.number}: ${item.title}`,
      actions: [
        {
          label: 'Review',
          role: 'review',
          stage: 'review',
          invocation: {
            type: 'skill',
            skillName: 'understand-pr',
            arguments: `${ref}\n\n${checkout}`,
          },
        },
      ],
    };
  }
  return null;
}

/**
 * Branch + thread title for a card's session. Prefers the run spec (shared
 * with agent runs so the title click and a later run converge on one
 * worktree); manual/metadata-poor cards fall back to an id-derived branch so
 * every card's title can open a session.
 */
function itemSessionSpec(item: WorkItem): { branch: string; threadTitle: string } {
  const spec = itemRunSpec(item);
  if (spec) return { branch: spec.branch, threadTitle: spec.threadTitle };
  return { branch: `factory/item-${item.id}`, threadTitle: item.title };
}

/** Aria label for the icon-only external link next to a card title. */
function externalLinkLabel(source: WorkItemSource): string {
  if (source === 'linear-issue') return 'Open in Linear';
  if (source === 'manual') return 'Open link';
  return 'Open in GitHub';
}

// ── Drag & drop (native HTML5; the card menus are the accessible fallback) ──

const CARD_MIME = 'application/x-factory-card';

type DragPayload =
  | { kind: 'work-item'; id: string; fromStage: string }
  | {
      kind: 'candidate';
      candidate: Pick<BoardCandidate, 'source' | 'sourceKey' | 'title' | 'url' | 'metadata'>;
    };

function setDragPayload(event: DragEvent, payload: DragPayload) {
  event.dataTransfer.setData(CARD_MIME, JSON.stringify(payload));
  event.dataTransfer.effectAllowed = 'move';
}

function readDragPayload(event: DragEvent): DragPayload | null {
  const raw = event.dataTransfer.getData(CARD_MIME);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as DragPayload;
  } catch {
    return null;
  }
}

// ── Page ────────────────────────────────────────────────────────────────────

/**
 * Factory › Board: an org-wide kanban over the repository's work items. The
 * Intake column merges persisted `intake` cards with live GitHub/Linear
 * candidates (issues and PRs that have no record yet — records are
 * materialized only when someone acts on them). Everything enters through
 * Intake and moves through the system from there. Cards move between columns
 * by drag-and-drop or the card menu; moves only file/move cards, never start
 * agent runs.
 */
export function BoardPage() {
  return (
    <FactoryPageShell title="Board" description="Issues and pull requests across intake, work, review, and done.">
      {factory => <Board factory={factory} />}
    </FactoryPageShell>
  );
}

function Board({ factory }: { factory: GithubFactory }) {
  const githubProjectId = factory.binding.githubProjectId;
  const items = useWorkItemsQuery(githubProjectId);
  const configQuery = useIntakeConfigQuery();
  const linearStatusQuery = useLinearStatusQuery();

  // Intake sources mirror the old Intake page gating: issues sync only once
  // picked in Settings › General. Open PRs always feed the board; they start
  // in Intake and only move once the Factory acts on them.
  const config = configQuery.data;
  const githubEnabled = config?.github.enabled ?? true;
  const githubSelected = config ? (config.github.repositoryIds?.includes(githubProjectId) ?? false) : true;
  const linearFeature = linearStatusQuery.data?.enabled ?? false;
  const linearConnected = Boolean(linearFeature && linearStatusQuery.data?.connected);
  const linearReady =
    (config?.linear.enabled ?? false) && linearConnected && (config?.linear.projectIds?.length ?? 0) > 0;

  // The Intake swimlane browses one candidate feed at a time; a pill switcher
  // inside the column filters between Issues, PRs, and Linear as available.
  const githubIntakeActive = githubEnabled && githubSelected;
  const availableIntakeSources: IntakeSource[] = [
    ...(githubIntakeActive ? (['github'] as const) : []),
    'github-prs' as const,
    ...(linearReady ? (['linear'] as const) : []),
  ];
  const newIssueUrl = config && githubIntakeActive ? githubNewIssueUrl(factory.name) : undefined;
  const [intakeSource, setIntakeSource] = useState<IntakeSource>('github');
  const showIntakeSourceSwitch = availableIntakeSources.length > 1;
  const activeIntakeSource: IntakeSource | null = availableIntakeSources.includes(intakeSource)
    ? intakeSource
    : (availableIntakeSources[0] ?? null);

  // Only the active intake feed fetches; the other feeds load on switch.
  const issues = useProjectIssuesQuery(activeIntakeSource === 'github' ? githubProjectId : undefined);
  const triageIssues = useProjectIssuesQuery(githubProjectId, AUTO_TRIAGED_LABEL);
  const pulls = useProjectPullRequestsQuery(activeIntakeSource === 'github-prs' ? githubProjectId : undefined);
  const linearIssues = useLinearIssuesQuery(activeIntakeSource === 'linear');

  const upsert = useUpsertWorkItemMutation(githubProjectId);
  const update = useUpdateWorkItemMutation(githubProjectId);
  const remove = useDeleteWorkItemMutation(githubProjectId);
  const { start, pendingRuns, enabled: runEnabled } = useStartFactoryRun();
  const { triage, pendingIssueNumbers } = useStartIssueTriageMutation(githubProjectId);
  const navigate = useNavigate();
  const boardContainerRef = useRef<HTMLDivElement>(null);
  const laneRefs = useRef(new Map<BoardStageId, HTMLElement>());
  const autoPositionedFactoryRef = useRef<string | undefined>(undefined);
  const userPositionedFactoryRef = useRef<string | undefined>(undefined);

  // Worktrees that still exist. A card's session ref whose worktree was
  // deleted is stale: its thread is gone (worktree deletion cascades onto its
  // threads), so it neither renders a Thread link nor blocks re-running.
  const workspaces = useWorkspacesQuery(factory);
  const liveWorktreePaths = useMemo(
    () => new Set((workspaces.data?.worktrees ?? []).map(worktree => worktree.worktreePath)),
    [workspaces.data],
  );

  // Threads are scoped per worktree, so opening a card's thread first makes
  // its worktree the active workspace — otherwise the thread page can't
  // resolve the thread in the active scope and bounces away.
  const selectWorkspace = useSelectWorkspaceMutation(factory, {
    agentControllerId: AGENT_CONTROLLER_ID,
    resourceId: factory.resourceId,
  });
  const openThread = async (session: WorkItemSessionRef) => {
    await selectWorkspace.mutateAsync(session.projectPath);
    navigate(`/threads/${session.threadId}`);
  };

  const workItems = useMemo(() => items.data ?? [], [items.data]);

  // Live candidates minus anything already on the board (any stage).
  const candidates = useMemo(() => {
    const known = new Set(workItems.map(item => item.sourceKey).filter(Boolean));
    const intakeIssues = (activeIntakeSource === 'github' ? (issues.data ?? []) : []).filter(
      issue => !hasLabel(issue.labels, AUTO_TRIAGED_LABEL),
    );
    const all: BoardCandidate[] = [
      ...intakeIssues.map(issueCandidate),
      ...(triageIssues.data ?? []).map(issueCandidate),
      ...(activeIntakeSource === 'github-prs' ? (pulls.data ?? []).map(pullRequestCandidate) : []),
      ...(activeIntakeSource === 'linear' ? (linearIssues.data ?? []).map(linearCandidate) : []),
    ];
    return all.filter(candidate => !known.has(candidate.sourceKey));
  }, [workItems, issues.data, triageIssues.data, pulls.data, linearIssues.data, activeIntakeSource]);

  const boardDataPending =
    items.isPending ||
    configQuery.isPending ||
    linearStatusQuery.isPending ||
    triageIssues.isPending ||
    (activeIntakeSource === 'github' && issues.isPending) ||
    (activeIntakeSource === 'github-prs' && pulls.isPending) ||
    (activeIntakeSource === 'linear' && linearIssues.isPending);

  useEffect(() => {
    if (boardDataPending || autoPositionedFactoryRef.current === factory.id) return;
    autoPositionedFactoryRef.current = factory.id;
    if (userPositionedFactoryRef.current === factory.id) return;

    const firstPopulatedStage = BOARD_STAGES.find(
      stage =>
        workItems.some(item => item.stages.includes(stage.id)) ||
        candidates.some(candidate => candidate.column === stage.id),
    );
    const container = boardContainerRef.current;
    const lane = firstPopulatedStage ? laneRefs.current.get(firstPopulatedStage.id) : undefined;
    if (!container || !lane) return;
    container.scrollTo?.({ left: Math.max(0, lane.offsetLeft - container.offsetLeft), behavior: 'auto' });
  }, [boardDataPending, candidates, factory.id, workItems]);

  const moveItem = (id: string, fromStage: string | null, toStage: string) => {
    const item = workItems.find(i => i.id === id);
    if (!item) return;
    const next = stagesAfterMove(item.stages, fromStage, toStage);
    if (next.length === item.stages.length && next.every(stage => item.stages.includes(stage))) return;
    update.mutate({ id, patch: { stages: next } });
  };

  const handleDrop = (payload: DragPayload, toStage: BoardStageId) => {
    if (payload.kind === 'work-item') {
      if (payload.fromStage === toStage) return;
      moveItem(payload.id, payload.fromStage, toStage);
      return;
    }
    // Filing a candidate never starts a run — it only creates the card.
    const { source, sourceKey, title, url, metadata } = payload.candidate;
    upsert.mutate({ source, sourceKey, title, url, stages: [toStage], metadata });
  };

  if (items.isPending) return <SkeletonRows label="Loading board" rows={4} rowClassName="h-24 w-full" />;
  if (items.isError) {
    return (
      <Notice variant="destructive">
        {items.error instanceof Error ? items.error.message : 'Failed to load the board'}
      </Notice>
    );
  }

  const mutationError = [start, triage, upsert, update, remove, selectWorkspace].find(m => m.isError)?.error;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      {mutationError !== undefined && (
        <Notice variant="destructive">
          {mutationError instanceof Error ? mutationError.message : 'Board action failed'}
        </Notice>
      )}
      <div
        ref={boardContainerRef}
        className="flex min-h-0 flex-1 gap-3 overflow-x-auto pb-2"
        aria-label="Board columns"
        onPointerDown={() => {
          userPositionedFactoryRef.current = factory.id;
        }}
        onWheel={() => {
          userPositionedFactoryRef.current = factory.id;
        }}
        onScroll={() => {
          // Ignore the scroll event emitted by our own initial scrollTo call.
          if (autoPositionedFactoryRef.current !== factory.id) userPositionedFactoryRef.current = factory.id;
        }}
      >
        {BOARD_STAGES.map(stage => (
          <BoardColumn
            key={stage.id}
            stage={stage.id}
            label={stage.label}
            laneRef={element => {
              if (element) laneRefs.current.set(stage.id, element);
              else laneRefs.current.delete(stage.id);
            }}
            onDrop={handleDrop}
            headerAction={
              stage.id === 'intake' && newIssueUrl ? (
                <a
                  href={newIssueUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Create GitHub issue"
                  title="Create GitHub issue"
                  className={buttonVariants({ variant: 'ghost', size: 'icon-sm' })}
                >
                  <Plus size={13} aria-hidden />
                </a>
              ) : undefined
            }
            headerExtras={
              stage.id === 'intake' && showIntakeSourceSwitch ? (
                <div role="group" aria-label="Intake source" className="flex items-center gap-1 pb-1">
                  {INTAKE_SOURCES.filter(source => availableIntakeSources.includes(source.id)).map(source => (
                    <button
                      key={source.id}
                      type="button"
                      aria-pressed={activeIntakeSource === source.id}
                      onClick={() => setIntakeSource(source.id)}
                      className={`rounded-full border px-2.5 py-0.5 text-ui-xs transition ${
                        activeIntakeSource === source.id
                          ? 'border-accent1 bg-surface4 text-icon6'
                          : 'border-border1 bg-transparent text-icon3 hover:text-icon5'
                      }`}
                    >
                      {source.label}
                    </button>
                  ))}
                </div>
              ) : undefined
            }
          >
            {workItems
              .filter(item => item.stages.includes(stage.id))
              .map(item => (
                <WorkItemCard
                  key={`${item.id}:${stage.id}`}
                  item={item}
                  columnStage={stage.id}
                  liveWorktreePaths={liveWorktreePaths}
                  // Until the worktree listing settles, liveness is unknown and
                  // every session ref looks stale — the title would render as a
                  // create button and a click would mint a replacement session
                  // for a perfectly live thread. Hold run/create actions until
                  // liveness is known.
                  runDisabled={!runEnabled || !workspaces.isSuccess}
                  pendingRunRoles={new Set(pendingRuns.filter(run => run.id === item.id).map(run => run.role))}
                  onOpenThread={session => void openThread(session)}
                  onCreateSession={spec =>
                    start.mutate({
                      branch: spec.branch,
                      threadTitle: spec.threadTitle,
                      workItem: {
                        id: item.id,
                        // File only the neutral chat role. The title is a
                        // create button only when every existing role ref is
                        // stale (worktree gone); repointing those roles here
                        // would make them look live again and hide the card's
                        // run actions even though no run happened.
                        role: 'chat',
                        stages: item.stages,
                        source: item.source,
                        sourceKey: item.sourceKey,
                        title: item.title,
                      },
                    })
                  }
                  onStartRun={(spec, action) =>
                    start.mutate({
                      branch: spec.branch,
                      threadTitle: spec.threadTitle,
                      threadTags: action.threadTags,
                      invocation: action.invocation,
                      workItem: {
                        id: item.id,
                        role: action.role,
                        existingRoles: Object.keys(item.sessions),
                        stages: stagesAfterRunStart(item.stages, action.stage),
                        source: item.source,
                        sourceKey: item.sourceKey,
                        title: item.title,
                      },
                    })
                  }
                  onMove={toStage => moveItem(item.id, stage.id, toStage)}
                  onRemove={() => remove.mutate(item.id)}
                />
              ))}
            {candidates
              .filter(candidate => candidate.column === stage.id)
              .map(candidate => (
                <CandidateCard
                  key={candidate.sourceKey}
                  candidate={candidate}
                  pendingRunRoles={
                    new Set(pendingRuns.filter(run => run.sourceKey === candidate.sourceKey).map(run => run.role))
                  }
                  triageStarting={candidate.issue !== undefined && pendingIssueNumbers.includes(candidate.issue.number)}
                  disabled={!runEnabled}
                  onRun={(action, prompt) =>
                    start.mutate({
                      branch: candidate.branch,
                      threadTitle: candidate.threadTitle,
                      threadTags: action.threadTags,
                      invocation:
                        prompt === undefined
                          ? action.invocation
                          : { type: 'prompt', prompt: candidate.customPrompt(prompt) },
                      workItem: {
                        role: action.role,
                        stages: [action.stage],
                        source: candidate.source,
                        sourceKey: candidate.sourceKey,
                        title: candidate.title,
                        url: candidate.url,
                        metadata: candidate.metadata,
                      },
                    })
                  }
                  onOpenSession={() =>
                    start.mutate({
                      branch: candidate.branch,
                      threadTitle: candidate.threadTitle,
                      workItem: {
                        role: 'chat',
                        stages: [candidate.column],
                        source: candidate.source,
                        sourceKey: candidate.sourceKey,
                        title: candidate.title,
                        url: candidate.url,
                        metadata: candidate.metadata,
                      },
                    })
                  }
                  onFile={() => handleDrop({ kind: 'candidate', candidate }, candidate.column)}
                  onTriage={candidate.issue ? () => triage.mutate(candidate.issue!) : undefined}
                />
              ))}
            {stage.id === 'intake' && (
              <IntakeColumnExtras
                source={activeIntakeSource}
                issues={issues}
                pulls={pulls}
                linearIssues={linearIssues}
              />
            )}
          </BoardColumn>
        ))}
      </div>
    </div>
  );
}

// ── Columns ─────────────────────────────────────────────────────────────────

function BoardColumn({
  stage,
  label,
  laneRef,
  onDrop,
  headerAction,
  headerExtras,
  children,
}: {
  stage: BoardStageId;
  label: string;
  laneRef: (element: HTMLElement | null) => void;
  onDrop: (payload: DragPayload, toStage: BoardStageId) => void;
  headerAction?: React.ReactNode;
  /** Pinned below the column title, outside the scrolling card list. */
  headerExtras?: React.ReactNode;
  children: React.ReactNode;
}) {
  const [dragOver, setDragOver] = useState(false);

  return (
    <section
      ref={laneRef}
      aria-label={label}
      data-testid={`board-column-${stage}`}
      className={`flex min-h-0 w-72 shrink-0 flex-col gap-2 rounded-lg border p-2 transition ${
        dragOver ? 'border-accent1 bg-surface3' : 'border-border1 bg-surface2'
      }`}
      onDragOver={event => {
        if (!event.dataTransfer.types.includes(CARD_MIME)) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={event => {
        event.preventDefault();
        setDragOver(false);
        const payload = readDragPayload(event);
        if (payload) onDrop(payload, stage);
      }}
    >
      <div className="flex items-center justify-between gap-2 px-1">
        <Txt as="h2" variant="ui-xs" className="m-0 uppercase tracking-wide text-icon3">
          {label}
        </Txt>
        {headerAction}
      </div>
      {headerExtras}
      {/* Cards scroll inside the swimlane; the page stays fixed. */}
      <div className="flex min-h-16 flex-1 flex-col gap-1.5 overflow-y-auto">{children}</div>
    </section>
  );
}

// ── Cards ───────────────────────────────────────────────────────────────────

const SOURCE_ICONS: Record<
  WorkItemSource,
  { icon: ComponentType<{ size?: number; className?: string }>; className: string }
> = {
  'github-issue': { icon: CircleDot, className: 'text-accent1' },
  'github-pr': { icon: GitPullRequest, className: 'text-accent1' },
  'linear-issue': { icon: CircleDot, className: 'text-accent3' },
  manual: { icon: CircleDot, className: 'text-icon3' },
};

/**
 * The card's single conversation. A work item keeps one threadId for its whole
 * lifecycle — every run reuses the worktree's thread — so the card title links
 * to exactly one thread. Items filed while session scoping was broken may
 * still carry divergent role refs; the last-filed ref wins (runs converge them
 * back onto one thread the next time they file).
 */
function itemThreadSession(sessions: Record<string, WorkItemSessionRef>): WorkItemSessionRef | null {
  const refs = Object.values(sessions);
  return refs.at(-1) ?? null;
}

function WorkItemCard({
  item,
  columnStage,
  liveWorktreePaths,
  runDisabled,
  pendingRunRoles,
  onOpenThread,
  onCreateSession,
  onStartRun,
  onMove,
  onRemove,
}: {
  item: WorkItem;
  columnStage: BoardStageId;
  /** Worktrees that still exist; session refs outside this set are stale. */
  liveWorktreePaths: ReadonlySet<string>;
  runDisabled: boolean;
  pendingRunRoles: ReadonlySet<string>;
  onOpenThread: (session: WorkItemSessionRef) => void;
  /** Title click when the card has no live session: open an empty session (no run). */
  onCreateSession: (spec: { branch: string; threadTitle: string }) => void;
  onStartRun: (spec: ItemRunSpec, action: RunAction) => void;
  onMove: (toStage: string) => void;
  onRemove: () => void;
}) {
  const { icon: Icon, className: iconClassName } = SOURCE_ICONS[item.source];
  const otherStages = item.stages.filter(stage => stage !== columnStage);
  const runSpec = itemRunSpec(item);
  // Session refs whose worktree was deleted are stale: their threads went with
  // the worktree, so they don't render links and don't block re-running.
  const liveSessions = Object.fromEntries(
    Object.entries(item.sessions).filter(([, session]) => liveWorktreePaths.has(session.projectPath)),
  );
  // Offer only runs whose session slot hasn't been used yet on this card.
  const runActions = runSpec === null ? [] : runSpec.actions.filter(action => !(action.role in liveSessions));
  const threadSession = itemThreadSession(liveSessions);

  return (
    <article
      draggable
      aria-label={item.title}
      data-testid="work-item-card"
      onDragStart={event => setDragPayload(event, { kind: 'work-item', id: item.id, fromStage: columnStage })}
      className="flex cursor-grab flex-col gap-1.5 rounded-md border border-border1 bg-surface4 p-2 active:cursor-grabbing"
    >
      <div className="flex items-start gap-2">
        <Icon size={14} className={`mt-0.5 shrink-0 ${iconClassName}`} aria-hidden />
        {threadSession !== null ? (
          <a
            href={`/threads/${threadSession.threadId}`}
            onClick={event => {
              event.preventDefault();
              onOpenThread(threadSession);
            }}
            className="min-w-0 flex-1 truncate text-ui-sm text-icon6 no-underline hover:underline"
          >
            {item.title}
          </a>
        ) : (
          <button
            type="button"
            disabled={runDisabled}
            aria-busy={pendingRunRoles.size > 0 || undefined}
            onClick={() => onCreateSession(itemSessionSpec(item))}
            className="min-w-0 flex-1 truncate text-left text-ui-sm text-icon6 hover:underline disabled:opacity-60"
          >
            {item.title}
          </button>
        )}
        {item.url !== null && (
          <a
            href={item.url}
            target="_blank"
            rel="noreferrer"
            aria-label={externalLinkLabel(item.source)}
            className="mt-0.5 shrink-0 text-icon3 hover:text-icon5"
          >
            <ExternalLink size={12} aria-hidden />
          </a>
        )}
        <DropdownMenu>
          <DropdownMenu.Trigger
            render={
              <Button type="button" variant="ghost" size="icon-sm" aria-label={`Actions for ${item.title}`}>
                <EllipsisVertical size={13} aria-hidden />
              </Button>
            }
          />
          <DropdownMenu.Content align="end" className="min-w-44">
            {runSpec !== null &&
              runActions.map(action => {
                const starting = pendingRunRoles.has(action.role);
                return (
                  <DropdownMenu.Item
                    key={action.label}
                    disabled={runDisabled || starting}
                    onClick={() => onStartRun(runSpec, action)}
                  >
                    {starting ? 'Starting…' : action.label}
                  </DropdownMenu.Item>
                );
              })}
            {BOARD_STAGES.filter(stage => stage.id !== columnStage).map(stage => (
              <DropdownMenu.Item key={stage.id} onClick={() => onMove(stage.id)}>
                {stage.id === 'done' ? 'Mark done' : `Move to ${stage.label}`}
              </DropdownMenu.Item>
            ))}
            <DropdownMenu.Item onClick={onRemove}>Remove</DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu>
      </div>
      {otherStages.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          {otherStages.map(stage => (
            <span key={stage} className="rounded-full bg-surface5 px-1.5 py-0.5 text-ui-xs text-icon4">
              {stageLabel(stage)}
            </span>
          ))}
        </div>
      )}
    </article>
  );
}

function CandidateCard({
  candidate,
  pendingRunRoles,
  triageStarting,
  disabled,
  onRun,
  onOpenSession,
  onFile,
  onTriage,
}: {
  candidate: BoardCandidate;
  pendingRunRoles: ReadonlySet<string>;
  triageStarting: boolean;
  disabled: boolean;
  /** Start a run; `prompt` undefined = the action's default prompt. */
  onRun: (action: RunAction, prompt?: string) => void;
  /** Title click: materialize the card + open an empty session (no run). */
  onOpenSession: () => void;
  /** File the candidate onto the board without starting a run. */
  onFile: () => void;
  /** Run first-contact issue triage without leaving the board. */
  onTriage?: () => void;
}) {
  const Icon = candidate.icon;
  const labels = metadataLabels(candidate.metadata);
  const showTriage = candidate.source === 'github-issue' && !hasLabel(labels, AUTO_TRIAGED_LABEL) && onTriage;
  const [defaultAction, ...otherActions] = candidate.runActions;
  return (
    <article
      draggable
      aria-label={candidate.title}
      data-testid="candidate-card"
      onDragStart={event =>
        setDragPayload(event, {
          kind: 'candidate',
          candidate: {
            source: candidate.source,
            sourceKey: candidate.sourceKey,
            title: candidate.title,
            url: candidate.url,
            metadata: candidate.metadata,
          },
        })
      }
      className="flex cursor-grab flex-col gap-1 rounded-md border border-border1 border-dashed bg-surface3 p-2 active:cursor-grabbing"
    >
      <div className="flex items-start gap-2">
        <Icon size={14} className={`mt-0.5 shrink-0 ${candidate.iconClassName}`} aria-hidden />
        <div className="flex min-w-0 flex-1 flex-col">
          <button
            type="button"
            disabled={disabled}
            aria-busy={pendingRunRoles.has(defaultAction.role) || undefined}
            onClick={onOpenSession}
            className="truncate text-left text-ui-sm text-icon6 hover:underline disabled:opacity-60"
          >
            {candidate.title}
          </button>
          <span className="block truncate text-ui-xs text-icon3">{candidate.meta}</span>
        </div>
        <a
          href={candidate.url}
          target="_blank"
          rel="noreferrer"
          aria-label={externalLinkLabel(candidate.source)}
          className="mt-0.5 shrink-0 text-icon3 hover:text-icon5"
        >
          <ExternalLink size={12} aria-hidden />
        </a>
      </div>
      <FactoryItemActions
        actionLabel={defaultAction.label}
        itemLabel={candidate.title}
        starting={pendingRunRoles.has(defaultAction.role)}
        disabled={disabled}
        onAction={() => onRun(defaultAction)}
        extraActions={otherActions.map(action => ({
          label: action.label,
          starting: pendingRunRoles.has(action.role),
          onAction: () => onRun(action),
        }))}
        onRunPrompt={prompt => onRun(defaultAction, prompt)}
        menuExtras={
          <>
            {showTriage && (
              <DropdownMenu.Item disabled={triageStarting} onClick={onTriage}>
                {triageStarting ? 'Starting…' : 'Triage issue'}
              </DropdownMenu.Item>
            )}
            <DropdownMenu.Item onClick={onFile}>Add to board</DropdownMenu.Item>
          </>
        }
      />
    </article>
  );
}

// ── Per-column candidate extras (loading, reauth, pagination) ───────────────

/**
 * Intake column tail for the ACTIVE candidate feed: loading state, Linear
 * reauth notice, and pagination. Only one feed is browsed at a time, so only
 * its states render.
 */
function IntakeColumnExtras({
  source,
  issues,
  pulls,
  linearIssues,
}: {
  source: IntakeSource | null;
  issues: ReturnType<typeof useProjectIssuesQuery>;
  pulls: ReturnType<typeof useProjectPullRequestsQuery>;
  linearIssues: ReturnType<typeof useLinearIssuesQuery>;
}) {
  const { baseUrl } = useApiConfig();
  if (source === null) return null;
  const feed = source === 'github' ? issues : source === 'github-prs' ? pulls : linearIssues;

  return (
    <>
      {feed.isPending && feed.fetchStatus !== 'idle' && (
        <SkeletonRows label="Loading intake candidates" rows={3} rowClassName="h-12 w-full" />
      )}
      {source === 'linear' && linearIssues.isError && isLinearReauthError(linearIssues.error) && (
        <div className="flex flex-col gap-2 p-1">
          <Txt as="span" variant="ui-xs" className="text-icon3">
            Linear authorization expired. Reconnect to keep syncing issues.
          </Txt>
          <Button size="xs" onClick={() => connectLinear(baseUrl)}>
            Connect Linear
          </Button>
        </div>
      )}
      <LoadMoreSentinel
        hasNextPage={Boolean(feed.hasNextPage)}
        isFetchingNextPage={Boolean(feed.isFetchingNextPage)}
        onLoadMore={() => void feed.fetchNextPage()}
        label="Load more candidates"
      />
    </>
  );
}
