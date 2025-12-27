import { Button } from '@/ds/components/Button';
import { EmptyState } from '@/ds/components/EmptyState';
import { Cell, Row, Table, Tbody, Th, Thead } from '@/ds/components/Table';
import { Icon } from '@/ds/icons/Icon';
import { ScrollableContainer } from '@/components/scrollable-container';
import { Skeleton } from '@/components/ui/skeleton';
import { useLinkComponent } from '@/lib/framework';
import { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { Searchbar, SearchbarWrapper } from '@/components/ui/searchbar';
import { useState, useMemo } from 'react';
import { Database, FileText, Trash2, Search, Sparkles, ChevronRight, FolderOpen, BookOpen } from 'lucide-react';
import type { KnowledgeNamespace } from '../hooks/use-knowledge';
import { Badge } from '@/ds/components/Badge';

export interface KnowledgeTableProps {
  namespaces: KnowledgeNamespace[];
  isLoading: boolean;
  isKnowledgeConfigured?: boolean;
  onDelete?: (namespace: string) => void;
}

export function KnowledgeTable({ namespaces, isLoading, isKnowledgeConfigured = true, onDelete }: KnowledgeTableProps) {
  const [search, setSearch] = useState('');
  const { navigate } = useLinkComponent();

  const filteredNamespaces = useMemo(() => {
    if (!search) return namespaces;
    return namespaces.filter(
      ns =>
        ns.namespace.toLowerCase().includes(search.toLowerCase()) ||
        ns.description?.toLowerCase().includes(search.toLowerCase()),
    );
  }, [namespaces, search]);

  if (!isKnowledgeConfigured && !isLoading) {
    return <KnowledgeNotConfigured />;
  }

  if (namespaces.length === 0 && !isLoading) {
    return <EmptyKnowledgeTable />;
  }

  return (
    <div className="space-y-3">
      <SearchbarWrapper>
        <Searchbar onSearch={setSearch} label="Search namespaces" placeholder="Search by name or description..." />
      </SearchbarWrapper>
      {isLoading ? (
        <KnowledgeTableSkeleton />
      ) : filteredNamespaces.length === 0 ? (
        <div className="text-center py-8 text-text3 text-sm">No namespaces match your search.</div>
      ) : (
        <ScrollableContainer>
          <TooltipProvider>
            <Table>
              <Thead className="sticky top-0 bg-surface1 z-10">
                <Th style={{ width: '35%' }}>Namespace</Th>
                <Th style={{ width: '30%' }}>Description</Th>
                <Th style={{ width: '12%' }}>Artifacts</Th>
                <Th style={{ width: '13%' }}>Search</Th>
                <Th style={{ width: '10%' }} className="text-right">
                  Actions
                </Th>
              </Thead>
              <Tbody>
                {filteredNamespaces.map(ns => (
                  <Row
                    key={ns.namespace}
                    onClick={() => navigate(`/knowledge/${encodeURIComponent(ns.namespace)}`)}
                    className="group cursor-pointer transition-colors hover:bg-surface2"
                  >
                    <Cell>
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-md bg-accent1/10 text-accent3">
                          <Database className="h-4 w-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <span className="font-medium text-sm truncate block">{ns.namespace}</span>
                        </div>
                        <ChevronRight className="h-4 w-4 text-icon3 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    </Cell>
                    <Cell>
                      <span className="text-text2 text-sm truncate block">{ns.description || '-'}</span>
                    </Cell>
                    <Cell>
                      <div className="flex items-center gap-2">
                        <FolderOpen className="h-4 w-4 text-icon3" />
                        <span className="text-sm tabular-nums font-medium">{ns.artifactCount}</span>
                      </div>
                    </Cell>
                    <Cell>
                      <div className="flex gap-1.5">
                        {ns.hasBM25 && (
                          <Tooltip>
                            <TooltipTrigger>
                              <Badge
                                variant="default"
                                className="text-xs bg-blue-500/10 text-blue-400 border border-blue-500/20"
                              >
                                <Search className="h-3 w-3 mr-1" />
                                BM25
                              </Badge>
                            </TooltipTrigger>
                            <TooltipContent>Keyword search enabled</TooltipContent>
                          </Tooltip>
                        )}
                        {ns.hasVector && (
                          <Tooltip>
                            <TooltipTrigger>
                              <Badge
                                variant="default"
                                className="text-xs bg-purple-500/10 text-purple-400 border border-purple-500/20"
                              >
                                <Sparkles className="h-3 w-3 mr-1" />
                                Vector
                              </Badge>
                            </TooltipTrigger>
                            <TooltipContent>Semantic search enabled</TooltipContent>
                          </Tooltip>
                        )}
                        {!ns.hasBM25 && !ns.hasVector && <span className="text-xs text-text3">No search</span>}
                      </div>
                    </Cell>
                    <Cell>
                      <div className="flex items-center justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="light"
                              size="md"
                              onClick={e => {
                                e.stopPropagation();
                                onDelete?.(ns.namespace);
                              }}
                              className="hover:text-red-400"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Delete namespace</TooltipContent>
                        </Tooltip>
                      </div>
                    </Cell>
                  </Row>
                ))}
              </Tbody>
            </Table>
          </TooltipProvider>
        </ScrollableContainer>
      )}
    </div>
  );
}

const KnowledgeTableSkeleton = () => (
  <div className="rounded-lg border border-border1 overflow-hidden">
    <Table>
      <Thead className="bg-surface2">
        <Th>Namespace</Th>
        <Th>Description</Th>
        <Th>Artifacts</Th>
        <Th>Search</Th>
        <Th>Actions</Th>
      </Thead>
      <Tbody>
        {Array.from({ length: 3 }).map((_, index) => (
          <Row key={index}>
            <Cell>
              <div className="flex items-center gap-3">
                <Skeleton className="h-8 w-8 rounded-md" />
                <Skeleton className="h-4 w-32" />
              </div>
            </Cell>
            <Cell>
              <Skeleton className="h-4 w-48" />
            </Cell>
            <Cell>
              <Skeleton className="h-4 w-8" />
            </Cell>
            <Cell>
              <div className="flex gap-1">
                <Skeleton className="h-5 w-14 rounded-full" />
                <Skeleton className="h-5 w-16 rounded-full" />
              </div>
            </Cell>
            <Cell>
              <Skeleton className="h-8 w-8 ml-auto" />
            </Cell>
          </Row>
        ))}
      </Tbody>
    </Table>
  </div>
);

const KnowledgeNotConfigured = () => (
  <div className="flex h-full items-center justify-center">
    <div className="flex max-w-lg flex-col items-center justify-center text-center p-8">
      <div className="p-4 rounded-full bg-surface2 mb-6">
        <Database className="h-10 w-10 text-icon3" />
      </div>
      <h2 className="text-xl font-semibold mb-2">Knowledge Not Configured</h2>
      <p className="text-text3 text-sm mb-6 leading-relaxed">
        No Knowledge instance is registered with Mastra. Add a Knowledge instance to your configuration to store and
        search through your documents.
      </p>
      <Button size="lg" variant="default" as="a" href="https://mastra.ai/en/docs/rag/overview" target="_blank">
        <Icon>
          <BookOpen className="h-4 w-4" />
        </Icon>
        Learn about Knowledge
      </Button>
    </div>
  </div>
);

const EmptyKnowledgeTable = () => (
  <div className="flex h-full items-center justify-center py-16 rounded-lg border border-dashed border-border1">
    <EmptyState
      iconSlot={
        <div className="p-4 rounded-full bg-surface2">
          <Database className="h-8 w-8 text-icon3" />
        </div>
      }
      titleSlot="No Knowledge Namespaces"
      descriptionSlot="Create a namespace to organize your knowledge artifacts. Each namespace can have its own search configuration."
      actionSlot={
        <Button size="lg" variant="light" as="a" href="https://mastra.ai/en/docs" target="_blank">
          <Icon>
            <FileText className="h-4 w-4" />
          </Icon>
          Documentation
        </Button>
      }
    />
  </div>
);
