import { Button } from '@mastra/playground-ui/components/Button';
import { Input } from '@mastra/playground-ui/components/Input';
import { Notice } from '@mastra/playground-ui/components/Notice';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@mastra/playground-ui/components/Select';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { ChevronRight } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';

import {
  useKnowledgeActivity,
  useKnowledgeCurationAction,
  useKnowledgeCurationEvidence,
  useKnowledgeCurationMergeTargets,
  useKnowledgeCurationWorklist,
  useKnowledgeGraph,
  useKnowledgeScopes,
} from '../../hooks/useKnowledgeGraph';
import { SkeletonRows } from '../ui/SkeletonRows';
import { FactoryPageShell } from '../domains/factory/components/FactoryPageShell';
import { KnowledgeGraph } from '../domains/factory/components/knowledge/KnowledgeGraph';
import { KnowledgeFlyout } from '../domains/factory/components/knowledge/KnowledgeFlyout';
import { KnowledgeApprovals } from '../domains/factory/components/knowledge/KnowledgeApprovals';
import { KnowledgeImports } from '../domains/factory/components/knowledge/KnowledgeImports';
import type { Arrivals, DiffBaseline } from '../domains/factory/components/knowledge/graphDiff';
import { computeArrivals } from '../domains/factory/components/knowledge/graphDiff';
import type {
  KnowledgeCurationWorkItem,
  KnowledgeGraphPayload,
  KnowledgeScopeTreePayload,
} from '../domains/factory/services/knowledge';
import { RequestError } from '../domains/factory/services/request';
import { useInteractionIdle } from '../domains/factory/components/knowledge/useInteractionIdle';

/**
 * A live, access-filtered view of the project's knowledge. Selected scope and
 * session state live in search params so views remain linkable and back-button safe.
 */
export function KnowledgePage() {
  return <FactoryPageShell>{project => <KnowledgeContent factoryProjectId={project.id} />}</FactoryPageShell>;
}

/** One hop in the node trail (A7): the nodes visited via clicks/wikilinks. */
export interface TrailEntry {
  nodeId: string;
  name: string;
  recordId?: string;
}

function Breadcrumb({
  threadId,
  trail,
  onProjectClick,
  onTrailClick,
}: {
  threadId?: string;
  trail: TrailEntry[];
  onProjectClick: () => void;
  onTrailClick: (index: number) => void;
}) {
  return (
    <nav aria-label="Knowledge scope" className="text-icon3 mt-1 flex flex-wrap items-center gap-1 text-xs">
      <button type="button" className="hover:text-icon5" onClick={onProjectClick}>
        org
      </button>
      <ChevronRight size={11} />
      <button type="button" className="hover:text-icon5" onClick={onProjectClick}>
        project
      </button>
      {threadId ? (
        <>
          <ChevronRight size={11} />
          <span className="max-w-52 truncate text-purple-300" title={threadId}>
            session {threadId.slice(0, 8)}
          </span>
        </>
      ) : null}
      {trail.map((entry, index) => (
        <span key={`${entry.nodeId}-${index}`} className="flex items-center gap-1">
          <ChevronRight size={11} />
          {index === trail.length - 1 ? (
            <span className="text-icon5 max-w-44 truncate" title={entry.name}>
              {entry.name}
            </span>
          ) : (
            <button
              type="button"
              className="hover:text-icon5 max-w-44 truncate"
              title={entry.name}
              onClick={() => onTrailClick(index)}
            >
              {entry.name}
            </button>
          )}
        </span>
      ))}
    </nav>
  );
}

function CurationItem({
  item,
  factoryProjectId,
  scopeId,
  destinationScopeId,
  threadId,
  onSelectProposal,
}: {
  item: KnowledgeCurationWorkItem;
  factoryProjectId?: string;
  scopeId: string;
  destinationScopeId: string;
  threadId?: string;
  onSelectProposal: (proposalId: string) => void;
}) {
  const action = useKnowledgeCurationAction(factoryProjectId, threadId);
  const [description, setDescription] = useState('');
  const [mergeQuery, setMergeQuery] = useState('');
  const [mergeTargetId, setMergeTargetId] = useState('');
  const [proposalId, setProposalId] = useState('');
  const [retained, setRetained] = useState(false);
  const [loadingMoreEvidence, setLoadingMoreEvidence] = useState(false);
  const mergeTargets = useKnowledgeCurationMergeTargets(factoryProjectId, scopeId, mergeQuery, threadId);
  const mergeTarget = mergeTargets.data?.targets.find(target => target.id === mergeTargetId);
  const evidence = useKnowledgeCurationEvidence(
    factoryProjectId,
    scopeId,
    item.id,
    item.evidenceCursor,
    loadingMoreEvidence,
    threadId,
  );
  const evidenceEntries = [...item.evidence, ...(evidence.data?.pages.flatMap(page => page.evidence) ?? [])];

  return (
    <article className="border-surface5 bg-surface2 flex flex-col gap-2 rounded-lg border border-dashed p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <Txt as="h3" variant="ui-md" className="text-icon6 font-medium">
            {item.name}
          </Txt>
          <Txt as="p" variant="ui-xs" className="text-icon3">
            Version {item.version}
          </Txt>
          {evidenceEntries.length > 0 ? (
            <ul aria-label={`Evidence for ${item.name}`} className="text-icon3 list-disc pl-4 text-xs">
              {evidenceEntries.map((entry, index) => (
                <li key={`${entry.source ?? 'unspecified'}-${index}`}>
                  {entry.source ?? 'unspecified source'}
                  {entry.provenance ? ` · ${entry.provenance}` : ''}
                </li>
              ))}
            </ul>
          ) : null}
          {item.evidenceCursor && !loadingMoreEvidence ? (
            <Button size="xs" variant="ghost" onClick={() => setLoadingMoreEvidence(true)}>
              Load more evidence
            </Button>
          ) : evidence.hasNextPage ? (
            <Button
              size="xs"
              variant="ghost"
              onClick={() => evidence.fetchNextPage()}
              disabled={evidence.isFetchingNextPage}
            >
              Load more evidence
            </Button>
          ) : null}
        </div>
        <span className="rounded bg-yellow-950 px-2 py-0.5 text-xs text-yellow-200">
          {retained ? 'retained · unintegrated' : 'provisional'}
        </span>
      </div>
      {item.description ? (
        <Txt as="p" variant="ui-sm" className="text-icon4">
          {item.description}
        </Txt>
      ) : null}
      <Input
        aria-label={`Refined description for ${item.name}`}
        value={description}
        onChange={event => setDescription(event.target.value)}
        placeholder="Refined description"
      />
      <div className="flex flex-col gap-1">
        <Input
          aria-label={`Find merge target for ${item.name}`}
          value={mergeQuery}
          onChange={event => {
            setMergeQuery(event.target.value);
            setMergeTargetId('');
          }}
          placeholder="Find an authorized merge target"
        />
        {mergeTargets.data?.targets
          .filter(target => target.id !== item.id)
          .map(target => (
            <button
              key={target.id}
              type="button"
              aria-pressed={target.id === mergeTargetId}
              className="border-surface5 hover:bg-surface3 flex items-center justify-between rounded border px-2 py-1 text-left text-xs"
              onClick={() => setMergeTargetId(target.id)}
            >
              <span>{target.name}</span>
              <span className="text-icon3">
                {target.kind} · v{target.version}
              </span>
            </button>
          ))}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          size="xs"
          onClick={() =>
            action.mutate({ action: 'refine', scopeId, nodeId: item.id, version: item.version, description })
          }
          disabled={!description || action.isPending}
        >
          Refine
        </Button>
        <Button
          size="xs"
          onClick={() =>
            action.mutate(
              { action: 'promote', scopeId, nodeId: item.id, version: item.version, destinationScopeId },
              { onSuccess: result => setProposalId(result.proposal?.id ?? '') },
            )
          }
          disabled={action.isPending}
        >
          Promote
        </Button>
        <Button
          size="xs"
          variant="outline"
          onClick={() => {
            if (!mergeTarget) return;
            action.mutate({
              action: 'merge',
              scopeId,
              nodeId: item.id,
              version: item.version,
              targetId: mergeTarget.id,
              targetVersion: mergeTarget.version,
            });
          }}
          disabled={!mergeTarget || action.isPending}
        >
          Merge
        </Button>
        <Button
          size="xs"
          variant="outline"
          onClick={() =>
            action.mutate({ action: 'retain', scopeId, nodeId: item.id }, { onSuccess: () => setRetained(true) })
          }
          disabled={action.isPending}
        >
          Retain
        </Button>
        <Button
          size="xs"
          variant="destructive"
          onClick={() => action.mutate({ action: 'discard', scopeId, nodeId: item.id, version: item.version })}
          disabled={action.isPending}
        >
          Discard
        </Button>
      </div>
      {action.isError ? (
        <Notice variant="destructive">
          {action.error instanceof Error ? action.error.message : 'Curation failed.'}
        </Notice>
      ) : null}
      {proposalId ? (
        <Notice
          variant="info"
          action={
            <Button size="xs" variant="outline" onClick={() => onSelectProposal(proposalId)}>
              Open proposal
            </Button>
          }
        >
          Sent to Approvals for review.
        </Notice>
      ) : null}
    </article>
  );
}

function CurationPanel({
  factoryProjectId,
  scopeId,
  destinationScopeId,
  threadId,
  onSelectProposal,
}: {
  factoryProjectId?: string;
  scopeId: string;
  destinationScopeId: string;
  threadId?: string;
  onSelectProposal: (proposalId: string) => void;
}) {
  const worklist = useKnowledgeCurationWorklist(factoryProjectId, scopeId, threadId);
  if (worklist.isPending) return <SkeletonRows label="Loading curation worklist" rows={4} />;
  if (worklist.isError) {
    return <Notice variant="destructive">The curation worklist is unavailable for this scope.</Notice>;
  }
  const items = worklist.data.pages.flatMap(page => page.items);
  return (
    <div className="flex flex-col gap-3" data-testid="knowledge-curation-worklist">
      <div>
        <Txt as="h2" variant="header-sm" className="text-icon6 font-semibold">
          Needs curation
        </Txt>
        <Txt as="p" variant="ui-sm" className="text-icon3">
          Review provisional knowledge before promoting it.
        </Txt>
      </div>
      {items.length === 0 ? (
        <Txt as="p" variant="ui-md" className="text-icon3">
          No provisional knowledge needs review.
        </Txt>
      ) : null}
      {items.map(item => (
        <CurationItem
          key={item.id}
          item={item}
          factoryProjectId={factoryProjectId}
          scopeId={scopeId}
          destinationScopeId={destinationScopeId}
          threadId={threadId}
          onSelectProposal={onSelectProposal}
        />
      ))}
      {worklist.hasNextPage ? (
        <Button
          variant="outline"
          size="sm"
          onClick={() => worklist.fetchNextPage()}
          disabled={worklist.isFetchingNextPage}
        >
          Load more
        </Button>
      ) : null}
    </div>
  );
}

function ScopeTree({
  tree,
  selectedScopeId,
  onSelectScope,
  onProjectClick,
}: {
  tree: KnowledgeScopeTreePayload | undefined;
  selectedScopeId: string | undefined;
  onSelectScope: (scopeId: string) => void;
  onProjectClick: () => void;
}) {
  const [needsCurationOnly, setNeedsCurationOnly] = useState(false);
  const children = tree?.children.filter(scope => !needsCurationOnly || scope.needsCuration) ?? [];
  return (
    <aside aria-label="Knowledge scopes" className="border-surface5 bg-surface2 w-48 shrink-0 rounded-lg border p-3">
      <Txt as="h2" variant="ui-sm" className="text-icon5 mb-2 font-semibold">
        Scopes
      </Txt>
      <label className="text-icon4 mb-2 flex items-center gap-2 text-xs">
        <input
          type="checkbox"
          checked={needsCurationOnly}
          onChange={event => setNeedsCurationOnly(event.target.checked)}
        />
        Needs curation
      </label>
      <div className="text-icon4 flex flex-col gap-1 text-xs">
        <button type="button" className="hover:text-icon6 text-left" onClick={onProjectClick}>
          Project scope
        </button>
        {tree ? (
          <>
            <button
              type="button"
              aria-current={tree.scope.id === selectedScopeId ? 'page' : undefined}
              className="text-icon6 truncate pl-3 text-left font-medium"
              onClick={() => onSelectScope(tree.scope.id)}
            >
              {tree.scope.name}
            </button>
            {children.map(scope => (
              <button
                key={scope.id}
                type="button"
                className={`hover:text-icon6 truncate pl-6 text-left ${scope.needsCuration ? 'border-icon3 text-icon3 border-l border-dashed italic' : ''}`}
                onClick={() => onSelectScope(scope.id)}
              >
                {scope.name}
              </button>
            ))}
          </>
        ) : null}
      </div>
    </aside>
  );
}

function ImportRunLink({
  importerId,
  runId,
  onOpen,
}: {
  importerId: string;
  runId: string;
  onOpen: (importerId: string, runId: string) => void;
}) {
  return (
    <Button variant="ghost" size="xs" className="ml-1" onClick={() => onOpen(importerId, runId)}>
      {importerId}
    </Button>
  );
}

function ActivityPanel({
  factoryProjectId,
  scopeId,
  threadId,
  onOpenRun,
}: {
  factoryProjectId?: string;
  scopeId?: string;
  threadId?: string;
  onOpenRun: (importerId: string, runId: string) => void;
}) {
  const [action, setAction] = useState('all');
  const [sourceType, setSourceType] = useState('all');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const activity = useKnowledgeActivity(factoryProjectId, scopeId, threadId, {
    action: action === 'all' ? undefined : action,
    sourceType: sourceType === 'importer' || sourceType === 'system' ? sourceType : undefined,
    from: from ? new Date(`${from}T00:00:00`).toISOString() : undefined,
    to: to ? new Date(`${to}T23:59:59.999`).toISOString() : undefined,
  });
  if (activity.isPending) return <SkeletonRows label="Loading knowledge activity" rows={6} />;
  if (activity.isError) {
    const message = activity.error instanceof Error ? activity.error.message : 'Unable to load knowledge activity.';
    return <Notice variant="destructive">{message}</Notice>;
  }
  const events = activity.data.pages.flatMap(page => page.events);
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2" aria-label="Knowledge activity filters">
        <Select value={action} onValueChange={setAction}>
          <SelectTrigger size="sm" aria-label="Activity operation" className="w-36">
            {action === 'all' ? 'All operations' : action}
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All operations</SelectItem>
            {[
              'create',
              'edit',
              'delete',
              'restore',
              'move',
              'merge',
              'promote',
              'demote',
              'stamp',
              'rebind',
              'propose',
              'approve',
              'reject',
              'conflict',
            ].map(value => (
              <SelectItem key={value} value={value}>
                {value}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={sourceType} onValueChange={setSourceType}>
          <SelectTrigger size="sm" aria-label="Activity source" className="w-36">
            {sourceType === 'all' ? 'All sources' : sourceType}
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All sources</SelectItem>
            <SelectItem value="importer">Importer</SelectItem>
            <SelectItem value="system">System</SelectItem>
          </SelectContent>
        </Select>
        <Input
          aria-label="Activity from date"
          type="date"
          value={from}
          onChange={event => setFrom(event.target.value)}
        />
        <Input
          aria-label="Activity through date"
          type="date"
          value={to}
          onChange={event => setTo(event.target.value)}
        />
      </div>
      {events.length === 0 ? (
        <Txt as="p" variant="ui-md" className="text-icon3">
          No knowledge activity matches these filters.
        </Txt>
      ) : (
        <ol aria-label="Knowledge activity" className="divide-surface5 divide-y">
          {events.map(event => (
            <li key={event.id} className="flex items-start justify-between gap-4 py-3 text-sm">
              <div>
                <span className="text-icon5 font-medium">{event.action}</span>
                <span className="text-icon3 ml-2">{event.targetType}</span>
                {event.sourceId && event.importRunId ? (
                  <ImportRunLink importerId={event.sourceId} runId={event.importRunId} onOpen={onOpenRun} />
                ) : (
                  <span className="text-icon3 ml-2">{event.sourceType}</span>
                )}
              </div>
              <time className="text-icon3 shrink-0 text-xs" dateTime={event.createdAt}>
                {new Date(event.createdAt).toLocaleString()}
              </time>
            </li>
          ))}
          {activity.hasNextPage ? (
            <li className="flex justify-center py-2">
              <Button
                variant="ghost"
                size="sm"
                disabled={activity.isFetchingNextPage}
                onClick={() => void activity.fetchNextPage()}
              >
                {activity.isFetchingNextPage ? 'Loading activity…' : 'Load more activity'}
              </Button>
            </li>
          ) : null}
        </ol>
      )}
    </div>
  );
}

function ActiveKnowledgeView({
  view,
  factoryProjectId,
  scopeId,
  threadId,
  importerId,
  runId,
  proposalId,
  onSelectProposal,
  onOpenRun,
  onOpenNode,
  explore,
}: {
  view: 'explore' | 'activity' | 'approvals' | 'imports';
  factoryProjectId?: string;
  scopeId?: string;
  threadId?: string;
  importerId?: string;
  runId?: string;
  proposalId?: string;
  onSelectProposal: (proposalId: string | undefined) => void;
  onOpenRun: (importerId: string, runId: string) => void;
  onOpenNode: (nodeId: string, name: string) => void;
  explore: React.ReactNode;
}) {
  if (view === 'activity') {
    return (
      <ActivityPanel factoryProjectId={factoryProjectId} scopeId={scopeId} threadId={threadId} onOpenRun={onOpenRun} />
    );
  }
  if (view === 'approvals') {
    return factoryProjectId ? (
      <KnowledgeApprovals
        factoryProjectId={factoryProjectId}
        threadId={threadId}
        proposalId={proposalId}
        onSelectProposal={onSelectProposal}
        onOpenNode={onOpenNode}
      />
    ) : null;
  }
  if (view === 'imports') {
    return (
      <KnowledgeImports
        factoryProjectId={factoryProjectId}
        threadId={threadId}
        initialImporterId={importerId}
        initialRunId={runId}
      />
    );
  }
  return explore;
}

function ThreadGone({ onBack }: { onBack: () => void }) {
  return (
    <div data-testid="knowledge-thread-gone" className="flex flex-col items-start gap-2 py-8">
      <Txt as="p" variant="ui-md" className="text-icon4">
        This session's knowledge is no longer available.
      </Txt>
      <button type="button" className="text-sm text-purple-300 hover:underline" onClick={onBack}>
        Back to the project view
      </button>
    </div>
  );
}

function KnowledgeScopeMap({
  lenses,
  omittedScopes,
  onOpen,
}: {
  lenses: KnowledgeGraphPayload[];
  omittedScopes: string[];
  onOpen: (scopeId: string) => void;
}) {
  return (
    <div
      aria-label="Scope map"
      className="bg-surface1 absolute inset-0 z-[5] flex flex-wrap content-start gap-4 overflow-auto p-16"
    >
      {lenses.map(lens => (
        <button
          key={lens.scope.id}
          type="button"
          className="border-surface4 bg-surface2 hover:border-accent1 min-h-40 min-w-64 rounded-[40%] border-2 border-dashed p-6 text-left transition-colors"
          onClick={() => onOpen(lens.scope.id)}
        >
          <Txt as="span" variant="ui-md" className="text-icon6 block font-medium">
            {lens.scope.name}
          </Txt>
          <Txt as="span" variant="ui-xs" className="text-icon3 mt-1 block">
            {lens.nodes.length} visible nodes
          </Txt>
          <span className="mt-4 flex max-w-72 flex-wrap gap-1" aria-label={`${lens.scope.name} members`}>
            {lens.nodes.slice(0, 12).map(node => (
              <span key={node.id} className="bg-surface4 text-icon5 rounded-full px-2 py-1 text-xs">
                {node.name}
              </span>
            ))}
          </span>
        </button>
      ))}
      {omittedScopes.length > 0 ? (
        <Notice variant="info">
          {omittedScopes.length} scope{omittedScopes.length === 1 ? '' : 's'} omitted by canvas bounds; open the lens to
          load it completely.
        </Notice>
      ) : null}
    </div>
  );
}

function KnowledgeContent({ factoryProjectId }: { factoryProjectId: string | undefined }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const threadId = searchParams.get('thread') ?? undefined;
  const requestedScopeId = searchParams.get('scope') ?? undefined;
  const requestedView = searchParams.get('view');
  const activeView =
    requestedView === 'activity' || requestedView === 'approvals' || requestedView === 'imports'
      ? requestedView
      : 'explore';
  const importerId = searchParams.get('importer') ?? undefined;
  const runId = searchParams.get('run') ?? undefined;
  const proposalId = searchParams.get('proposal') ?? undefined;
  // The node trail (A7): the flyout shows the LAST entry; earlier entries
  // are clickable breadcrumbs back through the hops.
  const [trail, setTrail] = useState<TrailEntry[]>([]);
  const [visitedLenses, setVisitedLenses] = useState<KnowledgeGraphPayload[]>([]);
  const [omittedScopes, setOmittedScopes] = useState<Array<{ id: string; name: string }>>([]);
  const [canvasMode, setCanvasMode] = useState<'lens' | 'map'>('lens');
  const selected = trail.at(-1) ?? null;
  const setSelected = (entry: TrailEntry | null) => setTrail(entry ? [entry] : []);

  // Live updates hold while the user is exploring (moving, clicking,
  // zooming) and resume after 10s of stillness — the layout never shifts
  // under someone mid-interaction.
  const { idle, onActivity } = useInteractionIdle(10_000);
  const scopeQuery = useKnowledgeScopes(factoryProjectId, requestedScopeId, threadId);
  const selectedScopeId = requestedScopeId;
  const scopeTree = scopeQuery.data;
  const selectedCurationScope =
    scopeTree && scopeTree.scope.id === selectedScopeId && scopeTree.scope.needsCuration
      ? scopeTree.scope
      : scopeTree?.children.find(scope => scope.id === selectedScopeId && scope.needsCuration);
  const graphQuery = useKnowledgeGraph(factoryProjectId, selectedScopeId, threadId, { paused: !idle });
  const graph = graphQuery.data;

  // Arrival diffing: baseline per view; a view switch resets it (no mass
  // arrival animation on switch), same-view polls diff by id sets.
  const baseline = useRef<DiffBaseline | null>(null);
  const nextBaseline: DiffBaseline | undefined = graph
    ? {
        viewKey: `${threadId ? `thread:${threadId}` : 'project'}:scope:${selectedScopeId ?? 'pending'}`,
        version: graph.version ?? null,
        nodeIds: new Set(graph.nodes.map(node => node.id)),
        edgeIds: new Set(graph.edges.map(edge => edge.id)),
      }
    : undefined;
  const arrivals: Arrivals | undefined = nextBaseline ? computeArrivals(baseline.current, nextBaseline) : undefined;
  // Advance the baseline in an effect so a StrictMode double render or a
  // discarded concurrent render never diffs a payload against itself.
  useEffect(() => {
    if (nextBaseline) baseline.current = nextBaseline;
  }, [nextBaseline]);

  const backToProject = () => {
    setSelected(null);
    setCanvasMode('lens');
    setSearchParams(params => {
      const copy = new URLSearchParams(params);
      copy.delete('thread');
      copy.delete('scope');
      return copy;
    });
  };
  const selectScope = (scopeId: string) => {
    setSelected(null);
    setCanvasMode('lens');
    if (graph && graph.scope.id !== scopeId) {
      if (graph.page.truncated || graph.page.terminalBounds.length > 0) {
        setOmittedScopes(scopes =>
          scopes.some(scope => scope.id === graph.scope.id)
            ? scopes
            : [...scopes, { id: graph.scope.id, name: graph.scope.name }],
        );
      } else {
        setVisitedLenses(lenses => [...lenses.filter(lens => lens.scope.id !== graph.scope.id), graph]);
      }
    }
    setSearchParams(params => {
      const copy = new URLSearchParams(params);
      copy.set('scope', scopeId);
      return copy;
    });
  };
  const completeLenses = new Map(visitedLenses.map(lens => [lens.scope.id, lens]));
  const graphIsBounded = Boolean(graph && (graph.page.truncated || graph.page.terminalBounds.length > 0));
  if (graph && !graphIsBounded) completeLenses.set(graph.scope.id, graph);
  const incompleteScopes = new Map(omittedScopes.map(scope => [scope.id, scope.name]));
  if (graph && graphIsBounded) incompleteScopes.set(graph.scope.id, graph.scope.name);
  for (const scopeId of completeLenses.keys()) incompleteScopes.delete(scopeId);

  let body: React.ReactNode;
  if (scopeQuery.isError) {
    if (threadId && scopeQuery.error instanceof RequestError && scopeQuery.error.status === 404) {
      body = <ThreadGone onBack={backToProject} />;
    } else {
      const message = scopeQuery.error instanceof Error ? scopeQuery.error.message : 'Unable to load knowledge scopes.';
      body = <Notice variant="destructive">{message}</Notice>;
    }
  } else if (!selectedScopeId) {
    body = (
      <div className="border-surface4 bg-surface2 flex min-h-80 items-center justify-center rounded-lg border">
        <Txt as="p" variant="ui-md" className="text-icon3 max-w-80 text-center">
          Select a scope to open its bounded knowledge lens.
        </Txt>
      </div>
    );
  } else if (graphQuery.isError) {
    if (threadId && graphQuery.error instanceof RequestError && graphQuery.error.status === 404) {
      // Stale deep link or a session whose knowledge was since deleted —
      // calm state with a way back, never an error toast.
      body = <ThreadGone onBack={backToProject} />;
    } else {
      const message =
        graphQuery.error instanceof Error ? graphQuery.error.message : 'Unable to load the knowledge graph.';
      body = <Notice variant="destructive">{message}</Notice>;
    }
  } else if (graphQuery.isPending || !graph) {
    body = <SkeletonRows label="Loading knowledge graph" rows={6} />;
  } else if (graph.nodes.length === 0) {
    body = (
      <Txt as="p" variant="ui-md" className="text-icon3">
        No knowledge captured yet — the graph fills in as factory sessions work.
      </Txt>
    );
  } else {
    body = (
      <div
        className="relative min-h-0 flex-1"
        data-testid="knowledge-graph-container"
        onPointerDownCapture={onActivity}
        onPointerMoveCapture={onActivity}
        onWheelCapture={onActivity}
      >
        <div
          data-testid="knowledge-scope-overlay"
          className="border-surface4 bg-surface2/90 absolute top-3 left-3 z-10 flex max-w-[calc(100%-1.5rem)] flex-wrap items-center gap-2 rounded-md border px-3 py-2"
        >
          <Txt as="span" variant="ui-xs" className="text-icon4">
            Lens
          </Txt>
          <Txt as="span" variant="ui-sm" className="text-icon6 font-medium">
            {graph.scope.name}
          </Txt>
          {Array.from(
            new Map(
              graph.nodes.flatMap(node =>
                node.boundary ? [[node.boundary.scope.id, node.boundary.scope] as const] : [],
              ),
            ).values(),
          ).map(scope => (
            <Button key={scope.id} variant="ghost" size="xs" onClick={() => selectScope(scope.id)}>
              Open {scope.name}
            </Button>
          ))}
          <Button variant="outline" size="xs" onClick={() => setCanvasMode(mode => (mode === 'lens' ? 'map' : 'lens'))}>
            {canvasMode === 'lens' ? 'Scope map' : 'Return to lens'}
          </Button>
        </div>
        {canvasMode === 'map' ? (
          <KnowledgeScopeMap
            lenses={[...completeLenses.values()]}
            omittedScopes={[...incompleteScopes.values()]}
            onOpen={selectScope}
          />
        ) : (
          <KnowledgeGraph
            payload={graph}
            arrivals={arrivals}
            focusedId={selected?.nodeId ?? null}
            focusedRecordId={selected?.recordId ?? null}
            onFocusChange={id => {
              // A graph click starts a fresh trail; a pane click clears it.
              if (!id) return setTrail([]);
              const node = graph?.nodes.find(entry => entry.id === id);
              setTrail([{ nodeId: id, name: node?.name ?? id }]);
            }}
            onNodeClick={node => {
              if (node.boundary) {
                setTrail([]);
                selectScope(node.boundary.scope.id);
                return;
              }
              setSelected({ nodeId: node.id, name: node.name });
            }}
            onEdgeClick={edge => {
              // Selecting an edge selects AND expands the supporting knowledge record (A7).
              const node = graph?.nodes.find(entry => entry.id === edge.source);
              setSelected({ nodeId: edge.source, name: node?.name ?? edge.source, recordId: edge.recordId });
            }}
          />
        )}
        {graphQuery.hasNextPage ? (
          <div className="absolute bottom-3 left-1/2 z-10 -translate-x-1/2">
            <Button
              variant="outline"
              size="sm"
              disabled={graphQuery.isFetchingNextPage}
              onClick={() => void graphQuery.fetchNextPage()}
            >
              {graphQuery.isFetchingNextPage ? 'Loading lens…' : 'Load more in this lens'}
            </Button>
          </div>
        ) : null}
        {selected && factoryProjectId && selectedScopeId ? (
          <KnowledgeFlyout
            factoryProjectId={factoryProjectId}
            nodeId={selected.nodeId}
            scopeId={selectedScopeId}
            threadId={threadId}
            focusRecordId={selected.recordId}
            onSelectRecord={recordId =>
              // Bidirectional selection: expanding a card selects the knowledge record
              // page-wide, so the graph lights its marker/edge up too.
              setTrail(current =>
                current.length === 0
                  ? current
                  : [...current.slice(0, -1), { ...current[current.length - 1]!, recordId: recordId ?? undefined }],
              )
            }
            onClose={() => setTrail([])}
            onNodeRef={name => {
              // A clicked [[wikilink]] gets the full node-click treatment (A7):
              // ego focus + cluster zoom + flyout swap, PUSHED onto the trail.
              const target = graph?.nodes.find(node => node.name.toLowerCase() === name.toLowerCase());
              if (target && target.id !== selected.nodeId)
                setTrail(current => [...current, { nodeId: target.id, name: target.name }]);
            }}
          />
        ) : null}
      </div>
    );
  }

  const setView = (view: 'explore' | 'activity' | 'approvals' | 'imports') => {
    setSearchParams(params => {
      const copy = new URLSearchParams(params);
      if (view === 'explore') copy.delete('view');
      else copy.set('view', view);
      copy.delete('importer');
      copy.delete('run');
      if (view !== 'approvals') copy.delete('proposal');
      return copy;
    });
  };
  const openImportRun = (selectedImporterId: string, selectedRunId: string) => {
    setSearchParams(params => {
      const copy = new URLSearchParams(params);
      copy.set('view', 'imports');
      copy.set('importer', selectedImporterId);
      copy.set('run', selectedRunId);
      return copy;
    });
  };
  const selectProposal = (selectedProposalId: string | undefined) => {
    setSearchParams(params => {
      const copy = new URLSearchParams(params);
      copy.set('view', 'approvals');
      if (selectedProposalId) copy.set('proposal', selectedProposalId);
      else copy.delete('proposal');
      return copy;
    });
  };

  return (
    <section className="flex min-h-0 flex-1 flex-col gap-4 pt-2" aria-label="Knowledge graph">
      <header className="shrink-0">
        <Txt as="h1" variant="header-md" className="text-icon6 font-semibold">
          Knowledge
        </Txt>
        <Txt as="p" variant="ui-md" className="text-icon3 mt-1">
          Explore captured knowledge and review how it changes over time.
        </Txt>
        <div className="mt-3 flex gap-1" role="tablist" aria-label="Knowledge views">
          {(['explore', 'activity', 'approvals', 'imports'] as const).map(view => (
            <button
              key={view}
              type="button"
              role="tab"
              aria-selected={activeView === view}
              className={`rounded-md px-3 py-1.5 text-sm capitalize ${
                activeView === view ? 'bg-surface4 text-icon6' : 'text-icon3 hover:text-icon5'
              }`}
              onClick={() => setView(view)}
            >
              {view}
            </button>
          ))}
        </div>
        <Breadcrumb
          threadId={threadId}
          trail={trail}
          onProjectClick={backToProject}
          onTrailClick={index => setTrail(current => current.slice(0, index + 1))}
        />
      </header>
      <div className="flex min-h-0 flex-1 gap-4">
        <ScopeTree
          tree={scopeQuery.data}
          selectedScopeId={selectedScopeId}
          onSelectScope={selectScope}
          onProjectClick={backToProject}
        />
        <div className="min-w-0 flex-1">
          <ActiveKnowledgeView
            view={activeView}
            factoryProjectId={factoryProjectId}
            scopeId={selectedScopeId}
            threadId={threadId}
            importerId={importerId}
            runId={runId}
            proposalId={proposalId}
            onSelectProposal={selectProposal}
            onOpenRun={openImportRun}
            onOpenNode={(nodeId, name) => {
              setTrail([{ nodeId, name }]);
              setView('explore');
            }}
            explore={
              selectedCurationScope && scopeQuery.data ? (
                <CurationPanel
                  factoryProjectId={factoryProjectId}
                  scopeId={selectedCurationScope.id}
                  destinationScopeId={scopeQuery.data.curationDestination?.id ?? scopeQuery.data.scope.id}
                  threadId={threadId}
                  onSelectProposal={selectProposal}
                />
              ) : (
                body
              )
            }
          />
        </div>
      </div>
    </section>
  );
}
