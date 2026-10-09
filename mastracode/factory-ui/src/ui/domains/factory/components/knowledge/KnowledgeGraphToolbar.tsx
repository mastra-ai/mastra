import { Txt } from '@mastra/playground-ui/components/Txt';
import { overlaySurfaceStyle } from '@mastra/playground-ui/primitives/raised-surface';
import { cn } from '@mastra/playground-ui/utils/cn';
import { Boxes, Globe, Pin } from 'lucide-react';
import type { ReactNode } from 'react';
import type { KnowledgeGraphNode, KnowledgeGraphPayload, KnowledgeRung } from '../../services/knowledge';
import type { KnowledgeGraphFilters } from './graphModel';
import { knowledgeScopes } from './knowledgeScope';
import { KnowledgeNodeSearch } from './KnowledgeNodeSearch';
import { getVisibleKnowledgeIds } from './knowledgeScene';

const RUNG_LABELS: Record<KnowledgeRung, string> = { org: 'Org', resource: 'Project', thread: 'Session' };

function FilterChip({
  label,
  active,
  onClick,
  activeClassName,
  icon,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  activeClassName: string;
  icon: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        'flex items-center gap-1.5 rounded-full border px-2.5 py-1 transition-colors duration-fast motion-reduce:transition-none',
        active ? activeClassName : 'border-border bg-card text-muted-foreground hover:text-foreground',
      )}
    >
      {icon}
      <Txt as="span" variant="caption">
        {label}
      </Txt>
    </button>
  );
}

export function KnowledgeGraphToolbar({
  payload,
  filters,
  onFiltersChange,
  onSelect,
  children,
}: {
  payload: KnowledgeGraphPayload;
  filters: KnowledgeGraphFilters;
  onFiltersChange: (filters: KnowledgeGraphFilters) => void;
  onSelect: (node: KnowledgeGraphNode) => void;
  children?: ReactNode;
}) {
  const nodes = payload.nodes;
  const present = new Set(nodes.map(node => node.rung));
  const rungs = (['org', 'resource', 'thread'] as const).filter(rung => present.has(rung));
  const visibleIds = getVisibleKnowledgeIds(payload, filters);
  const searchNodes = nodes.filter(node => visibleIds.has(node.id));

  function toggleRung(rung: KnowledgeRung) {
    const rungs = new Set(filters.rungs);
    if (rungs.has(rung)) rungs.delete(rung);
    else rungs.add(rung);
    onFiltersChange({ ...filters, rungs });
  }

  return (
    <div className={cn(overlaySurfaceStyle, 'absolute top-4 left-4 z-10 w-80 max-w-[calc(100%-2rem)] rounded-xl p-3')}>
      <div className="mb-3">
        <div className="flex items-center justify-between gap-2">
          <Txt as="h1" variant="subheading" tone="ink">
            Knowledge Graph
          </Txt>
          <Txt as="span" variant="caption" tone="muted" className="shrink-0 tabular-nums">
            {nodes.length} nodes
          </Txt>
        </div>
        {children}
      </div>
      <KnowledgeNodeSearch nodes={searchNodes} onSelect={onSelect} />
      <div className="mt-3 flex flex-wrap items-center gap-1.5" aria-label="Filter knowledge">
        {rungs.map(rung => (
          <FilterChip
            key={rung}
            label={RUNG_LABELS[rung]}
            activeClassName={knowledgeScopes[rung].filterClass}
            icon={rung === 'org' ? <Globe size={13} /> : <Boxes size={13} />}
            active={filters.rungs.size === 0 || filters.rungs.has(rung)}
            onClick={() => toggleRung(rung)}
          />
        ))}
        <FilterChip
          label="Pinned"
          activeClassName="border-badge-amber-edge bg-badge-amber-strong text-badge-amber-foreground"
          icon={<Pin size={13} />}
          active={filters.pinnedOnly}
          onClick={() => onFiltersChange({ ...filters, pinnedOnly: !filters.pinnedOnly })}
        />
      </div>
    </div>
  );
}
