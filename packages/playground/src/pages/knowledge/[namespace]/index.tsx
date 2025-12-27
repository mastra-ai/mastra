import { useState } from 'react';
import {
  MainContentLayout,
  Header,
  HeaderAction,
  MainContentContent,
  Icon,
  Button,
  DocsIcon,
  Breadcrumb,
  Crumb,
  ArtifactTable,
  AddArtifactDialog,
  ArtifactViewerDialog,
  SearchKnowledgePanel,
  useKnowledgeArtifacts,
  useKnowledgeArtifact,
  useAddKnowledgeArtifact,
  useAddKnowledgeFileArtifact,
  useDeleteKnowledgeArtifact,
  useSearchKnowledge,
  useKnowledgeNamespaces,
  Badge,
} from '@mastra/playground-ui';

import { Link, useParams } from 'react-router';
import { Database, Search, Sparkles, FolderOpen } from 'lucide-react';

// Type for artifact parameters from AddArtifactDialog
interface AddArtifactParams {
  key: string;
  type: 'text' | 'file';
  content?: string;
  file?: File;
  metadata?: Record<string, unknown>;
  isStatic?: boolean;
}

export default function KnowledgeNamespaceDetail() {
  const { namespace } = useParams<{ namespace: string }>();
  const decodedNamespace = namespace ? decodeURIComponent(namespace) : '';

  const [viewingArtifact, setViewingArtifact] = useState<string | null>(null);

  // Fetch namespace info for capabilities
  const { data: namespacesData } = useKnowledgeNamespaces();
  const namespaceInfo = namespacesData?.namespaces.find(ns => ns.namespace === decodedNamespace);

  // Fetch artifacts
  const { data: artifactsData, isLoading } = useKnowledgeArtifacts(decodedNamespace);
  const artifacts = artifactsData?.artifacts ?? [];

  // Fetch single artifact for viewer
  const { data: artifactDetail, isLoading: isLoadingDetail } = useKnowledgeArtifact(
    decodedNamespace,
    viewingArtifact ?? '',
    { enabled: !!viewingArtifact },
  );

  // Mutations
  const addTextArtifact = useAddKnowledgeArtifact(decodedNamespace);
  const addFileArtifact = useAddKnowledgeFileArtifact(decodedNamespace);
  const deleteArtifact = useDeleteKnowledgeArtifact(decodedNamespace);
  const searchKnowledge = useSearchKnowledge(decodedNamespace);

  const handleAddArtifact = (params: AddArtifactParams) => {
    if (params.type === 'file' && params.file) {
      addFileArtifact.mutate({
        key: params.key,
        file: params.file,
        metadata: params.metadata,
        skipIndex: params.isStatic,
      });
    } else if (params.type === 'text' && params.content) {
      addTextArtifact.mutate({
        key: params.key,
        content: params.content,
        metadata: params.metadata,
        skipIndex: params.isStatic,
      });
    }
  };

  const handleDeleteArtifact = (artifactKey: string) => {
    if (confirm(`Are you sure you want to delete the artifact "${artifactKey}"?`)) {
      deleteArtifact.mutate(artifactKey);
    }
  };

  const handleSearch = (params: { query: string; topK?: number; mode?: 'vector' | 'bm25' | 'hybrid' }) => {
    searchKnowledge.mutate(params);
  };

  const hasBM25 = namespaceInfo?.hasBM25 ?? true;
  const hasVector = namespaceInfo?.hasVector ?? false;
  const isAddingArtifact = addTextArtifact.isPending || addFileArtifact.isPending;

  return (
    <MainContentLayout>
      <Header>
        <Breadcrumb>
          <Crumb as={Link} to="/knowledge">
            <Icon>
              <Database className="h-4 w-4" />
            </Icon>
            Knowledge
          </Crumb>
          <Crumb as="span" to="" isCurrent>
            {decodedNamespace}
          </Crumb>
        </Breadcrumb>

        <HeaderAction>
          <AddArtifactDialog onSubmit={handleAddArtifact} isLoading={isAddingArtifact} />
          <Button as={Link} to="https://mastra.ai/en/docs" target="_blank">
            <Icon>
              <DocsIcon />
            </Icon>
            Documentation
          </Button>
        </HeaderAction>
      </Header>

      <MainContentContent>
        <div className="space-y-6">
          {/* Namespace Info Card */}
          <div className="rounded-xl border border-border1 bg-surface1 p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-lg bg-accent1/10">
                  <Database className="h-6 w-6 text-accent3" />
                </div>
                <div>
                  <h1 className="text-lg font-semibold">{decodedNamespace}</h1>
                  {namespaceInfo?.description && (
                    <p className="text-sm text-text3 mt-0.5">{namespaceInfo.description}</p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-4">
                {/* Stats */}
                <div className="flex items-center gap-6 px-4 py-2 rounded-lg bg-surface2">
                  <div className="flex items-center gap-2">
                    <FolderOpen className="h-4 w-4 text-icon3" />
                    <span className="text-sm font-medium">{artifacts.length}</span>
                    <span className="text-xs text-text3">artifacts</span>
                  </div>
                  <div className="h-4 w-px bg-border1" />
                  <div className="flex items-center gap-2">
                    {hasBM25 && (
                      <Badge
                        variant="default"
                        className="text-xs bg-blue-500/10 text-blue-400 border border-blue-500/20"
                      >
                        <Search className="h-3 w-3 mr-1" />
                        BM25
                      </Badge>
                    )}
                    {hasVector && (
                      <Badge
                        variant="default"
                        className="text-xs bg-purple-500/10 text-purple-400 border border-purple-500/20"
                      >
                        <Sparkles className="h-3 w-3 mr-1" />
                        Vector
                      </Badge>
                    )}
                    {!hasBM25 && !hasVector && <span className="text-xs text-text3">No search</span>}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Search Panel */}
          {(hasBM25 || hasVector) && (
            <SearchKnowledgePanel
              onSearch={handleSearch}
              isSearching={searchKnowledge.isPending}
              searchResults={searchKnowledge.data}
              hasBM25={hasBM25}
              hasVector={hasVector}
              onViewResult={setViewingArtifact}
            />
          )}

          {/* Artifacts Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold">Artifacts</h2>
              <span className="text-sm text-text3">{artifacts.length} total</span>
            </div>
            <ArtifactTable
              artifacts={artifacts}
              isLoading={isLoading}
              onDelete={handleDeleteArtifact}
              onView={setViewingArtifact}
            />
          </div>
        </div>

        {/* Artifact Viewer Dialog */}
        <ArtifactViewerDialog
          open={!!viewingArtifact}
          onOpenChange={(open: boolean) => !open && setViewingArtifact(null)}
          artifactKey={viewingArtifact ?? ''}
          content={artifactDetail?.content}
          metadata={artifactDetail?.metadata}
          isLoading={isLoadingDetail}
        />
      </MainContentContent>
    </MainContentLayout>
  );
}
