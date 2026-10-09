import { Txt } from '@mastra/playground-ui/components/Txt';
import { ChevronRight } from 'lucide-react';
/** One hop in the node trail (A7): the nodes visited via clicks/wikilinks. */
export interface TrailEntry {
  nodeId: string;
  name: string;
  recordId?: string;
}

export function KnowledgeBreadcrumb({
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
    <nav
      aria-label="Knowledge scope"
      className="text-muted-foreground mt-1 flex h-5 items-center gap-1 overflow-hidden whitespace-nowrap"
    >
      <button type="button" className="hover:text-foreground" onClick={onProjectClick}>
        <Txt as="span" variant="caption" className="block">
          org
        </Txt>
      </button>
      <ChevronRight size={11} />
      <button type="button" className="hover:text-foreground" onClick={onProjectClick}>
        <Txt as="span" variant="caption" className="block">
          project
        </Txt>
      </button>
      {threadId ? (
        <>
          <ChevronRight size={11} />
          <Txt as="span" variant="caption" title={threadId} className="text-badge-purple-indicator max-w-52 truncate">
            session {threadId.slice(0, 8)}
          </Txt>
        </>
      ) : null}
      {trail.map((entry, index) => (
        <span key={`${entry.nodeId}-${index}`} className="flex min-w-0 items-center gap-1">
          <ChevronRight size={11} />
          {index === trail.length - 1 ? (
            <Txt as="span" variant="caption" tone="ink" title={entry.name} className="max-w-44 truncate">
              {entry.name}
            </Txt>
          ) : (
            <button
              type="button"
              className="hover:text-foreground max-w-44 truncate"
              title={entry.name}
              onClick={() => onTrailClick(index)}
            >
              <Txt as="span" variant="caption" className="block">
                {entry.name}
              </Txt>
            </button>
          )}
        </span>
      ))}
    </nav>
  );
}
