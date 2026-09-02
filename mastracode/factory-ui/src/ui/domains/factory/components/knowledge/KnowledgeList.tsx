import { Txt } from '@mastra/playground-ui/components/Txt';
import { cn } from '@mastra/playground-ui/utils/cn';
import { ChevronRight, Pin } from 'lucide-react';

import type { KnowledgeGraphNode, KnowledgeGraphPayload } from '../../services/knowledge';
import { parseRecordSegments } from './recordText';

/**
 * Tap-friendly reading of the same bounded lens payload the canvas renders:
 * child scopes first, then content nodes; the selected node expands to the
 * records it owns inside the window.
 */
export function KnowledgeList({
  payload,
  rootScopeId,
  selectedNodeId,
  selectedRecordId,
  onNodeClick,
  onRecordClick,
}: {
  payload: KnowledgeGraphPayload;
  /** The structural lens root, which the list is already showing. */
  rootScopeId?: string;
  selectedNodeId?: string;
  selectedRecordId?: string;
  onNodeClick: (node: KnowledgeGraphNode) => void;
  onRecordClick: (node: KnowledgeGraphNode, recordId: string) => void;
}) {
  const byName = (a: KnowledgeGraphNode, b: KnowledgeGraphNode) => a.name.localeCompare(b.name);
  const childScopes = payload.nodes.filter(node => node.isScope && node.id !== rootScopeId).sort(byName);
  const contentNodes = payload.nodes.filter(node => !node.isScope && !node.isBoundary && !node.boundary).sort(byName);

  const row = (node: KnowledgeGraphNode, meta: React.ReactNode) => {
    const selected = node.id === selectedNodeId;
    return (
      <button
        type="button"
        aria-pressed={selected}
        className={cn(
          'flex min-h-11 w-full items-center gap-2 rounded-md px-3 py-2 text-left',
          selected ? 'bg-fill text-foreground' : 'text-foreground hover:bg-fill',
        )}
        onClick={() => onNodeClick(node)}
      >
        <span className="min-w-0 flex-1 truncate text-sm font-medium">{node.name}</span>
        {node.pinned ? <Pin size={12} className="text-badge-amber-indicator shrink-0" aria-label="Pinned" /> : null}
        <span className="text-muted-foreground shrink-0 text-xs">{meta}</span>
      </button>
    );
  };

  return (
    <div data-testid="knowledge-list" className="min-h-0 flex-1 overflow-y-auto pb-16">
      {childScopes.length > 0 ? (
        <section aria-label="Child scopes" className="mb-4">
          <Txt as="h3" variant="caption" className="text-muted-foreground mb-1 px-3 font-semibold">
            Scopes
          </Txt>
          <ul className="flex flex-col gap-0.5">
            {childScopes.map(node => (
              <li key={node.id}>
                {row(
                  node,
                  <span className="flex items-center gap-1">
                    {node.kind || 'topic'}
                    <ChevronRight size={14} aria-hidden />
                  </span>,
                )}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {contentNodes.length > 0 ? (
        <section aria-label="Knowledge nodes">
          <Txt as="h3" variant="caption" className="text-muted-foreground mb-1 px-3 font-semibold">
            Nodes
          </Txt>
          <ul className="flex flex-col gap-0.5">
            {contentNodes.map(node => {
              const records =
                node.id === selectedNodeId ? payload.records.filter(record => record.nodeIds[0] === node.id) : [];
              return (
                <li key={node.id}>
                  {row(node, node.recordCount === 1 ? '1 record' : `${node.recordCount} records`)}
                  {records.length > 0 ? (
                    <ul aria-label={`${node.name} records`} className="border-border my-1 ml-4 flex flex-col border-l">
                      {records.map(record => (
                        <li key={record.id}>
                          <button
                            type="button"
                            aria-pressed={record.id === selectedRecordId}
                            className={cn(
                              'text-muted-foreground hover:text-foreground min-h-11 w-full px-3 py-2 text-left text-sm',
                              record.id === selectedRecordId && 'bg-fill text-foreground',
                            )}
                            onClick={() => onRecordClick(node, record.id)}
                          >
                            {parseRecordSegments(record.text).map((segment, index) =>
                              segment.type === 'wikilink' ? (
                                <span key={index} className="text-badge-purple-indicator">
                                  {segment.value}
                                </span>
                              ) : (
                                <span key={index}>{segment.value}</span>
                              ),
                            )}
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
