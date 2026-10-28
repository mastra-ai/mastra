import type { KnowledgeScopeSetSummary } from '@mastra/client-js';
import { cn } from '@mastra/playground-ui/utils/cn';

/** The server caps a view at eight tags, so a union wider than that cannot be browsed in one view. */
const MAX_VIEW_TAGS = 8;

interface ScopeEntry {
  key: string;
  label: string;
  detail: string;
  scope: string[];
  nodeCount: number;
}

const sameTags = (a: string[], b: string[]) => a.length === b.length && a.every(tag => b.includes(tag));
const within = (set: string[], view: string[]) => set.every(tag => view.includes(tag));

/** Nodes a view sees: every stored set whose tags all sit inside the view. */
const visibleNodes = (view: string[], sets: KnowledgeScopeSetSummary[]) =>
  sets.filter(set => within(set.scope, view)).reduce((total, set) => total + set.nodeCount, 0);

function buildEntries(sets: KnowledgeScopeSetSummary[]): ScopeEntry[] {
  // A set inside every other set is the shared base the rest extend; label the others by what they add.
  const base = sets.find(candidate => sets.every(set => within(candidate.scope, set.scope)));
  const entries: ScopeEntry[] = sets.map(set => {
    const extra = base && set !== base ? set.scope.filter(tag => !base.scope.includes(tag)) : [];
    return {
      key: set.scope.join(' '),
      label: set === base ? 'Base' : extra.length > 0 ? extra.join(' ') : set.scope.join(' '),
      detail: set.scope.join(' '),
      scope: set.scope,
      nodeCount: visibleNodes(set.scope, sets),
    };
  });
  const union = [...new Set(sets.flatMap(set => set.scope))].sort();
  if (sets.length > 2 && union.length <= MAX_VIEW_TAGS && !sets.some(set => sameTags(set.scope, union))) {
    entries.push({
      key: 'union',
      label: 'All scopes',
      detail: union.join(' '),
      scope: union,
      nodeCount: visibleNodes(union, sets),
    });
  }
  return entries;
}

export interface KnowledgeScopeNavigatorProps {
  sets: KnowledgeScopeSetSummary[];
  truncated: boolean;
  current: string[];
  onSelect: (scope: string[]) => void;
}

/** The scope tag sets stored in an instance; choosing one views the graph through exactly those tags. */
export function KnowledgeScopeNavigator({ sets, truncated, current, onSelect }: KnowledgeScopeNavigatorProps) {
  const entries = buildEntries(sets);
  return (
    <nav aria-label="Knowledge scopes" className="flex w-60 shrink-0 flex-col gap-1 overflow-y-auto pr-2">
      <h2 className="px-2 text-caption text-muted-foreground">Scopes</h2>
      <ul className="flex flex-col gap-0.5">
        {entries.map(entry => {
          const active = sameTags(entry.scope, current);
          return (
            <li key={entry.key}>
              <button
                type="button"
                aria-current={active ? 'true' : undefined}
                title={entry.detail}
                onClick={() => onSelect(entry.scope)}
                className={cn(
                  'flex w-full flex-col rounded px-2 py-1.5 text-left',
                  active ? 'bg-fill text-foreground' : 'text-muted-foreground hover:bg-fill hover:text-foreground',
                )}
              >
                <span className="flex w-full items-baseline justify-between gap-2 text-body">
                  <span className="truncate">{entry.label}</span>
                  <span className="shrink-0 text-caption text-muted-foreground">{entry.nodeCount}</span>
                </span>
                <span className="truncate text-caption text-muted-foreground">{entry.detail}</span>
              </button>
            </li>
          );
        })}
      </ul>
      {truncated ? <p className="px-2 text-caption text-muted-foreground">More scopes exist than are listed.</p> : null}
    </nav>
  );
}
