import { useState } from 'react';
import {
  MainContentLayout,
  Header,
  HeaderAction,
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
} from '@mastra/playground-ui';

import { Link, useParams } from 'react-router';
import { Database, Search, Sparkles, FolderOpen } from 'lucide-react';

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

  // Fetch namespace info
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
    deleteArtifact.mutate(artifactKey);
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
          <Button as={Link} to="https://mastra.ai/en/docs/rag/overview" target="_blank">
            <Icon>
              <DocsIcon />
            </Icon>
            Documentation
          </Button>
        </HeaderAction>
      </Header>

      <div className="grid overflow-y-auto h-full">
        <div className="max-w-[100rem] px-[3rem] mx-auto grid content-start gap-[1rem] h-full w-full">
          {/* Header */}
          <div className="pt-[2rem]">
            <div className="flex items-center gap-4 mb-2">
              <h1 className="text-[1.25rem] text-icon6 font-normal flex items-center gap-2">
                <Database className="h-5 w-5 text-icon3" />
                {decodedNamespace}
              </h1>
              <div className="flex items-center gap-1.5">
                {hasBM25 && (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[0.6875rem] bg-blue-500/10 text-blue-400">
                    <Search className="h-3 w-3" />
                    BM25
                  </span>
                )}
                {hasVector && (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[0.6875rem] bg-purple-500/10 text-purple-400">
                    <Sparkles className="h-3 w-3" />
                    Vector
                  </span>
                )}
              </div>
            </div>
            {namespaceInfo?.description && <p className="text-[0.875rem] text-icon4">{namespaceInfo.description}</p>}
          </div>

          {/* Search */}
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

          {/* Artifacts */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <FolderOpen className="h-4 w-4 text-icon3" />
              <h2 className="text-sm font-medium text-icon6">Artifacts</h2>
              <span className="text-xs text-icon3">({artifacts.length})</span>
            </div>
            <ArtifactTable
              artifacts={artifacts}
              isLoading={isLoading}
              onDelete={handleDeleteArtifact}
              onView={setViewingArtifact}
            />
          </div>
        </div>
      </div>

      {/* Artifact Viewer */}
      <ArtifactViewerDialog
        open={!!viewingArtifact}
        onOpenChange={open => !open && setViewingArtifact(null)}
        artifactKey={viewingArtifact ?? ''}
        content={artifactDetail?.content}
        metadata={artifactDetail?.metadata}
        isLoading={isLoadingDetail}
      />
    </MainContentLayout>
  );
}
