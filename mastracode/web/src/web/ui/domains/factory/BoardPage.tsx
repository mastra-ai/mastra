import { Button } from '@mastra/playground-ui/components/Button';
import { DropdownMenu } from '@mastra/playground-ui/components/DropdownMenu';
import { Notice } from '@mastra/playground-ui/components/Notice';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { CircleDot, EllipsisVertical, GitPullRequest, MessageSquare } from 'lucide-react';
import type { ComponentType, DragEvent } from 'react';
import { useMemo, useState } from 'react';

import { useApiConfig } from '../../../../shared/api/config';
import { relativeTime } from '../../../../shared/lib/date';
import { SkeletonRows } from '../../ui';
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
import {
  useDeleteWorkItemMutation,
  useUpdateWorkItemMutation,
  useUpsertWorkItemMutation,
} from '../../../../shared/hooks/useWorkItems';
import { useWorkItemsQuery } from '../../../../shared/hooks/useWorkItems';
import type { GithubIssue, GithubPullRequest } from './services/factory';
import type { LinearIssue } from './services/linear';
import { connectLinear, isLinearReauthError } from './services/linear';
import type { WorkItem, WorkItemSource } from './services/workItems';

// ── Stages ─────────────────────────────────────────────────────────────────

/** Board columns. Stages are plain strings server-side; these are the UI's vocabulary. */
const BOARD_STAGES = [
  { id: 'intake', label: 'Intake' },
  { id: 'triage', label: 'Triage' },
  { id: 'planning', label: 'Planning' },
  { id: 'execute', label: 'Building' },
  { id: 'review', label: 'Review' },
  { id: 'done', label: 'Done' },
] as const;

type BoardStageId = (typeof BOARD_STAGES)[number]['id'];

const AUTO_TRIAGED_LABEL = 'auto-triaged';
const NEEDS_APPROVAL_LABEL = 'needs-approval';

function hasLabel(labels: readonly string[], label: string): boolean {
  return labels.some(item => item.toLowerCase() === label);
}

function metadataLabels(metadata: Record<string, unknown>): string[] {
  return Array.isArray(metadata.labels)
    ? metadata.labels.filter((label): label is string => typeof label === 'string')
    : [];
}

function issueTriageThreadTags(issueNumber: number): Record<string, string> {
  return { role: 'triage', source: 'github-issue', purpose: 'issue-triage', issueNumber: String(issueNumber) };
}

function stageLabel(stage: string): string {
  return BOARD_STAGES.find(s => s.id === stage)?.label ?? stage;
}

/**
 * Candidate feeds the Intake swimlane can browse. Only one paginated list is
 * shown at a time; when both are configured a pill switcher inside the column
 * picks the active one.
 */
const INTAKE_SOURCES = [
  { id: 'github', label: 'GitHub' },
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
  /** Column the candidate is offered in: issues in Intake, PRs in Review. */
  column: BoardStageId;
  /** Default one-click run for the candidate. */
  actionLabel: 'Investigate' | 'Prepare approval' | 'Review';
  /** Session slot + stage the default run fills. */
  runRole: 'triage' | 'work' | 'review';
  runStage: BoardStageId;
  branch: string;
  threadTitle: string;
  defaultPrompt: string;
  customPrompt: (instructions: string) => string;
  threadTags?: Record<string, string>;
  metadata: Record<string, unknown>;
  issue?: GithubIssue;
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
    actionLabel: needsApproval ? 'Prepare approval' : 'Investigate',
    runRole: needsApproval ? 'triage' : 'work',
    runStage: needsApproval ? 'triage' : 'execute',
    branch: `factory/issue-${issue.number}`,
    threadTitle: needsApproval ? `Triage #${issue.number}: ${issue.title}` : `Issue #${issue.number}: ${issue.title}`,
    defaultPrompt: needsApproval
      ? `Prepare approval for ${ref}. Review the existing triage comment and summarize the decision needed before implementation or closure.`
      : `Use the understand-issue skill to investigate ${ref}.`,
    customPrompt: instructions => guidedPrompt(needsApproval ? approvalBase : investigateBase, instructions),
    threadTags: needsApproval ? issueTriageThreadTags(issue.number) : undefined,
    metadata: { number: issue.number, author: issue.author, labels },
    issue,
  };
}

function pullRequestCandidate(pr: GithubPullRequest): BoardCandidate {
  const ref = `GitHub pull request #${pr.number} (${pr.url})`;
  const checkout = `Check out the PR in this worktree first with \`gh pr checkout ${pr.number}\`.`;
  const base = `Review ${ref}. ${checkout}`;
  return {
    sourceKey: `github-pr:${pr.number}`,
    source: 'github-pr',
    title: pr.title,
    url: pr.url,
    meta: `#${pr.number}${pr.author ? ` · ${pr.author}` : ''} · ${pr.headBranch} → ${pr.baseBranch}`,
    icon: GitPullRequest,
    iconClassName: 'text-accent1',
    column: 'review',
    actionLabel: 'Review',
    runRole: 'review',
    runStage: 'review',
    branch: `factory/pr-${pr.number}`,
    threadTitle: `PR #${pr.number}: ${pr.title}`,
    defaultPrompt: `Use the understand-pr skill to review ${ref}. ${checkout}`,
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
    actionLabel: 'Investigate',
    runRole: 'work',
    runStage: 'execute',
    branch: `factory/linear-${issue.identifier.toLowerCase()}`,
    threadTitle: `${issue.identifier}: ${issue.title}`,
    defaultPrompt: `Use the understand-issue skill to investigate ${ref}. ${fetchHint}`,
    customPrompt: instructions => guidedPrompt(base, instructions),
    metadata: { identifier: issue.identifier, state: issue.state, assignee: issue.assignee },
  };
}

// ── Runs on persisted items ─────────────────────────────────────────────────

interface ItemRunSpec {
  actionLabel: 'Start work' | 'Start review' | 'Investigate' | 'Prepare approval';
  role: 'triage' | 'work' | 'review';
  stages: string[];
  branch: string;
  threadTitle: string;
  prompt: string;
  threadTags?: Record<string, string>;
}

/**
 * The run a persisted card can start, derived from its source + metadata.
 * Issues get a work run; PRs get a review run. Manual cards (or cards missing
 * the needed metadata) can't start runs.
 */
function itemRunSpec(item: WorkItem): ItemRunSpec | null {
  const meta = item.metadata;
  if (item.source === 'github-issue' && typeof meta.number === 'number') {
    const labels = metadataLabels(meta);
    const needsApproval = hasLabel(labels, NEEDS_APPROVAL_LABEL);
    const ref = `GitHub issue #${meta.number}${item.url ? ` (${item.url})` : ''}`;
    return {
      actionLabel: needsApproval ? 'Prepare approval' : 'Investigate',
      role: needsApproval ? 'triage' : 'work',
      stages: stagesAfterRunStart(item.stages, needsApproval ? 'triage' : 'execute'),
      branch: `factory/issue-${meta.number}`,
      threadTitle: needsApproval ? `Triage #${meta.number}: ${item.title}` : `Issue #${meta.number}: ${item.title}`,
      prompt: needsApproval
        ? `Prepare approval for ${ref}. Review the existing triage comment and summarize the decision needed before implementation or closure.`
        : `Use the understand-issue skill to investigate ${ref}.`,
      threadTags: needsApproval ? issueTriageThreadTags(meta.number) : undefined,
    };
  }
  if (item.source === 'linear-issue' && typeof meta.identifier === 'string') {
    const ref = `Linear issue ${meta.identifier}${item.url ? ` (${item.url})` : ''}`;
    return {
      actionLabel: 'Start work',
      role: 'work',
      stages: stagesAfterRunStart(item.stages, 'execute'),
      branch: `factory/linear-${meta.identifier.toLowerCase()}`,
      threadTitle: `${meta.identifier}: ${item.title}`,
      prompt: `Use the understand-issue skill to investigate ${ref}. Start by fetching the issue's full details (description and comments) with the linear_get_issue tool.`,
    };
  }
  if (item.source === 'github-pr' && typeof meta.number === 'number' && typeof meta.headBranch === 'string') {
    const ref = `GitHub pull request #${meta.number}${item.url ? ` (${item.url})` : ''}`;
    return {
      actionLabel: 'Start review',
      role: 'review',
      stages: stagesAfterRunStart(item.stages, 'review'),
      branch: `factory/pr-${meta.number}`,
      threadTitle: `PR #${meta.number}: ${item.title}`,
      prompt: `Use the understand-pr skill to review ${ref}. Check out the PR in this worktree first with \`gh pr checkout ${meta.number}\`.`,
    };
  }
  return null;
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
 * Factory › Board: an org-wide kanban over the project's work items. The
 * Intake column merges persisted `intake` cards with live GitHub/Linear
 * candidates (issues/PRs that have no record yet — records are materialized
 * only when someone acts on them). Cards move between columns by drag-and-drop
 * or the card menu; moves only file/move cards, never start agent runs.
 */
export function BoardPage() {
  return (
    <FactoryPageShell
      title="Board"
      description="Issues and pull requests across intake, work, review, and done."
      maxWidthClassName="max-w-7xl"
    >
      {project => <Board githubProjectId={project.githubProjectId} />}
    </FactoryPageShell>
  );
}

function Board({ githubProjectId }: { githubProjectId: string }) {
  const items = useWorkItemsQuery(githubProjectId);
  const configQuery = useIntakeConfigQuery();
  const linearStatusQuery = useLinearStatusQuery();

  // Intake sources mirror the old Intake page gating: nothing is synced until
  // it's picked in Settings › General. PRs always feed the board.
  const config = configQuery.data;
  const githubEnabled = config?.github.enabled ?? true;
  const githubSelected = config ? (config.github.projectIds?.includes(githubProjectId) ?? false) : true;
  const linearFeature = linearStatusQuery.data?.enabled ?? false;
  const linearConnected = Boolean(linearFeature && linearStatusQuery.data?.connected);
  const linearReady =
    (config?.linear.enabled ?? false) && linearConnected && (config?.linear.projectIds?.length ?? 0) > 0;

  // The Intake swimlane browses one candidate feed at a time; a pill switcher
  // inside the column picks between GitHub and Linear when both are set up.
  const githubIntakeActive = githubEnabled && githubSelected;
  const [intakeSource, setIntakeSource] = useState<IntakeSource>('github');
  const showIntakeSourceSwitch = githubIntakeActive && linearReady;
  const activeIntakeSource: IntakeSource | null = showIntakeSourceSwitch
    ? intakeSource
    : githubIntakeActive
      ? 'github'
      : linearReady
        ? 'linear'
        : null;

  // Only the active intake feed fetches; the other feed loads on switch.
  const issues = useProjectIssuesQuery(activeIntakeSource === 'github' ? githubProjectId : undefined);
  const triageIssues = useProjectIssuesQuery(githubProjectId, AUTO_TRIAGED_LABEL);
  const pulls = useProjectPullRequestsQuery(githubProjectId);
  const linearIssues = useLinearIssuesQuery(activeIntakeSource === 'linear');

  const upsert = useUpsertWorkItemMutation(githubProjectId);
  const update = useUpdateWorkItemMutation(githubProjectId);
  const remove = useDeleteWorkItemMutation(githubProjectId);
  const { start, enabled: runEnabled } = useStartFactoryRun();
  const triage = useStartIssueTriageMutation(githubProjectId);

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
      ...(pulls.data ?? []).map(pullRequestCandidate),
      ...(activeIntakeSource === 'linear' ? (linearIssues.data ?? []).map(linearCandidate) : []),
    ];
    return all.filter(candidate => !known.has(candidate.sourceKey));
  }, [workItems, issues.data, triageIssues.data, pulls.data, linearIssues.data, activeIntakeSource]);

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

  const mutationError = [start, triage, upsert, update, remove].find(m => m.isError)?.error;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      {mutationError !== undefined && (
        <Notice variant="destructive">
          {mutationError instanceof Error ? mutationError.message : 'Board action failed'}
        </Notice>
      )}
      <div className="flex min-h-0 flex-1 gap-3 overflow-x-auto pb-2" aria-label="Board columns">
        {BOARD_STAGES.map(stage => (
          <BoardColumn
            key={stage.id}
            stage={stage.id}
            label={stage.label}
            onDrop={handleDrop}
            headerExtras={
              stage.id === 'intake' && showIntakeSourceSwitch ? (
                <div role="group" aria-label="Intake source" className="flex items-center gap-1 pb-1">
                  {INTAKE_SOURCES.map(source => (
                    <button
                      key={source.id}
                      type="button"
                      aria-pressed={intakeSource === source.id}
                      onClick={() => setIntakeSource(source.id)}
                      className={`rounded-full border px-2.5 py-0.5 text-ui-xs transition ${
                        intakeSource === source.id
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
                  runDisabled={!runEnabled || start.isPending}
                  runStarting={start.isPending}
                  onStartRun={spec =>
                    start.mutate({
                      branch: spec.branch,
                      threadTitle: spec.threadTitle,
                      threadTags: spec.threadTags,
                      prompt: spec.prompt,
                      workItem: {
                        id: item.id,
                        role: spec.role,
                        stages: spec.stages,
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
                  starting={
                    (start.isPending && start.variables?.branch === candidate.branch) ||
                    (triage.isPending && triage.variables?.number === candidate.issue?.number)
                  }
                  disabled={!runEnabled || start.isPending || triage.isPending}
                  onRun={prompt =>
                    start.mutate({
                      branch: candidate.branch,
                      threadTitle: candidate.threadTitle,
                      threadTags: candidate.threadTags,
                      prompt: prompt === undefined ? candidate.defaultPrompt : candidate.customPrompt(prompt),
                      workItem: {
                        role: candidate.runRole,
                        stages: [candidate.runStage],
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
              <IntakeColumnExtras source={activeIntakeSource} issues={issues} linearIssues={linearIssues} />
            )}
            {stage.id === 'review' && <ReviewColumnExtras pulls={pulls} />}
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
  onDrop,
  headerExtras,
  children,
}: {
  stage: BoardStageId;
  label: string;
  onDrop: (payload: DragPayload, toStage: BoardStageId) => void;
  /** Pinned below the column title, outside the scrolling card list. */
  headerExtras?: React.ReactNode;
  children: React.ReactNode;
}) {
  const [dragOver, setDragOver] = useState(false);

  return (
    <section
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
      <Txt as="h2" variant="ui-xs" className="m-0 px-1 uppercase tracking-wide text-icon3">
        {label}
      </Txt>
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

function WorkItemCard({
  item,
  columnStage,
  runDisabled,
  runStarting,
  onStartRun,
  onMove,
  onRemove,
}: {
  item: WorkItem;
  columnStage: BoardStageId;
  runDisabled: boolean;
  runStarting: boolean;
  onStartRun: (spec: ItemRunSpec) => void;
  onMove: (toStage: string) => void;
  onRemove: () => void;
}) {
  const { icon: Icon, className: iconClassName } = SOURCE_ICONS[item.source];
  const otherStages = item.stages.filter(stage => stage !== columnStage);
  const runSpec = itemRunSpec(item);
  const showRun = runSpec !== null && !(runSpec.role in item.sessions);

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
        {item.url ? (
          <a
            href={item.url}
            target="_blank"
            rel="noreferrer"
            className="min-w-0 flex-1 truncate text-ui-sm text-icon6 no-underline hover:underline"
          >
            {item.title}
          </a>
        ) : (
          <span className="min-w-0 flex-1 truncate text-ui-sm text-icon6">{item.title}</span>
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
            {showRun && (
              <DropdownMenu.Item disabled={runDisabled} onClick={() => onStartRun(runSpec)}>
                {runStarting ? 'Starting…' : runSpec.actionLabel}
              </DropdownMenu.Item>
            )}
            {BOARD_STAGES.filter(stage => stage.id !== columnStage).map(stage => (
              <DropdownMenu.Item key={stage.id} onClick={() => onMove(stage.id)}>
                {stage.id === 'done' ? 'Mark done' : `Move to ${stage.label}`}
              </DropdownMenu.Item>
            ))}
            <DropdownMenu.Item onClick={onRemove}>Remove</DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu>
      </div>
      {(otherStages.length > 0 || Object.keys(item.sessions).length > 0) && (
        <div className="flex flex-wrap items-center gap-1.5">
          {otherStages.map(stage => (
            <span key={stage} className="rounded-full bg-surface5 px-1.5 py-0.5 text-ui-xs text-icon4">
              {stageLabel(stage)}
            </span>
          ))}
          {Object.entries(item.sessions).map(([role, session]) => (
            <a
              key={role}
              href={`/threads/${session.threadId}`}
              className="flex items-center gap-1 text-ui-xs text-icon3 no-underline hover:text-icon5"
            >
              <MessageSquare size={11} aria-hidden />
              {role} thread
            </a>
          ))}
        </div>
      )}
    </article>
  );
}

function CandidateCard({
  candidate,
  starting,
  disabled,
  onRun,
  onFile,
  onTriage,
}: {
  candidate: BoardCandidate;
  starting: boolean;
  disabled: boolean;
  /** Start the run; `undefined` = default action, string = custom prompt. */
  onRun: (prompt?: string) => void;
  /** File the candidate onto the board without starting a run. */
  onFile: () => void;
  /** Run first-contact issue triage without leaving the board. */
  onTriage?: () => void;
}) {
  const Icon = candidate.icon;
  const labels = metadataLabels(candidate.metadata);
  const showTriage = candidate.source === 'github-issue' && !hasLabel(labels, AUTO_TRIAGED_LABEL) && onTriage;
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
        <a href={candidate.url} target="_blank" rel="noreferrer" className="min-w-0 flex-1 no-underline">
          <span className="block truncate text-ui-sm text-icon6">{candidate.title}</span>
          <span className="block truncate text-ui-xs text-icon3">{candidate.meta}</span>
        </a>
      </div>
      <FactoryItemActions
        actionLabel={candidate.actionLabel}
        itemLabel={candidate.title}
        starting={starting}
        disabled={disabled}
        onAction={() => onRun()}
        onRunPrompt={prompt => onRun(prompt)}
        menuExtras={
          <>
            {showTriage && <DropdownMenu.Item onClick={onTriage}>Triage issue</DropdownMenu.Item>}
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
  linearIssues,
}: {
  source: IntakeSource | null;
  issues: ReturnType<typeof useProjectIssuesQuery>;
  linearIssues: ReturnType<typeof useLinearIssuesQuery>;
}) {
  const { baseUrl } = useApiConfig();
  if (source === null) return null;
  const feed = source === 'github' ? issues : linearIssues;

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

/** Review column tail: loading state and pull-request pagination. */
function ReviewColumnExtras({ pulls }: { pulls: ReturnType<typeof useProjectPullRequestsQuery> }) {
  return (
    <>
      {pulls.isPending && pulls.fetchStatus !== 'idle' && (
        <SkeletonRows label="Loading pull requests" rows={3} rowClassName="h-12 w-full" />
      )}
      <LoadMoreSentinel
        hasNextPage={Boolean(pulls.hasNextPage)}
        isFetchingNextPage={Boolean(pulls.isFetchingNextPage)}
        onLoadMore={() => void pulls.fetchNextPage()}
        label="Load more pull requests"
      />
    </>
  );
}
