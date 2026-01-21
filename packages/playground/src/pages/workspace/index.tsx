import { useState, useEffect } from 'react';
import {
  MainContentLayout,
  Header,
  HeaderTitle,
  HeaderAction,
  Icon,
  Button,
  DocsIcon,
  PageHeader,
  useWorkspaceInfo,
  useWorkspaces,
  useWorkspaceFiles,
  useWorkspaceSkills,
  useSearchWorkspace,
  useSearchWorkspaceSkills,
  useDeleteWorkspaceFile,
  useCreateWorkspaceDirectory,
  FileBrowser,
  FileViewer,
  SkillsTable,
  SearchWorkspacePanel,
  SearchSkillsPanel,
  WorkspaceNotConfigured,
  useWorkspaceFile,
  type WorkspaceItem,
} from '@mastra/playground-ui';

import { Link, useSearchParams } from 'react-router';
import { Folder, FileText, Wand2, Search, ChevronDown, Bot, Server } from 'lucide-react';

type TabType = 'files' | 'skills';

export default function Workspace() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [showSearch, setShowSearch] = useState(false);
  const [showWorkspaceDropdown, setShowWorkspaceDropdown] = useState(false);

  // Get state from URL params
  const workspaceIdFromUrl = searchParams.get('workspaceId');
  const pathFromUrl = searchParams.get('path') || '/';
  const fileFromUrl = searchParams.get('file');
  const tabFromUrl = (searchParams.get('tab') as TabType) || 'files';

  // List of all workspaces (global + agent workspaces)
  const { data: workspacesData, isLoading: isLoadingWorkspaces } = useWorkspaces();
  const workspaces = workspacesData?.workspaces ?? [];

  // Workspace info (currently always fetches global workspace)
  const { data: workspaceInfo, isLoading: isLoadingInfo } = useWorkspaceInfo();

  // Get the selected workspace from the list (use URL param or default to first)
  const selectedWorkspace: WorkspaceItem | undefined = workspaceIdFromUrl
    ? workspaces.find(w => w.id === workspaceIdFromUrl)
    : workspaces[0];

  // Helper to update URL params while preserving others
  const updateSearchParams = (updates: Record<string, string | null>) => {
    const newParams = new URLSearchParams(searchParams);
    for (const [key, value] of Object.entries(updates)) {
      if (value === null) {
        newParams.delete(key);
      } else {
        newParams.set(key, value);
      }
    }
    setSearchParams(newParams);
  };

  // State setters that update URL
  const setSelectedWorkspaceId = (id: string | null) => {
    // Reset path and file when workspace changes
    updateSearchParams({ workspaceId: id, path: '/', file: null });
  };

  const setCurrentPath = (path: string) => {
    updateSearchParams({ path, file: null });
  };

  const setSelectedFile = (file: string | null) => {
    updateSearchParams({ file });
  };

  const setActiveTab = (tab: TabType) => {
    updateSearchParams({ tab });
  };

  // Use URL-derived values
  const currentPath = pathFromUrl;
  const selectedFile = fileFromUrl;
  const activeTab = tabFromUrl;

  // Effective workspace ID to use for API calls
  const effectiveWorkspaceId = selectedWorkspace?.id;

  // Files - pass workspaceId to get files from the selected workspace
  const {
    data: filesData,
    isLoading: isLoadingFiles,
    refetch: refetchFiles,
  } = useWorkspaceFiles(currentPath, {
    enabled: workspaceInfo?.isWorkspaceConfigured && workspaceInfo?.capabilities?.hasFilesystem,
    workspaceId: effectiveWorkspaceId,
  });
  const deleteFile = useDeleteWorkspaceFile();
  const createDirectory = useCreateWorkspaceDirectory();
  const searchWorkspace = useSearchWorkspace();

  // Selected file content - pass workspaceId
  const { data: fileContent, isLoading: isLoadingFileContent } = useWorkspaceFile(selectedFile ?? '', {
    enabled: !!selectedFile,
    workspaceId: effectiveWorkspaceId,
  });

  // Skills - pass workspaceId to get skills from the selected workspace
  const { data: skillsData, isLoading: isLoadingSkills } = useWorkspaceSkills({ workspaceId: effectiveWorkspaceId });
  const searchSkills = useSearchWorkspaceSkills();

  const isWorkspaceConfigured = workspaceInfo?.isWorkspaceConfigured ?? false;
  const hasFilesystem = workspaceInfo?.capabilities?.hasFilesystem ?? false;
  const hasSkills = workspaceInfo?.capabilities?.hasSkills ?? false;
  const canBM25 = workspaceInfo?.capabilities?.canBM25 ?? false;
  const canVector = workspaceInfo?.capabilities?.canVector ?? false;

  const skills = skillsData?.skills ?? [];
  const isSkillsConfigured = skillsData?.isSkillsConfigured ?? false;
  const files = filesData?.entries ?? [];

  // If workspace is not configured, show the not configured message
  if (!isLoadingInfo && !isWorkspaceConfigured) {
    return (
      <MainContentLayout>
        <Header>
          <HeaderTitle>
            <Icon>
              <Folder className="h-4 w-4" />
            </Icon>
            Workspace
          </HeaderTitle>

          <HeaderAction>
            <Button as={Link} to="https://mastra.ai/en/docs/workspace/overview" target="_blank">
              <Icon>
                <DocsIcon />
              </Icon>
              Documentation
            </Button>
          </HeaderAction>
        </Header>

        <div className="grid overflow-y-auto h-full">
          <div className="max-w-[100rem] px-[3rem] mx-auto grid content-start h-full w-full">
            <PageHeader
              title="Workspace"
              description="Manage files, skills, and search your workspace"
              icon={<Folder />}
            />
            <WorkspaceNotConfigured />
          </div>
        </div>
      </MainContentLayout>
    );
  }

  return (
    <MainContentLayout>
      <Header>
        <HeaderTitle>
          <Icon>
            <Folder className="h-4 w-4" />
          </Icon>
          Workspace
        </HeaderTitle>

        <HeaderAction>
          {(hasFilesystem || hasSkills) && (
            <Button variant="light" onClick={() => setShowSearch(!showSearch)}>
              <Icon>
                <Search className="h-4 w-4" />
              </Icon>
              Search
            </Button>
          )}
          <Button as={Link} to="https://mastra.ai/en/docs/workspace/overview" target="_blank">
            <Icon>
              <DocsIcon />
            </Icon>
            Documentation
          </Button>
        </HeaderAction>
      </Header>

      <div className="grid overflow-y-auto h-full">
        <div className="max-w-[100rem] px-[3rem] mx-auto grid content-start gap-6 h-full w-full">
          <PageHeader
            title="Workspace"
            description="Manage files, skills, and search your workspace"
            icon={<Folder />}
          />

          {/* Workspace Selector - shown when multiple workspaces exist */}
          {workspaces.length > 1 && (
            <div className="relative">
              <button
                onClick={() => setShowWorkspaceDropdown(!showWorkspaceDropdown)}
                className="flex items-center gap-2 px-3 py-2 text-sm border border-border1 rounded-lg bg-surface2 hover:bg-surface3 transition-colors w-full max-w-md"
              >
                {selectedWorkspace?.source === 'agent' ? (
                  <Bot className="h-4 w-4 text-accent1" />
                ) : (
                  <Server className="h-4 w-4 text-icon4" />
                )}
                <span className="flex-1 text-left truncate">
                  {selectedWorkspace?.name ?? 'Select workspace'}
                  {selectedWorkspace?.source === 'agent' && selectedWorkspace.agentName && (
                    <span className="text-icon4 ml-1">({selectedWorkspace.agentName})</span>
                  )}
                </span>
                <ChevronDown
                  className={`h-4 w-4 text-icon4 transition-transform ${showWorkspaceDropdown ? 'rotate-180' : ''}`}
                />
              </button>

              {showWorkspaceDropdown && (
                <div className="absolute z-50 mt-1 w-full max-w-md bg-surface2 border border-border1 rounded-lg shadow-lg overflow-hidden">
                  {workspaces.map(workspace => (
                    <button
                      key={workspace.id}
                      onClick={() => {
                        setSelectedWorkspaceId(workspace.id);
                        setShowWorkspaceDropdown(false);
                      }}
                      className={`flex items-center gap-3 px-3 py-2 w-full text-left hover:bg-surface3 transition-colors ${
                        selectedWorkspace?.id === workspace.id ? 'bg-surface3' : ''
                      }`}
                    >
                      {workspace.source === 'agent' ? (
                        <Bot className="h-4 w-4 text-accent1 flex-shrink-0" />
                      ) : (
                        <Server className="h-4 w-4 text-icon4 flex-shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-icon6 truncate">{workspace.name}</div>
                        <div className="text-xs text-icon4 truncate">
                          {workspace.source === 'agent' ? `Agent: ${workspace.agentName}` : 'Global workspace'}
                          {' · '}
                          {workspace.status}
                        </div>
                      </div>
                      <div className="flex gap-1 flex-shrink-0">
                        {workspace.capabilities.hasFilesystem && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-surface4 text-icon4">FS</span>
                        )}
                        {workspace.capabilities.hasSandbox && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-surface4 text-icon4">Sandbox</span>
                        )}
                        {workspace.capabilities.hasSkills && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-surface4 text-icon4">Skills</span>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Single workspace info badge - shown when only one workspace */}
          {workspaces.length === 1 && selectedWorkspace && (
            <div className="flex items-center gap-2 text-sm text-icon4">
              {selectedWorkspace.source === 'agent' ? (
                <Bot className="h-4 w-4 text-accent1" />
              ) : (
                <Server className="h-4 w-4" />
              )}
              <span>{selectedWorkspace.name}</span>
              {selectedWorkspace.source === 'agent' && selectedWorkspace.agentName && (
                <span className="text-icon3">({selectedWorkspace.agentName})</span>
              )}
              <span className="text-icon3">·</span>
              <span className="text-icon3">{selectedWorkspace.status}</span>
            </div>
          )}

          {/* Search Panel */}
          {showSearch && (
            <div className="border border-border1 rounded-lg p-4 bg-surface2 space-y-4">
              {hasFilesystem && (canBM25 || canVector) && (
                <div>
                  <h3 className="text-sm font-medium text-icon5 mb-3 flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Search Files
                  </h3>
                  <SearchWorkspacePanel
                    onSearch={params => searchWorkspace.mutate(params)}
                    isSearching={searchWorkspace.isPending}
                    searchResults={searchWorkspace.data}
                    canBM25={canBM25}
                    canVector={canVector}
                    onViewResult={id => setSelectedFile(id)}
                  />
                </div>
              )}

              {hasSkills && isSkillsConfigured && skills.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-icon5 mb-3 flex items-center gap-2">
                    <Wand2 className="h-4 w-4" />
                    Search Skills
                  </h3>
                  <SearchSkillsPanel
                    onSearch={params => searchSkills.mutate(params)}
                    results={searchSkills.data?.results ?? []}
                    isSearching={searchSkills.isPending}
                  />
                </div>
              )}
            </div>
          )}

          {/* Tab Navigation */}
          <div className="flex gap-2 border-b border-border1">
            {hasFilesystem && (
              <button
                onClick={() => setActiveTab('files')}
                className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'files' ? 'border-accent1 text-icon6' : 'border-transparent text-icon4 hover:text-icon5'
                }`}
              >
                <FileText className="h-4 w-4" />
                Files
              </button>
            )}
            {hasSkills && (
              <button
                onClick={() => setActiveTab('skills')}
                className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'skills'
                    ? 'border-accent1 text-icon6'
                    : 'border-transparent text-icon4 hover:text-icon5'
                }`}
              >
                <Wand2 className="h-4 w-4" />
                Skills
                {isSkillsConfigured && skills.length > 0 && (
                  <span className="text-xs px-1.5 py-0.5 rounded bg-surface4 text-icon4">{skills.length}</span>
                )}
              </button>
            )}
          </div>

          {/* Tab Content */}
          <div className="pb-8">
            {activeTab === 'files' && hasFilesystem && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <FileBrowser
                    entries={files}
                    currentPath={currentPath}
                    isLoading={isLoadingFiles}
                    onNavigate={setCurrentPath}
                    onFileSelect={setSelectedFile}
                    onRefresh={() => refetchFiles()}
                    onCreateDirectory={path => createDirectory.mutate({ path, workspaceId: effectiveWorkspaceId })}
                    onDelete={path =>
                      deleteFile.mutate({ path, recursive: true, force: true, workspaceId: effectiveWorkspaceId })
                    }
                  />
                  {selectedFile && (
                    <FileViewer
                      path={selectedFile}
                      content={fileContent?.content ?? ''}
                      isLoading={isLoadingFileContent}
                      mimeType={fileContent?.mimeType}
                      onClose={() => setSelectedFile(null)}
                    />
                  )}
                </div>
              </div>
            )}

            {activeTab === 'skills' && hasSkills && (
              <SkillsTable
                skills={skills}
                isLoading={isLoadingSkills}
                isSkillsConfigured={isSkillsConfigured}
                basePath="/workspace/skills"
                workspaceId={effectiveWorkspaceId}
              />
            )}

            {/* Show default tab if only one is available */}
            {!hasFilesystem && !hasSkills && (
              <div className="py-12 text-center text-icon4">
                <p>No workspace capabilities are configured.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </MainContentLayout>
  );
}
