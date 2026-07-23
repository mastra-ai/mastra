import { Button, buttonVariants } from '@mastra/playground-ui/components/Button';
import { DropdownMenu } from '@mastra/playground-ui/components/DropdownMenu';
import { EmptyState } from '@mastra/playground-ui/components/EmptyState';
import { Notice } from '@mastra/playground-ui/components/Notice';
import { ScrollArea } from '@mastra/playground-ui/components/ScrollArea';
import { Spinner } from '@mastra/playground-ui/components/Spinner';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { cn } from '@mastra/playground-ui/utils/cn';
import {
  ArrowUpRight,
  CheckCircle2,
  CircleDot,
  CircleX,
  EllipsisVertical,
  GitCompareArrows,
  GitPullRequest,
  Link2,
  Plus,
  Stethoscope,
  Trash2,
} from 'lucide-react';
import type { ComponentType, DragEvent } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';

import { useApiConfig } from '../../../shared/api/config';
import { relativeTime } from '../../../shared/lib/date/relativeTime';
import { useWorkspacesQuery } from '../../../shared/hooks/useWorkspaces';
import { SkeletonRows } from '../ui/SkeletonRows';
import { GithubIcon } from '../ui/icons';
import type { FactoryProject, LinkedRepositoryPayload } from '../domains/workspaces/services/github';
import { FactoryItemActions, actionIcon } from '../domains/factory/components/FactoryItemActions';
import { FactoryPageShell } from '../domains/factory/components/FactoryPageShell';
import { LoadMoreSentinel } from '../domains/factory/components/LoadMoreSentinel';
import {
  useProjectIssuesQuery,
  useProjectPullRequestsQuery,
  useStartIssueTriageMutation,
} from '../../../shared/hooks/useFactoryData';
import { useIntakeConfigQuery } from '../../../shared/hooks/useIntakeConfig';
import { useFactoryDecisionStatus, useRetryFactoryDecision } from '../../../shared/hooks/useFactoryDecisions';
import { useLinearIssuesQuery, useLinearStatusQuery } from '../../../shared/hooks/useLinearData';
import { useStartFactoryRun } from '../../../shared/hooks/useStartFactoryRun';
import type { FactoryRunInvocation, FactoryRunPhase } from '../../../shared/hooks/useStartFactoryRun';
import {
  useDeleteWorkItemMutation,
  useTransitionWorkItemMutation,
  useUpdateWorkItemMutation,
  useUpsertWorkItemMutation,
} from '../../../shared/hooks/useWorkItems';
import { useWorkItemsQuery } from '../../../shared/hooks/useWorkItems';
import type { FactoryDecisionStatus, FactoryDecisionSummary } from '../domains/factory/services/decisions';
import type { GithubIssue, GithubPullRequest } from '../domains/factory/services/factory';
import type { LinearIssue } from '../domains/factory/services/linear';
import { connectLinear, isLinearReauthError } from '../domains/factory/services/linear';
import {
  inferredParentWorkItemId,
  relatedWorkItems,
  relationshipLabel,
  relationshipPath,
} from '../domains/factory/services/relationships';
import type { WorkItem, WorkItemSessionRef, WorkItemSource } from '../domains/factory/services/workItems';
import { BOARD_STAGES, stageLabel } from '../domains/factory/stages';
import type { BoardStageId } from '../domains/factory/stages';
import { Skeleton } from '@mastra/playground-ui/components/Skeleton';

const AUTO_TRIAGED_LABEL = 'auto-triaged';
const NEEDS_APPROVAL_LABEL = 'needs-approval';
const HIDDEN_CARD_LABELS = new Set([AUTO_TRIAGED_LABEL, NEEDS_APPROVAL_LABEL]);

const SOURCE_LABELS: Record<WorkItemSource, string> = {
  'github-issue': 'Issue',
  'github-pr': 'PR Review',
  'linear-issue': 'Linear',
  manual: 'Manual',
};

function SourceTitle({ source, title }: { source: WorkItemSource; title: string }) {
  return (
    <>
      <span className="sr-only">{SOURCE_LABELS[source]}: </span>
      <span>{title}</span>
    </>
  );
}

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
const EMPTY_PENDING_RUN_ROLES = new Map<string, FactoryRunPhase | undefined>();

const RUN_PHASE_LABELS: Record<FactoryRunPhase, string> = {
  workspace: 'preparing workspace…',
  kickoff: 'starting agent…',
  opening: 'opening thread…',
};

type IntakeSource = (typeof INTAKE_SOURCES)[number]['id'];
type BoardKind = 'work' | 'review';

const REVIEW_BOARD_STAGES: ReadonlyArray<{ id: BoardStageId; label: string }> = [
  { id: 'intake', label: 'Intake' },
  { id: 'review', label: 'Reviewing' },
  { id: 'done', label: 'Done' },
];

function boardStages(kind: BoardKind): ReadonlyArray<{ id: BoardStageId; label: string }> {
  return kind === 'review' ? REVIEW_BOARD_STAGES : BOARD_STAGES;
}

function belongsToBoard(item: WorkItem, kind: BoardKind): boolean {
  return kind === 'review' ? item.source === 'github-pr' : item.source !== 'github-pr';
}

function itemAppearsInStage(item: WorkItem, stage: BoardStageId, stages: ReadonlyArray<{ id: BoardStageId }>): boolean {
  if (item.stages.includes(stage)) return true;
  return stage === 'intake' && !stages.some(candidate => item.stages.includes(candidate.id));
}

function githubNumberForItem(item: WorkItem): number | undefined {
  const metadataKey = item.source === 'github-issue' ? 'githubIssueNumber' : 'githubPullRequestNumber';
  const itemNumber = item.metadata[metadataKey] ?? item.metadata.number;
  if (typeof itemNumber !== 'number' || !Number.isInteger(itemNumber) || itemNumber <= 0) return;
  return itemNumber;
}

function candidateSourceKeyForItem(item: WorkItem): string | undefined {
  const itemNumber = githubNumberForItem(item);
  if (itemNumber === undefined) return;
  if (item.source === 'github-issue') return `github-issue:${itemNumber}`;
  if (item.source === 'github-pr') return `github-pr:${itemNumber}`;
  return;
}

function itemStageOptions(item: WorkItem): ReadonlyArray<{ id: BoardStageId; label: string }> {
  return boardStages(item.source === 'github-pr' ? 'review' : 'work');
}

function itemStageLabel(item: WorkItem, stage: string): string {
  return itemStageOptions(item).find(candidate => candidate.id === stage)?.label ?? stageLabel(stage);
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

function stageContentCount(
  stage: BoardStageId,
  stages: ReadonlyArray<{ id: BoardStageId }>,
  workItems: readonly WorkItem[],
  candidates: readonly BoardCandidate[],
): number {
  let count = candidates.filter(candidate => candidate.column === stage).length;
  for (const item of workItems) {
    if (itemAppearsInStage(item, stage, stages)) count += 1;
  }
  return count;
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
        skillName: 'factory-triage',
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
    icon: IssueSourceIcon,
    iconClassName: '',
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
    icon: GitCompareArrows,
    iconClassName: 'text-accent1',
    column: 'intake',
    runActions: [
      {
        label: 'Review',
        role: 'review',
        stage: 'review',
        invocation: {
          type: 'skill',
          skillName: 'factory-review',
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
  const githubNumber = githubNumberForItem(item);
  if (item.source === 'github-issue' && githubNumber !== undefined) {
    const labels = metadataLabels(meta);
    const needsApproval = hasLabel(labels, NEEDS_APPROVAL_LABEL);
    const ref = `GitHub issue #${githubNumber}${item.url ? ` (${item.url})` : ''}`;
    return {
      branch: `factory/issue-${githubNumber}`,
      threadTitle: needsApproval ? `Triage #${githubNumber}: ${item.title}` : `Issue #${githubNumber}: ${item.title}`,
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
              threadTags: issueTriageThreadTags(githubNumber),
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
  if (item.source === 'github-pr' && githubNumber !== undefined) {
    const ref = `GitHub pull request #${githubNumber}${item.url ? ` (${item.url})` : ''}`;
    const checkout = `Check out the PR in this worktree first with \`gh pr checkout ${githubNumber}\`.`;
    const headBranch = typeof meta.headBranch === 'string' ? ` Expected head branch: ${meta.headBranch}.` : '';
    return {
      branch: `factory/pr-${githubNumber}`,
      threadTitle: `PR #${githubNumber}: ${item.title}`,
      actions: [
        {
          label: 'Review',
          role: 'review',
          stage: 'review',
          invocation: {
            type: 'skill',
            skillName: 'factory-review',
            arguments: `${ref}\n\n${checkout}${headBranch}`,
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
const ACTIVE_DECISION_STATUSES: FactoryDecisionStatus[] = ['pending', 'leased', 'retry', 'failed'];

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
export function WorkBoardPage() {
  return <FactoryBoardPage kind="work" />;
}

export function ReviewBoardPage() {
  return <FactoryBoardPage kind="review" />;
}

/** @deprecated Use WorkBoardPage. */
export function BoardPage() {
  return <WorkBoardPage />;
}

function FactoryBoardPage({ kind }: { kind: BoardKind }) {
  const review = kind === 'review';
  return <FactoryPageShell>{factory => <Board factory={factory} kind={kind} />}</FactoryPageShell>;
}

function Board({ factory, kind }: { factory: FactoryProject; kind: BoardKind }) {
  const repository = factory.repositories[0];
  const review = kind === 'review';

  if (!repository) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center overflow-y-auto py-8">
        <EmptyState
          as="h2"
          iconSlot={<GithubIcon size={40} className="text-icon3" />}
          titleSlot={review ? 'Connect a repository to start reviewing' : 'Connect a repository to start intake'}
          descriptionSlot={
            review
              ? 'Link a GitHub repository in Source Control settings. Its pull requests will appear in Intake, ready to move through review.'
              : 'Link a GitHub repository in Source Control settings. Its issues will appear in Intake, ready to move through planning and build.'
          }
          actionSlot={
            <Link
              to={`/factories/${factory.id}/settings/source-control`}
              className={buttonVariants({ variant: 'primary' })}
            >
              Open Source Control settings
            </Link>
          }
        />
      </div>
    );
  }

  return <BoardContent factory={factory} repository={repository} kind={kind} />;
}

function BoardContent({
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
  const newIssueUrl = !review && config && githubIntakeActive ? githubNewIssueUrl(repository.slug) : undefined;
  const [intakeSource, setIntakeSource] = useState<IntakeSource>(review ? 'github-prs' : 'github');
  const showIntakeSourceSwitch = availableIntakeSources.length > 1;
  const activeIntakeSource: IntakeSource | null = availableIntakeSources.includes(intakeSource)
    ? intakeSource
    : (availableIntakeSources[0] ?? null);

  // Only the active intake feed fetches; the other feeds load on switch.
  const issues = useProjectIssuesQuery(activeIntakeSource === 'github' ? projectRepositoryId : undefined);
  const triageIssues = useProjectIssuesQuery(!review ? projectRepositoryId : undefined, AUTO_TRIAGED_LABEL);
  const pulls = useProjectPullRequestsQuery(activeIntakeSource === 'github-prs' ? projectRepositoryId : undefined);
  const linearIssues = useLinearIssuesQuery(activeIntakeSource === 'linear' ? factoryProjectId : undefined);

  const upsert = useUpsertWorkItemMutation(factoryProjectId);
  const transition = useTransitionWorkItemMutation(factoryProjectId);
  const [transitionReasons, setTransitionReasons] = useState<Record<string, string>>({});
  const update = useUpdateWorkItemMutation(factoryProjectId);
  const remove = useDeleteWorkItemMutation(factoryProjectId);
  const { start, pendingRuns, enabled: runEnabled } = useStartFactoryRun();
  const { triage, pendingIssueNumbers } = useStartIssueTriageMutation(projectRepositoryId, factoryProjectId);
  const navigate = useNavigate();
  const boardContainerRef = useRef<HTMLDivElement>(null);
  const laneRefs = useRef(new Map<BoardStageId, HTMLElement>());
  const boardPositionKey = `${factory.id}:${kind}`;
  const autoPositionedBoardRef = useRef<string | undefined>(undefined);
  const userPositionedBoardRef = useRef<string | undefined>(undefined);

  // Workspaces that still exist. A card's session ref whose workspace was
  // deleted is stale: its thread is gone (workspace deletion cascades onto its
  // threads), so it neither renders a Thread link nor blocks re-running.
  const workspaces = useWorkspacesQuery(projectRepositoryId);
  const liveWorktreePaths = useMemo(
    () => new Set((workspaces.data?.workspaces ?? []).map(workspace => workspace.sessionId)),
    [workspaces.data],
  );

  const openThread = async (session: WorkItemSessionRef) => {
    navigate(`/factories/${factory.id}/workspaces/${session.sessionId}/threads/${session.threadId}`);
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
    const liveSessions = Object.fromEntries(
      Object.entries(refreshed.item.sessions).filter(([, session]) => refreshed.paths.has(session.sessionId)),
    );
    const existingSession = itemThreadSession(liveSessions);
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
  const triageDataPending = !review && triageIssues.isPending;
  const loadingStages = new Set<BoardStageId>();
  if (items.isPending) {
    for (const stage of stages) loadingStages.add(stage.id);
  }
  if (intakeDataPending) loadingStages.add('intake');
  if (triageDataPending) loadingStages.add('triage');
  const boardDataPending = loadingStages.size > 0;

  useEffect(() => {
    if (boardDataPending || autoPositionedBoardRef.current === boardPositionKey) return;
    if (userPositionedBoardRef.current === boardPositionKey) return;

    const firstPopulatedStage = stages.find(
      stage =>
        workItems.some(item => item.stages.includes(stage.id)) ||
        candidates.some(candidate => candidate.column === stage.id),
    );
    const container = boardContainerRef.current;
    const lane = firstPopulatedStage ? laneRefs.current.get(firstPopulatedStage.id) : undefined;
    if (!container || !lane) return;
    autoPositionedBoardRef.current = boardPositionKey;
    container.scrollTo?.({ left: Math.max(0, lane.offsetLeft - container.offsetLeft), behavior: 'auto' });
  }, [boardDataPending, boardPositionKey, candidates, stages, workItems]);

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

  const moveItem = (id: string, _fromStage: string | null, toStage: string) => {
    const item = workItems.find(i => i.id === id);
    if (!item || (item.stages.length === 1 && item.stages[0] === toStage)) return;
    requestTransition(item, toStage);
  };

  const handleDrop = (payload: DragPayload, toStage: BoardStageId) => {
    if (payload.kind === 'work-item') {
      if (payload.fromStage === toStage) return;
      moveItem(payload.id, payload.fromStage, toStage);
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

  if (items.isError) {
    return (
      <Notice variant="destructive">
        {items.error instanceof Error ? items.error.message : 'Failed to load the board'}
      </Notice>
    );
  }

  const mutationError = [start, triage, upsert, transition, update, remove].find(m => m.isError)?.error;
  const evaluatingStages = new Map(transition.pendingTransitions.map(({ itemId, stage }) => [itemId, stage]));
  const triagingIssueNumbers = new Set(pendingIssueNumbers);
  const pendingRunRolesByItem = new Map<string, Map<string, FactoryRunPhase | undefined>>();
  const pendingRunRolesBySource = new Map<string, Map<string, FactoryRunPhase | undefined>>();
  for (const run of pendingRuns) {
    if (run.id !== undefined) {
      const roles = pendingRunRolesByItem.get(run.id);
      if (roles) roles.set(run.role, run.phase);
      else pendingRunRolesByItem.set(run.id, new Map([[run.role, run.phase]]));
    }
    if (run.sourceKey !== null) {
      const roles = pendingRunRolesBySource.get(run.sourceKey);
      if (roles) roles.set(run.role, run.phase);
      else pendingRunRolesBySource.set(run.sourceKey, new Map([[run.role, run.phase]]));
    }
  }
  const totalTaskCount = workItems.length + candidates.length;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      {mutationError !== undefined && (
        <Notice variant="destructive">
          {mutationError instanceof Error ? mutationError.message : 'Board action failed'}
        </Notice>
      )}
      <ScrollArea
        viewportRef={boardContainerRef}
        orientation="horizontal"
        className="min-h-0 flex-1 [&_[data-hovering]:not([data-scrolling])]:opacity-0"
        viewPortClassName="pb-2 *:h-full"
        aria-label="Board columns"
        onPointerDown={() => {
          userPositionedBoardRef.current = boardPositionKey;
        }}
        onWheel={() => {
          userPositionedBoardRef.current = boardPositionKey;
        }}
      >
        <div className="flex h-full min-h-0 gap-3">
          {stages.map(stage => (
            <BoardColumn
              key={stage.id}
              stage={stage.id}
              label={stage.label}
              taskCount={stageContentCount(stage.id, stages, workItems, candidates)}
              totalTaskCount={totalTaskCount}
              loading={loadingStages.has(stage.id)}
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
                        className={cn(
                          'rounded-full border px-2.5 py-0.5 text-ui-xs transition',
                          activeIntakeSource === source.id
                            ? 'border-accent1 bg-surface4 text-icon6'
                            : 'border-border1 bg-transparent text-icon3 hover:text-icon5',
                        )}
                      >
                        {source.label}
                      </button>
                    ))}
                  </div>
                ) : undefined
              }
            >
              {workItems
                .filter(item => itemAppearsInStage(item, stage.id, stages))
                .map(item => (
                  <WorkItemCard
                    key={`${item.id}:${stage.id}`}
                    item={item}
                    columnStage={stage.id}
                    allItems={allWorkItems}
                    liveWorktreePaths={liveWorktreePaths}
                    // Until the worktree listing settles, liveness is unknown and
                    // every session ref looks stale — the title would render as a
                    // create button and a click would mint a replacement session
                    // for a perfectly live thread. Hold run/create actions until
                    // liveness is known.
                    runDisabled={!runEnabled || !workspaces.isSuccess}
                    evaluatingStage={evaluatingStages.get(item.id)}
                    transitionReason={transitionReasons[item.id]}
                    decision={decisionByItem.get(item.id)}
                    retryingDecisionId={retryDecision.isPending ? retryDecision.variables : undefined}
                    onRetryDecision={decisionId => retryDecision.mutate(decisionId)}
                    pendingRunRoles={pendingRunRolesByItem.get(item.id) ?? EMPTY_PENDING_RUN_ROLES}
                    onCreateSession={() => void openOrCreateSession(item, stage.id)}
                    onStartRun={(_spec, action) => void openOrStartRun(item, action.role)}
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
                    pendingRunRoles={pendingRunRolesBySource.get(candidate.sourceKey) ?? EMPTY_PENDING_RUN_ROLES}
                    triageStarting={candidate.issue !== undefined && triagingIssueNumbers.has(candidate.issue.number)}
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
                          parentWorkItemId:
                            candidate.source === 'github-pr'
                              ? inferredParentWorkItemId(candidate.metadata, allWorkItems)
                              : undefined,
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
                          parentWorkItemId:
                            candidate.source === 'github-pr'
                              ? inferredParentWorkItemId(candidate.metadata, allWorkItems)
                              : undefined,
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
              {loadingStages.has(stage.id) && (
                <SkeletonRows label={`Loading ${stage.label} column`} rows={3} rowClassName="h-24 w-full" />
              )}
              {!loadingStages.has(stage.id) && stageContentCount(stage.id, stages, workItems, candidates) === 0 && (
                <BoardColumnEmptyState stage={stage.id} kind={kind} hasIntakeSource={activeIntakeSource !== null} />
              )}
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
      </ScrollArea>
    </div>
  );
}

// ── Columns ─────────────────────────────────────────────────────────────────

interface BoardColumnEmptyCopy {
  title: string;
  description: string;
}

function boardColumnEmptyCopy(stage: BoardStageId, kind: BoardKind, hasIntakeSource: boolean): BoardColumnEmptyCopy {
  switch (stage) {
    case 'intake':
      if (!hasIntakeSource) {
        return {
          title: 'No intake sources',
          description: 'Choose GitHub or Linear in Settings to feed this column.',
        };
      }
      return kind === 'review'
        ? {
            title: 'No pull requests waiting',
            description: 'Open pull requests from this repository appear here.',
          }
        : {
            title: 'Intake is clear',
            description: 'New issues from your connected sources appear here.',
          };
    case 'triage':
      return {
        title: 'Nothing to triage',
        description: 'Drag an intake item here when it needs investigation.',
      };
    case 'planning':
      return {
        title: 'Nothing in planning',
        description: 'Drag triaged work here when it is ready to plan.',
      };
    case 'execute':
      return {
        title: 'Nothing being built',
        description: 'Drag planned work here when implementation starts.',
      };
    case 'review':
      return kind === 'review'
        ? {
            title: 'No active reviews',
            description: 'Drag a pull request here when review starts.',
          }
        : {
            title: 'Nothing awaiting review',
            description: 'Drag built work here when it is ready for review.',
          };
    case 'done':
      return kind === 'review'
        ? {
            title: 'No completed reviews',
            description: 'Drag a reviewed pull request here when it is complete.',
          }
        : {
            title: 'Nothing completed yet',
            description: 'Drag finished work here to close it out.',
          };
    case 'canceled':
      return {
        title: 'Nothing canceled',
        description: 'Drag work here when it should leave the active flow.',
      };
  }
}

function BoardColumnEmptyState({
  stage,
  kind,
  hasIntakeSource,
}: {
  stage: BoardStageId;
  kind: BoardKind;
  hasIntakeSource: boolean;
}) {
  const copy = boardColumnEmptyCopy(stage, kind, hasIntakeSource);
  return (
    <div className="flex min-h-24 flex-col justify-center rounded-lg border border-dashed border-border1 px-4 py-4">
      <Txt as="p" variant="ui-sm" className="m-0 font-medium text-icon4">
        {copy.title}
      </Txt>
      <Txt as="p" variant="ui-xs" className="mt-1 mb-0 max-w-60 leading-5 text-icon3">
        {copy.description}
      </Txt>
    </div>
  );
}

function ColumnTaskBadge({ count, total, label }: { count: number; total: number; label: string }) {
  const circumference = 2 * Math.PI * 5;
  const ratio = total === 0 ? 0 : Math.min(count / total, 1);
  const dashOffset = circumference * (1 - ratio);

  return (
    <span
      aria-label={`${count} of ${total} visible board tasks in ${label}`}
      title={`${count} of ${total} visible board tasks`}
      className="flex h-6 min-w-12 shrink-0 items-center justify-center gap-1.5 rounded-full border border-border1 bg-surface2 px-2 text-ui-xs font-medium tabular-nums text-icon4"
    >
      <svg viewBox="0 0 14 14" className="size-3.5 -rotate-90" aria-hidden>
        <circle cx="7" cy="7" r="5" fill="none" strokeWidth="2" className="stroke-border1" />
        <circle
          cx="7"
          cy="7"
          r="5"
          fill="none"
          strokeWidth="2"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          className="stroke-icon5 transition-[stroke-dashoffset] motion-reduce:transition-none"
        />
      </svg>
      <span aria-hidden>{count}</span>
    </span>
  );
}

const BOARD_CARD_SELECTOR = '[data-testid="work-item-card"], [data-testid="candidate-card"]';
const BOARD_CARD_GAP_PX = 10;

function dropLinePosition(cardList: HTMLDivElement, pointerY: number): number {
  const cards = cardList.querySelectorAll<HTMLElement>(BOARD_CARD_SELECTOR);
  if (cards.length === 0) return 0;

  for (let index = 0; index < cards.length; index += 1) {
    const card = cards.item(index);
    if (!card) continue;
    const bounds = card.getBoundingClientRect();
    if (pointerY < bounds.top + bounds.height / 2) {
      return Math.max(0, card.offsetTop - (index === 0 ? 0 : BOARD_CARD_GAP_PX / 2));
    }
  }

  const lastCard = cards.item(cards.length - 1);
  return lastCard ? lastCard.offsetTop + lastCard.offsetHeight + BOARD_CARD_GAP_PX / 2 : 0;
}

function BoardColumn({
  stage,
  label,
  taskCount,
  totalTaskCount,
  loading = false,
  laneRef,
  onDrop,
  headerAction,
  headerExtras,
  children,
}: {
  stage: BoardStageId;
  label: string;
  taskCount: number;
  totalTaskCount: number;
  /** While loading, the task badge is hidden so a false "0/0" never flashes. */
  loading?: boolean;
  laneRef: (element: HTMLElement | null) => void;
  onDrop: (payload: DragPayload, toStage: BoardStageId) => void;
  headerAction?: React.ReactNode;
  /** Pinned below the column title, outside the scrolling card list. */
  headerExtras?: React.ReactNode;
  children: React.ReactNode;
}) {
  const [dragOver, setDragOver] = useState(false);
  const [dropLineTop, setDropLineTop] = useState(0);
  const cardListRef = useRef<HTMLDivElement>(null);
  const collapsed = stage !== 'intake' && !loading && taskCount === 0;

  return (
    <section
      ref={laneRef}
      aria-label={collapsed ? `${label}, empty` : label}
      data-testid={`board-column-${stage}`}
      className={cn(
        'flex min-h-0 shrink-0 flex-col transition-[width,background-color] motion-reduce:transition-none',
        collapsed ? 'w-14 rounded-lg' : 'w-80 gap-4',
        collapsed && dragOver && 'bg-surface2 ring-1 ring-border1',
      )}
      onDragOver={event => {
        if (!event.dataTransfer.types.includes(CARD_MIME)) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
        setDragOver(true);
        const cardList = cardListRef.current;
        if (cardList) setDropLineTop(dropLinePosition(cardList, event.clientY));
      }}
      onDragLeave={event => {
        if (event.relatedTarget instanceof Node && event.currentTarget.contains(event.relatedTarget)) return;
        setDragOver(false);
      }}
      onDrop={event => {
        event.preventDefault();
        setDragOver(false);
        const payload = readDragPayload(event);
        if (payload) onDrop(payload, stage);
      }}
    >
      {collapsed ? (
        <div className="flex min-h-0 flex-1 flex-col items-center gap-3 py-1">
          <span aria-hidden className="flex h-8 items-center text-ui-xs font-medium tabular-nums text-icon3">
            {taskCount}
          </span>
          <Txt as="h2" variant="ui-smd" className="m-0 font-semibold text-icon3 [writing-mode:vertical-rl]">
            {label}
          </Txt>
        </div>
      ) : (
        <>
          <div className="flex min-h-8 items-start justify-between gap-2">
            <div className="flex h-8 min-w-0 items-center gap-2">
              <BoardStageIcon stage={stage} />
              <Txt as="h2" variant="ui-smd" className="m-0 truncate font-semibold text-icon3">
                {label}
              </Txt>
              {loading ? (
                <Skeleton className="h-6 w-12 shrink-0 rounded-full" />
              ) : (
                <ColumnTaskBadge count={taskCount} total={totalTaskCount} label={label} />
              )}
            </div>
            {headerAction && <div className="flex h-8 shrink-0 items-center">{headerAction}</div>}
          </div>
          {headerExtras}
          {/* Cards scroll inside the swimlane; the page stays fixed. */}
          <div className="min-h-16 flex-1">
            <ScrollArea className="h-full">
              <div ref={cardListRef} className="relative flex flex-col gap-2.5 pb-2">
                {children}
                <div
                  aria-hidden
                  style={{ top: dropLineTop }}
                  className={cn(
                    'pointer-events-none absolute inset-x-0 z-10 h-0.5 rounded-full bg-neutral1 transition-opacity motion-reduce:transition-none',
                    dragOver ? 'opacity-100' : 'opacity-0',
                  )}
                />
              </div>
            </ScrollArea>
          </div>
        </>
      )}
    </section>
  );
}

// ── Cards ───────────────────────────────────────────────────────────────────

const SOURCE_ICONS: Record<
  WorkItemSource,
  { icon: ComponentType<{ size?: number; className?: string }>; className: string }
> = {
  'github-issue': { icon: IssueSourceIcon, className: '' },
  'github-pr': { icon: GitCompareArrows, className: 'text-accent1' },
  'linear-issue': { icon: CircleDot, className: 'text-accent3' },
  manual: { icon: CircleDot, className: 'text-icon3' },
};

const STAGE_ICON_SOURCES: Partial<Record<BoardStageId, string>> = {
  triage: '/factory-stage-icons/triage.svg',
  planning: '/factory-stage-icons/in-progress.svg',
  execute: '/factory-stage-icons/in-progress.svg',
};

function BoardStageIcon({ stage }: { stage: BoardStageId }) {
  if (stage === 'intake') return <ArrowRightCircleIcon className="shrink-0 text-[#939393]" />;
  if (stage === 'review') return <GitPullRequest size={16} className="shrink-0 text-icon3" aria-hidden />;
  const source = STAGE_ICON_SOURCES[stage];
  if (source) return <img src={source} alt="" aria-hidden className="size-4 shrink-0" />;
  const Icon = stage === 'done' ? CheckCircle2 : CircleX;
  return <Icon size={16} className="shrink-0 text-icon3" aria-hidden />;
}

function ArrowRightCircleIcon({ size = 16, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden
    >
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M8 14.67C11.68 14.67 14.67 11.68 14.67 8C14.67 4.32 11.68 1.33 8 1.33C4.32 1.33 1.33 4.32 1.33 8C1.33 11.68 4.32 14.67 8 14.67ZM9.14 5.53C8.88 5.27 8.46 5.27 8.2 5.53C7.93 5.79 7.93 6.21 8.2 6.47L9.06 7.33H5.33C4.97 7.33 4.67 7.63 4.67 8C4.67 8.37 4.97 8.67 5.33 8.67H9.06L8.2 9.53C7.93 9.79 7.93 10.21 8.2 10.47C8.46 10.73 8.88 10.73 9.14 10.47L11.14 8.47C11.4 8.21 11.4 7.79 11.14 7.53L9.14 5.53Z"
        fill="currentColor"
      />
    </svg>
  );
}

function IssueSourceIcon({ size = 16, className }: { size?: number; className?: string }) {
  return <ArrowRightCircleIcon size={size} className={cn('text-[#6CCDFB]', className)} />;
}

function labelDotClass(label: string): string {
  const normalized = label.toLowerCase();
  if (normalized.includes('bug') || normalized.includes('error')) return 'bg-accent2';
  if (normalized.includes('approval') || normalized.includes('priority')) return 'bg-accent6';
  if (normalized.includes('triage') || normalized.includes('ready')) return 'bg-accent1';
  if (normalized.includes('cli') || normalized.includes('linear')) return 'bg-accent3';
  if (normalized.includes('work') || normalized.includes('trio')) return 'bg-accent6';
  return 'bg-icon3';
}

function CardLabels({ labels }: { labels: readonly string[] }) {
  const displayLabels = labels.filter(label => !HIDDEN_CARD_LABELS.has(label.toLowerCase()));
  if (displayLabels.length === 0) return null;
  const visibleLabels = displayLabels.slice(0, 3);
  const hiddenCount = displayLabels.length - visibleLabels.length;
  return (
    <div className="flex flex-wrap items-center gap-1.5" aria-label="Labels">
      {visibleLabels.map(label => (
        <span
          key={label}
          className="inline-flex h-6 max-w-full items-center gap-1 rounded-full border border-border1 px-2 text-ui-xs text-icon4"
          title={label}
        >
          <span className={cn('size-1.5 shrink-0 rounded-full', labelDotClass(label))} aria-hidden />
          <span className="truncate">{label}</span>
        </span>
      ))}
      {hiddenCount > 0 && (
        <span className="inline-flex h-6 items-center rounded-full border border-border1 px-2 text-ui-xs text-icon3">
          +{hiddenCount}
        </span>
      )}
    </div>
  );
}

function workItemMeta(item: WorkItem): string {
  const author = typeof item.metadata.author === 'string' ? item.metadata.author : undefined;
  const age = `added ${relativeTime(item.createdAt)}`;
  const githubNumber = githubNumberForItem(item);
  if (githubNumber !== undefined) return `#${githubNumber}${author ? ` · ${author}` : ''} · ${age}`;
  if (item.source === 'linear-issue' && typeof item.metadata.identifier === 'string') {
    return `${item.metadata.identifier}${author ? ` · ${author}` : ''} · ${age}`;
  }
  return `${SOURCE_LABELS[item.source]} · ${age}`;
}

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

function decisionStatusText(decision: FactoryDecisionSummary): string {
  if (decision.status === 'pending') return `Rule effect pending · ${decision.type}`;
  if (decision.status === 'leased') return `Rule effect dispatching · ${decision.type} · attempt ${decision.attempts}`;
  if (decision.status === 'retry') return `Rule effect retrying · ${decision.type} · attempt ${decision.attempts}`;
  return decision.lastError ? `Rule effect failed: ${decision.lastError}` : `Rule effect failed · ${decision.type}`;
}

function WorkItemCard({
  item,
  columnStage,
  allItems,
  liveWorktreePaths,
  runDisabled,
  evaluatingStage,
  transitionReason,
  decision,
  retryingDecisionId,
  onRetryDecision,
  pendingRunRoles,
  onCreateSession,
  onStartRun,
  onMove,
  onRemove,
}: {
  item: WorkItem;
  columnStage: BoardStageId;
  allItems: WorkItem[];
  /** Worktrees that still exist; session refs outside this set are stale. */
  liveWorktreePaths: ReadonlySet<string>;
  runDisabled: boolean;
  /** Destination stage of an in-flight transition; undefined = not moving. */
  evaluatingStage?: string;
  transitionReason?: string;
  decision?: FactoryDecisionSummary;
  retryingDecisionId?: string;
  onRetryDecision: (decisionId: string) => void;
  pendingRunRoles: ReadonlyMap<string, FactoryRunPhase | undefined>;
  /** Title click when the card has no live session: open an empty session (no run). */
  onCreateSession: (spec: { branch: string; threadTitle: string }) => void;
  onStartRun: (spec: ItemRunSpec, action: RunAction) => void;
  onMove: (toStage: string) => void;
  onRemove: () => void;
}) {
  const { factoryId = '' } = useParams<{ factoryId: string }>();
  const { icon: Icon, className: iconClassName } = SOURCE_ICONS[item.source] ?? {
    icon: CircleDot,
    className: 'text-icon3',
  };
  const evaluating = evaluatingStage !== undefined;
  const runPending = pendingRunRoles.size > 0;
  const otherStages = item.stages.filter(stage => stage !== columnStage);
  const runSpec = itemRunSpec(item);
  // Session refs whose worktree was deleted are stale: their threads went with
  // the worktree, so they don't render links and don't block re-running.
  const liveSessions = Object.fromEntries(
    Object.entries(item.sessions).filter(([, session]) => liveWorktreePaths.has(session.sessionId)),
  );
  // Offer only runs whose session slot hasn't been used yet on this card.
  const runActions = runSpec === null ? [] : runSpec.actions.filter(action => !(action.role in liveSessions));
  const threadSession = itemThreadSession(liveSessions);
  const relatedItems = relatedWorkItems(item, allItems);
  const labels = metadataLabels(item.metadata);

  return (
    <article
      draggable={!evaluating}
      aria-label={item.title}
      aria-busy={evaluating || runPending || undefined}
      data-testid="work-item-card"
      data-related={relatedItems.length > 0 ? 'true' : undefined}
      onDragStart={event => {
        if (!evaluating) setDragPayload(event, { kind: 'work-item', id: item.id, fromStage: columnStage });
      }}
      className={cn(
        'group relative flex flex-col gap-3 rounded-xl border border-border1/50 bg-neutral6/5 p-3 outline-none transition-colors hover:bg-surface3',
        evaluating ? 'cursor-wait' : 'cursor-grab active:cursor-grabbing',
        runPending && 'opacity-70',
      )}
    >
      {threadSession !== null ? (
        <Link
          to={`/factories/${factoryId}/workspaces/${threadSession.sessionId}/threads/${threadSession.threadId}`}
          draggable={false}
          aria-label={`Open thread for ${item.title}`}
          className="absolute inset-0 z-10 cursor-pointer rounded-xl outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent1"
        />
      ) : (
        <button
          type="button"
          draggable={false}
          disabled={runDisabled}
          aria-busy={pendingRunRoles.size > 0 || undefined}
          aria-label={`Create thread for ${item.title}`}
          className="absolute inset-0 z-10 cursor-pointer rounded-xl outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent1 disabled:cursor-not-allowed"
          onClick={() => onCreateSession(itemSessionSpec(item))}
        />
      )}
      <div className="absolute top-2 right-2 z-20">
        <DropdownMenu>
          <DropdownMenu.Trigger
            render={
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                disabled={evaluating}
                aria-label={`Actions for ${item.title}`}
              >
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
                    {actionIcon(action.label)}
                    <span>{starting ? 'Starting…' : action.label}</span>
                  </DropdownMenu.Item>
                );
              })}
            {columnStage === 'intake' &&
              item.url !== null &&
              (item.source === 'github-issue' || item.source === 'linear-issue') && (
                <DropdownMenu.Item render={<a href={item.url} target="_blank" rel="noreferrer" />}>
                  <ArrowUpRight aria-hidden />
                  <span>{externalLinkLabel(item.source)}</span>
                </DropdownMenu.Item>
              )}
            {itemStageOptions(item)
              .filter(stage => stage.id !== columnStage)
              .map(stage => (
                <DropdownMenu.Item key={stage.id} onClick={() => onMove(stage.id)}>
                  <BoardStageIcon stage={stage.id} />
                  <span>{stage.id === 'done' ? 'Mark done' : `Move to ${stage.label}`}</span>
                </DropdownMenu.Item>
              ))}
            <DropdownMenu.Item onClick={onRemove}>
              <Trash2 aria-hidden />
              <span>Remove</span>
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu>
      </div>
      <div className="flex min-w-0 flex-col gap-1.5">
        <span className="truncate pr-8 text-ui-xs text-icon2">{workItemMeta(item)}</span>
        <div className="flex min-w-0 items-center gap-1.5">
          <Icon size={16} className={cn('shrink-0', iconClassName)} aria-hidden />
          <span className="min-w-0 flex-1 truncate text-ui-smd font-semibold text-icon6">
            <SourceTitle source={item.source} title={item.title} />
          </span>
        </div>
      </div>
      <CardLabels labels={labels} />
      {relatedItems.map(related => {
        const relationText = relationshipLabel(related);
        const relatedLiveSessions = Object.fromEntries(
          Object.entries(related.sessions).filter(([, session]) => liveWorktreePaths.has(session.sessionId)),
        );
        const relatedSession = itemThreadSession(relatedLiveSessions);
        return (
          <Link
            key={related.id}
            to={
              relatedSession
                ? `/factories/${factoryId}/workspaces/${relatedSession.sessionId}/threads/${relatedSession.threadId}`
                : relationshipPath(related, factoryId)
            }
            className="relative z-20 flex items-center gap-1 text-ui-xs text-icon4 hover:text-icon6 hover:underline"
            aria-label={`Open ${relationText}`}
          >
            <Link2 size={11} aria-hidden />
            <span className="truncate">{relationText}</span>
          </Link>
        );
      })}
      {otherStages.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          {otherStages.map(stage => (
            <span key={stage} className="rounded-full border border-border1 px-2 py-0.5 text-ui-xs text-icon4">
              {itemStageLabel(item, stage)}
            </span>
          ))}
        </div>
      )}
      {evaluatingStage !== undefined && (
        <span role="status" aria-live="polite" className="flex items-center gap-1.5 text-ui-xs text-icon4">
          <Spinner size="sm" aria-hidden className="size-3" />
          {evaluatingStage === 'done' ? 'Marking done…' : `Moving to ${itemStageLabel(item, evaluatingStage)}…`}
        </span>
      )}
      {[...pendingRunRoles].map(([role, phase]) => (
        <span key={role} role="status" aria-live="polite" className="flex items-center gap-1.5 text-ui-xs text-icon4">
          <Spinner size="sm" aria-hidden className="size-3" />
          {runSpec?.actions.find(action => action.role === role)?.label ?? 'Starting run'} —{' '}
          {phase !== undefined ? RUN_PHASE_LABELS[phase] : 'starting…'}
        </span>
      ))}
      {!evaluating && decision !== undefined && (
        <div className="flex items-center justify-between gap-2">
          <span
            role={decision.status === 'failed' ? 'alert' : 'status'}
            className={cn('text-ui-xs', decision.status === 'failed' ? 'text-error' : 'text-icon4')}
          >
            {decisionStatusText(decision)}
          </span>
          {decision.status === 'failed' ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="relative z-20"
              disabled={retryingDecisionId === decision.id}
              onClick={() => onRetryDecision(decision.id)}
            >
              {retryingDecisionId === decision.id ? 'Retrying…' : 'Retry'}
            </Button>
          ) : null}
        </div>
      )}
      {!evaluating && transitionReason !== undefined && (
        <span role="alert" className="text-ui-xs text-error">
          {transitionReason}
        </span>
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
  pendingRunRoles: ReadonlyMap<string, FactoryRunPhase | undefined>;
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
      className="group flex cursor-grab flex-col gap-3 rounded-xl border border-border1/50 bg-neutral6/5 p-3 outline-none transition-colors hover:bg-surface3 active:cursor-grabbing"
    >
      <div className="flex min-w-0 flex-col gap-1.5">
        <span className="block truncate text-ui-xs text-icon2">{candidate.meta}</span>
        <div className="flex min-w-0 items-center gap-1.5">
          <Icon size={16} className={cn('shrink-0', candidate.iconClassName)} aria-hidden />
          <button
            type="button"
            disabled={disabled}
            aria-busy={pendingRunRoles.has(defaultAction.role) || undefined}
            onClick={onOpenSession}
            className="min-w-0 flex-1 truncate text-left text-ui-smd font-semibold text-icon6 hover:underline disabled:opacity-60"
          >
            <SourceTitle source={candidate.source} title={candidate.title} />
          </button>
          <a
            href={candidate.url}
            target="_blank"
            rel="noreferrer"
            aria-label={externalLinkLabel(candidate.source)}
            className="shrink-0 text-icon3 transition-[opacity,translate] hover:text-icon5 focus-visible:translate-x-0 focus-visible:translate-y-0 focus-visible:opacity-100 pointer-fine:-translate-x-1 pointer-fine:translate-y-1 pointer-fine:opacity-0 pointer-fine:group-hover:translate-x-0 pointer-fine:group-hover:translate-y-0 pointer-fine:group-hover:opacity-100 motion-reduce:transition-none"
          >
            <ArrowUpRight size={12} aria-hidden />
          </a>
        </div>
      </div>
      <CardLabels labels={labels} />
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
                <Stethoscope aria-hidden />
                <span>{triageStarting ? 'Starting…' : 'Triage issue'}</span>
              </DropdownMenu.Item>
            )}
            <DropdownMenu.Item onClick={onFile}>
              <Plus aria-hidden />
              <span>Add to board</span>
            </DropdownMenu.Item>
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
