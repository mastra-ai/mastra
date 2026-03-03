import { useState, useCallback } from 'react';
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
  isWorkspaceNotSupportedError,
  // Skills.sh
  AddSkillDialog,
  useInstallSkill,
  useUpdateSkills,
  useRemoveSkill,
  toast,
  type WorkspaceItem,
} from '@mastra/playground-ui';

import { Link, useSearchParams, useParams, useNavigate } from 'react-router';
import { Folder, FileText, Wand2, Search, ChevronDown, Bot, Server, AlertTriangle } from 'lucide-react';

type TabType = 'files' | 'skills';

export default function Workspace() {
  const { workspaceId: workspaceIdFromPath } = useParams<{ workspaceId?: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const [showSearch, setShowSearch] = useState(false);
  const [showWorkspaceDropdown, setShowWorkspaceDropdown] = useState(false);
  const [showAddSkillDialog, setShowAddSkillDialog] = useState(false);
  const [removingSkillName, setRemovingSkillName] = useState<string | null>(null);
  const [updatingSkillName, setUpdatingSkillName] = useState<string | null>(null);
  // Track if we installed a skill that wasn't discovered (client-side only, resets on refresh)
  const [hasUndiscoveredInstall, setHasUndiscoveredInstall] = useState(false);

  // Get state from URL query params (path, file, tab are still query params)
  const fileFromUrl = searchParams.get('file');
  const tabFromUrl = searchParams.get('tab') as TabType | null;

  // List of all workspaces (global + agent workspaces) - used for workspace selector dropdown
  const { data: workspacesData, error: workspacesError } = useWorkspaces();
  const workspaces = workspacesData?.workspaces ?? [];

  // Use workspaceId from path directly if available, otherwise fall back to first workspace from list
  const effectiveWorkspaceId = workspaceIdFromPath ?? workspaces[0]?.id;

  // Workspace info - calls /api/workspaces/:workspaceId directly
  const {
    data: workspaceInfo,
    isLoading: isLoadingInfo,
    error: workspaceInfoError,
  } = useWorkspaceInfo(effectiveWorkspaceId);

  // For uncontained local filesystems, default to basePath instead of / (which would show the real root)
  const fsMetadata = workspaceInfo?.filesystem?.metadata;
  const defaultPath =
    fsMetadata?.contained === false && typeof fsMetadata?.basePath === 'string' ? fsMetadata.basePath : '/';
  const pathFromUrl = searchParams.get('path') || defaultPath;

  // Check if workspaces are not supported (501 error from server)
  const isWorkspaceNotSupported =
    isWorkspaceNotSupportedError(workspacesError) || isWorkspaceNotSupportedError(workspaceInfoError);

  // Get the selected workspace metadata from the list (for displaying name, capabilities badge, etc.)
  const selectedWorkspace: WorkspaceItem | undefined = effectiveWorkspaceId
    ? workspaces.find(w => w.id === effectiveWorkspaceId)
    : undefined;

  // Helper to update URL query params while preserving others
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

  // Navigate to a different workspace (changes path, resets query params)
  const setSelectedWorkspaceId = (id: string) => {
    setHasUndiscoveredInstall(false); // Reset warning when switching workspaces
    setShowSearch(false);
    navigate(`/workspaces/${id}`);
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

  // Files - pass workspaceId to get files from the selected workspace
  const {
    data: filesData,
    isLoading: isLoadingFiles,
    error: filesError,
    refetch: refetchFiles,
  } = useWorkspaceFiles(currentPath, {
    enabled: workspaceInfo?.isWorkspaceConfigured && workspaceInfo?.capabilities?.hasFilesystem,
    workspaceId: effectiveWorkspaceId,
  });
  const deleteFile = useDeleteWorkspaceFile();
  const createDirectory = useCreateWorkspaceDirectory();

  // Selected file content - pass workspaceId
  const { data: fileContent, isLoading: isLoadingFileContent } = useWorkspaceFile(selectedFile ?? '', {
    enabled: !!selectedFile,
    workspaceId: effectiveWorkspaceId,
  });

  // Skills - pass workspaceId to get skills from the selected workspace
  const {
    data: skillsData,
    isLoading: isLoadingSkills,
    refetch: refetchSkills,
  } = useWorkspaceSkills({ workspaceId: effectiveWorkspaceId });

  // Skills.sh hooks
  const installSkill = useInstallSkill();
  const updateSkills = useUpdateSkills();
  const removeSkill = useRemoveSkill();

  const isWorkspaceConfigured = workspaceInfo?.isWorkspaceConfigured ?? false;
  const hasFilesystem = workspaceInfo?.capabilities?.hasFilesystem ?? false;
  const hasSkills = workspaceInfo?.capabilities?.hasSkills ?? false;
  const canBM25 = workspaceInfo?.capabilities?.canBM25 ?? false;
  const canVector = workspaceInfo?.capabilities?.canVector ?? false;
  // Check if the selected workspace is read-only
  const isReadOnly = selectedWorkspace?.safety?.readOnly ?? false;

  // Can manage skills (install/remove/check/update) if we have filesystem and not read-only
  // None of these operations require sandbox - all are done via GitHub API + filesystem
  const canManageSkills = hasFilesystem && !isReadOnly;

  // Derive writable mounts and mount paths for CompositeFilesystem
  const mounts = workspaceInfo?.mounts;
  const writableMounts = mounts
    ?.filter(m => !m.readOnly)
    .map(m => ({ path: m.path, displayName: m.displayName, icon: m.icon, provider: m.provider, name: m.name }));
  const mountPaths = mounts && mounts.length > 1 ? mounts.map(m => m.path) : undefined;

  // Skills.sh handlers
  const handleInstallSkill = useCallback(
    (params: { repository: string; skillName: string; mount?: string }) => {
      if (!effectiveWorkspaceId) return;

      installSkill.mutate(
        { ...params, workspaceId: effectiveWorkspaceId },
        {
          onSuccess: async result => {
            if (result.success) {
              setShowAddSkillDialog(false);

              // Refetch skills and check if the installed skill appears in the list
              const { data: refreshedData, error } = await refetchSkills();

              // If refetch failed, just show success (can't verify discovery)
              if (error || !refreshedData) {
                toast.success(`Skill "${result.skillName}" installed successfully (${result.filesWritten} files)`);
                return;
              }

              const installedSkillFound = refreshedData.skills.some(s => s.name === result.skillName);

              if (installedSkillFound) {
                toast.success(`Skill "${result.skillName}" installed successfully (${result.filesWritten} files)`);
              } else {
                // Skill was installed but not discovered - likely missing path config
                setHasUndiscoveredInstall(true);
                toast.warning(
                  `Skill "${result.skillName}" installed to .agents/skills but not discovered. Add .agents/skills to your workspace skills paths.`,
                );
              }
            } else {
              toast.error('Failed to install skill');
            }
          },
          onError: error => {
            toast.error(`Failed to install skill: ${error instanceof Error ? error.message : 'Unknown error'}`);
          },
        },
      );
    },
    [effectiveWorkspaceId, installSkill, refetchSkills],
  );

  const handleUpdateSkill = useCallback(
    (skillName: string) => {
      if (!effectiveWorkspaceId) return;

      setUpdatingSkillName(skillName);
      updateSkills.mutate(
        { workspaceId: effectiveWorkspaceId, skillName },
        {
          onSuccess: result => {
            setUpdatingSkillName(null);
            if (result.updated.length > 0) {
              const updated = result.updated[0];
              if (updated.success) {
                toast.success(`Skill "${skillName}" updated successfully (${updated.filesWritten} files)`);
                refetchSkills();
              } else {
                toast.error(`Failed to update skill: ${updated.error ?? 'Unknown error'}`);
              }
            } else {
              toast.error(`Failed to update skill: No update result returned`);
            }
          },
          onError: error => {
            setUpdatingSkillName(null);
            toast.error(`Failed to update skill: ${error instanceof Error ? error.message : 'Unknown error'}`);
          },
        },
      );
    },
    [effectiveWorkspaceId, updateSkills, refetchSkills],
  );

  const handleRemoveSkill = useCallback(
    (skillName: string) => {
      if (!effectiveWorkspaceId) return;

      setRemovingSkillName(skillName);
      removeSkill.mutate(
        { workspaceId: effectiveWorkspaceId, skillName },
        {
          onSuccess: result => {
            setRemovingSkillName(null);
            if (result.success) {
              toast.success(`Skill "${result.skillName}" removed successfully`);
              refetchSkills();
            } else {
              toast.error(`Failed to remove skill "${result.skillName}"`);
            }
          },
          onError: error => {
            setRemovingSkillName(null);
            toast.error(`Failed to remove skill: ${error instanceof Error ? error.message : 'Unknown error'}`);
          },
        },
      );
    },
    [effectiveWorkspaceId, removeSkill, refetchSkills],
  );

  // Compute active tab based on URL and workspace capabilities
  // If URL specifies a tab, use it only if the workspace supports it
  // Otherwise, fall back to the first available capability
  const getEffectiveTab = (): TabType => {
    if (tabFromUrl === 'files' && hasFilesystem) return 'files';
    if (tabFromUrl === 'skills' && hasSkills) return 'skills';
    // No valid tab from URL, pick the first available
    if (hasFilesystem) return 'files';
    if (hasSkills) return 'skills';
    return 'files'; // fallback
  };
  const activeTab = getEffectiveTab();

  const skills = skillsData?.skills ?? [];
  const isSkillsConfigured = skillsData?.isSkillsConfigured ?? false;
  const files = filesData?.entries ?? [];

  // Whether any search functionality is actually available
  const canSearchFiles = hasFilesystem && (canBM25 || canVector);
  const canSearchSkills = hasSkills && isSkillsConfigured && skills.length > 0;
  const hasSearchCapability = canSearchFiles || canSearchSkills;

  // If workspace v1 is not supported by the server's @mastra/core version
  if (isWorkspaceNotSupported) {
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
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="flex items-center justify-center w-16 h-16 rounded-full bg-amber-500/10 mb-6">
                <AlertTriangle className="h-8 w-8 text-amber-500" />
              </div>
              <h2 className="text-xl font-semibold text-neutral6 mb-2">Workspace Not Supported</h2>
              <p className="text-neutral4 max-w-md mb-6">
                The workspace feature requires a newer version of <code className="text-neutral5">@mastra/core</code>.
                Please upgrade your dependencies to enable workspace functionality.
              </p>
              <Button as={Link} to="https://mastra.ai/en/docs/workspace/overview" target="_blank">
                <Icon>
                  <DocsIcon />
                </Icon>
                Learn More
              </Button>
            </div>
          </div>
        </div>
      </MainContentLayout>
    );
  }

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
          {hasSearchCapability && (
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
                  <Server className="h-4 w-4 text-neutral4" />
                )}
                <span className="flex-1 text-left truncate">
                  {selectedWorkspace?.name ?? 'Select workspace'}
                  {selectedWorkspace?.source === 'agent' && selectedWorkspace.agentName && (
                    <span className="text-neutral4 ml-1">({selectedWorkspace.agentName})</span>
                  )}
                </span>
                <ChevronDown
                  className={`h-4 w-4 text-neutral4 transition-transform ${showWorkspaceDropdown ? 'rotate-180' : ''}`}
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
                        <Server className="h-4 w-4 text-neutral4 flex-shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-neutral6 truncate">{workspace.name}</div>
                        <div className="text-xs text-neutral4 truncate">
                          {workspace.source === 'agent' ? `Agent: ${workspace.agentName}` : 'Global workspace'}
                        </div>
                      </div>
                      <div className="flex gap-1 flex-shrink-0">
                        {workspace.safety?.readOnly && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400">
                            Read-only
                          </span>
                        )}
                        {workspace.capabilities.hasFilesystem && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-surface4 text-neutral4">FS</span>
                        )}
                        {workspace.capabilities.hasSandbox && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-surface4 text-neutral4">Sandbox</span>
                        )}
                        {workspace.capabilities.hasSkills && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-surface4 text-neutral4">Skills</span>
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
            <div className="flex items-center gap-2 text-sm text-neutral4">
              {selectedWorkspace.source === 'agent' ? (
                <Bot className="h-4 w-4 text-accent1" />
              ) : (
                <Server className="h-4 w-4" />
              )}
              <span>{selectedWorkspace.name}</span>
              {selectedWorkspace.source === 'agent' && selectedWorkspace.agentName && (
                <span className="text-neutral3">({selectedWorkspace.agentName})</span>
              )}
              {isReadOnly && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400">Read-only</span>
              )}
            </div>
          )}

          {/* Search Panel - keyed on workspace so hooks reset on switch */}
          {showSearch && hasSearchCapability && effectiveWorkspaceId && (
            <WorkspaceSearchPanel
              key={effectiveWorkspaceId}
              workspaceId={effectiveWorkspaceId}
              canSearchFiles={canSearchFiles}
              canSearchSkills={canSearchSkills}
              canBM25={canBM25}
              canVector={canVector}
              showInitWarning={!isLoadingInfo && workspaceInfo?.status !== 'ready'}
              onViewFileResult={id => {
                updateSearchParams({ file: id, tab: 'files' });
              }}
              onViewSkillResult={skillName => {
                if (effectiveWorkspaceId) {
                  navigate(`/workspaces/${effectiveWorkspaceId}/skills/${encodeURIComponent(skillName)}`);
                }
              }}
            />
          )}

          {/* Tab Navigation */}
          <div className="flex gap-2 border-b border-border1">
            {hasFilesystem && (
              <button
                onClick={() => setActiveTab('files')}
                className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'files'
                    ? 'border-accent1 text-neutral6'
                    : 'border-transparent text-neutral4 hover:text-neutral5'
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
                    ? 'border-accent1 text-neutral6'
                    : 'border-transparent text-neutral4 hover:text-neutral5'
                }`}
              >
                <Wand2 className="h-4 w-4" />
                Skills
                {isSkillsConfigured && skills.length > 0 && (
                  <span className="text-xs px-1.5 py-0.5 rounded bg-surface4 text-neutral4">{skills.length}</span>
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
                    error={filesError}
                    onNavigate={setCurrentPath}
                    onFileSelect={setSelectedFile}
                    onRefresh={() => refetchFiles()}
                    onCreateDirectory={
                      isReadOnly
                        ? undefined
                        : path => createDirectory.mutate({ path, workspaceId: effectiveWorkspaceId })
                    }
                    onDelete={
                      isReadOnly
                        ? undefined
                        : path =>
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
                hasUndiscoveredAgentSkills={hasUndiscoveredInstall}
                basePath={effectiveWorkspaceId ? `/workspaces/${effectiveWorkspaceId}/skills` : '/workspaces'}
                onAddSkill={canManageSkills ? () => setShowAddSkillDialog(true) : undefined}
                onUpdateSkill={canManageSkills ? handleUpdateSkill : undefined}
                onRemoveSkill={canManageSkills ? handleRemoveSkill : undefined}
                updatingSkillName={updatingSkillName ?? undefined}
                removingSkillName={removingSkillName ?? undefined}
                mountPaths={mountPaths}
              />
            )}

            {/* Show default tab if only one is available */}
            {!hasFilesystem && !hasSkills && (
              <div className="py-12 text-center text-neutral4">
                <p>No workspace capabilities are configured.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Add Skill Dialog */}
      {effectiveWorkspaceId && canManageSkills && (
        <AddSkillDialog
          open={showAddSkillDialog}
          onOpenChange={setShowAddSkillDialog}
          workspaceId={effectiveWorkspaceId}
          onInstall={handleInstallSkill}
          isInstalling={installSkill.isPending}
          // Pass precise IDs for skills with source info (format: owner/repo/name)
          installedSkillIds={skills
            .filter(s => s.skillsShSource)
            .map(s => `${s.skillsShSource!.owner}/${s.skillsShSource!.repo}/${s.name}`)}
          // Fallback to names for skills without source info
          installedSkillNames={skills.filter(s => !s.skillsShSource).map(s => s.name)}
          writableMounts={writableMounts}
          installedSkillPaths={Object.fromEntries(skills.filter(s => s.path).map(s => [s.name, s.path]))}
        />
      )}
    </MainContentLayout>
  );
}

function WorkspaceSearchPanel({
  workspaceId,
  canSearchFiles,
  canSearchSkills,
  canBM25,
  canVector,
  showInitWarning,
  onViewFileResult,
  onViewSkillResult,
}: {
  workspaceId: string;
  canSearchFiles: boolean;
  canSearchSkills: boolean;
  canBM25: boolean;
  canVector: boolean;
  showInitWarning: boolean;
  onViewFileResult: (id: string) => void;
  onViewSkillResult: (skillName: string) => void;
}) {
  const searchWorkspace = useSearchWorkspace();
  const searchSkills = useSearchWorkspaceSkills();

  return (
    <div className="border border-border1 rounded-lg p-4 bg-surface2 space-y-4">
      {canSearchFiles && (
        <div>
          <h3 className="text-sm font-medium text-neutral5 mb-3 flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Search Indexed Files
          </h3>
          {showInitWarning && (
            <p className="text-xs text-amber-400 mb-3">
              File search requires <code className="text-amber-300">workspace.init()</code> to index files from your
              configured <code className="text-amber-300">autoIndexPaths</code>.
            </p>
          )}
          <SearchWorkspacePanel
            onSearch={params => searchWorkspace.mutate({ ...params, workspaceId })}
            isSearching={searchWorkspace.isPending}
            searchResults={
              searchWorkspace.data
                ? {
                    ...searchWorkspace.data,
                    results: searchWorkspace.data.results.filter(r => !r.id.startsWith('skill:')),
                  }
                : undefined
            }
            canBM25={canBM25}
            canVector={canVector}
            onViewResult={onViewFileResult}
          />
        </div>
      )}

      {canSearchSkills && (
        <div>
          <h3 className="text-sm font-medium text-neutral5 mb-3 flex items-center gap-2">
            <Wand2 className="h-4 w-4" />
            Search Skills
          </h3>
          <SearchSkillsPanel
            onSearch={params => searchSkills.mutate({ ...params, workspaceId })}
            results={searchSkills.data?.results ?? []}
            isSearching={searchSkills.isPending}
            onResultClick={result => onViewSkillResult(result.skillName)}
          />
        </div>
      )}
    </div>
  );
}
