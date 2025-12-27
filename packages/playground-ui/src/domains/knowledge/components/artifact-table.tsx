import { Button } from '@/ds/components/Button';
import { EmptyState } from '@/ds/components/EmptyState';
import { Cell, Row, Table, Tbody, Th, Thead } from '@/ds/components/Table';
import { ScrollableContainer } from '@/components/scrollable-container';
import { Skeleton } from '@/components/ui/skeleton';
import { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { Searchbar, SearchbarWrapper } from '@/components/ui/searchbar';
import { useState, useMemo } from 'react';
import { FileText, Trash2, File, Image, Eye, Lock } from 'lucide-react';
import type { KnowledgeArtifact } from '../hooks/use-knowledge';
import { Badge } from '@/ds/components/Badge';

export interface ArtifactTableProps {
  artifacts: KnowledgeArtifact[];
  isLoading: boolean;
  onDelete?: (artifactKey: string) => void;
  onView?: (artifactKey: string) => void;
}

const getArtifactIcon = (type: KnowledgeArtifact['type']) => {
  switch (type) {
    case 'image':
      return <Image className="h-4 w-4" />;
    case 'file':
      return <File className="h-4 w-4" />;
    default:
      return <FileText className="h-4 w-4" />;
  }
};

const getArtifactTypeColor = (type: KnowledgeArtifact['type']) => {
  switch (type) {
    case 'image':
      return 'bg-purple-500/10 text-purple-400 border-purple-500/20';
    case 'file':
      return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
    default:
      return 'bg-green-500/10 text-green-400 border-green-500/20';
  }
};

const formatBytes = (bytes?: number): string => {
  if (bytes === undefined || bytes === null) return '-';
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};

const formatDate = (dateStr?: string): string => {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

export function ArtifactTable({ artifacts, isLoading, onDelete, onView }: ArtifactTableProps) {
  const [search, setSearch] = useState('');

  const filteredArtifacts = useMemo(() => {
    if (!search) return artifacts;
    const searchLower = search.toLowerCase();
    return artifacts.filter(artifact => {
      // Search both the full key and the display key (without static/ prefix)
      const displayKey = artifact.key.startsWith('static/') ? artifact.key.slice(7) : artifact.key;
      return artifact.key.toLowerCase().includes(searchLower) || displayKey.toLowerCase().includes(searchLower);
    });
  }, [artifacts, search]);

  if (artifacts.length === 0 && !isLoading) {
    return <EmptyArtifactTable />;
  }

  return (
    <div className="space-y-3">
      <SearchbarWrapper>
        <Searchbar onSearch={setSearch} label="Search artifacts" placeholder="Search by key..." />
      </SearchbarWrapper>
      {isLoading ? (
        <ArtifactTableSkeleton />
      ) : filteredArtifacts.length === 0 ? (
        <div className="text-center py-8 text-text3 text-sm">No artifacts match your search.</div>
      ) : (
        <ScrollableContainer>
          <TooltipProvider>
            <Table>
              <Thead className="sticky top-0 bg-surface1 z-10">
                <Th style={{ width: '45%' }}>Artifact</Th>
                <Th style={{ width: '12%' }}>Type</Th>
                <Th style={{ width: '12%' }}>Size</Th>
                <Th style={{ width: '16%' }}>Created</Th>
                <Th style={{ width: '15%' }} className="text-right">
                  Actions
                </Th>
              </Thead>
              <Tbody>
                {filteredArtifacts.map(artifact => {
                  // Static artifacts have keys prefixed with "static/"
                  const isStatic = artifact.key.startsWith('static/');
                  // Display key without the static/ prefix for cleaner UI
                  const displayKey = isStatic ? artifact.key.slice(7) : artifact.key;
                  return (
                    <Row
                      key={artifact.key}
                      onClick={() => onView?.(artifact.key)}
                      className={`${onView ? 'cursor-pointer' : ''} group transition-colors hover:bg-surface2`}
                    >
                      <Cell>
                        <div className="flex items-center gap-3">
                          <div
                            className={`p-2 rounded-md ${getArtifactTypeColor(artifact.type)} flex items-center justify-center`}
                          >
                            {getArtifactIcon(artifact.type)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-medium truncate text-sm">{displayKey}</span>
                              {isStatic && (
                                <Tooltip>
                                  <TooltipTrigger>
                                    <Lock className="h-3 w-3 text-amber-400" />
                                  </TooltipTrigger>
                                  <TooltipContent>Static artifact (available via getStatic)</TooltipContent>
                                </Tooltip>
                              )}
                            </div>
                            {artifact.metadata?.filename ? (
                              <span className="text-xs text-text3 truncate block">
                                {String(artifact.metadata.filename)}
                              </span>
                            ) : null}
                          </div>
                        </div>
                      </Cell>
                      <Cell>
                        <Badge
                          variant="default"
                          className={`text-xs capitalize border ${getArtifactTypeColor(artifact.type)}`}
                        >
                          {artifact.type}
                        </Badge>
                      </Cell>
                      <Cell>
                        <span className="text-text2 text-sm tabular-nums">{formatBytes(artifact.size)}</span>
                      </Cell>
                      <Cell>
                        <span className="text-text3 text-sm">{formatDate(artifact.createdAt)}</span>
                      </Cell>
                      <Cell>
                        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="light"
                                size="md"
                                onClick={e => {
                                  e.stopPropagation();
                                  onView?.(artifact.key);
                                }}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>View artifact</TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="light"
                                size="md"
                                onClick={e => {
                                  e.stopPropagation();
                                  onDelete?.(artifact.key);
                                }}
                                className="hover:text-red-400"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Delete artifact</TooltipContent>
                          </Tooltip>
                        </div>
                      </Cell>
                    </Row>
                  );
                })}
              </Tbody>
            </Table>
          </TooltipProvider>
        </ScrollableContainer>
      )}
    </div>
  );
}

const ArtifactTableSkeleton = () => (
  <div className="rounded-lg border border-border1 overflow-hidden">
    <Table>
      <Thead className="bg-surface2">
        <Th>Artifact</Th>
        <Th>Type</Th>
        <Th>Size</Th>
        <Th>Created</Th>
        <Th>Actions</Th>
      </Thead>
      <Tbody>
        {Array.from({ length: 5 }).map((_, index) => (
          <Row key={index}>
            <Cell>
              <div className="flex items-center gap-3">
                <Skeleton className="h-8 w-8 rounded-md" />
                <Skeleton className="h-4 w-48" />
              </div>
            </Cell>
            <Cell>
              <Skeleton className="h-5 w-14 rounded-full" />
            </Cell>
            <Cell>
              <Skeleton className="h-4 w-16" />
            </Cell>
            <Cell>
              <Skeleton className="h-4 w-20" />
            </Cell>
            <Cell>
              <Skeleton className="h-8 w-16 ml-auto" />
            </Cell>
          </Row>
        ))}
      </Tbody>
    </Table>
  </div>
);

const EmptyArtifactTable = () => (
  <div className="flex h-full items-center justify-center py-16 rounded-lg border border-dashed border-border1">
    <EmptyState
      iconSlot={
        <div className="p-4 rounded-full bg-surface2">
          <FileText className="h-8 w-8 text-icon3" />
        </div>
      }
      titleSlot="No Artifacts Yet"
      descriptionSlot="Add artifacts to this namespace to store and search your knowledge. You can add text content or upload files."
      actionSlot={null}
    />
  </div>
);
