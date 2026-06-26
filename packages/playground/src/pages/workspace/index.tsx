import { CollapsiblePanel, PanelSeparator, is401UnauthorizedError, is403ForbiddenError } from '@mastra/playground-ui';
import { Badge } from '@mastra/playground-ui/components/Badge';
import { Button } from '@mastra/playground-ui/components/Button';
import { ErrorState } from '@mastra/playground-ui/components/ErrorState';
import { NoDataPageLayout, PageLayout } from '@mastra/playground-ui/components/PageLayout';
import { PermissionDenied } from '@mastra/playground-ui/components/PermissionDenied';
import { SessionExpired } from '@mastra/playground-ui/components/SessionExpired';
import { Skeleton } from '@mastra/playground-ui/components/Skeleton';
import { Spinner } from '@mastra/playground-ui/components/Spinner';
import { AgentIcon } from '@mastra/playground-ui/icons/AgentIcon';
import { toast } from '@mastra/playground-ui/utils/toast';
import { FileText, Wand2, Search, X } from 'lucide-react';
import { useState, useCallback, useEffect, useMemo } from 'react';
import { Group, Panel, useDefaultLayout } from 'react-resizable-panels';
import { useSearchParams, useParams, useNavigate } from 'react-router';
import { isWorkspaceNotSupportedError } from '@/domains/workspace/compatibility';
import { AddSkillDialog, FileBrowser, FileViewer, SkillDetail, SkillsTable } from '@/domains/workspace/components';
import { NoWorkspacesInfo } from '@/domains/workspace/components/no-workspaces-info';
import { SearchWorkspacePanel, SearchSkillsPanel } from '@/domains/workspace/components/search-panel';
import { WorkspaceNotConfigured } from '@/domains/workspace/components/workspace-not-configured';
import { WorkspaceNotSupported } from '@/domains/workspace/components/workspace-not-supported';
import { useInstallSkill, useUpdateSkills, useRemoveSkill } from '@/domains/workspace/hooks';
import {
  useWorkspaceInfo,
  useWorkspaces,
  useSearchWorkspace,
  useWorkspaceFile,
  useWorkspaceFiles,
  useCreateWorkspaceDirectory,
  useDeleteWorkspaceFile,
} from '@/domains/workspace/hooks/use-workspace';
import {
  useWorkspaceSkill,
  useWorkspaceSkills,
  useSearchWorkspaceSkills,
} from '@/domains/workspace/hooks/use-workspace-skills';
import type { SkillMetadata, WorkspaceItem } from '@/domains/workspace/types';
import { useLinkComponent } from '@/lib/framework';
import { navCrumb } from '@/lib/nav';
import type { CrumbDef } from '@/lib/route-header';
import { RouteHeaderCrumbs } from '@/lib/route-header';

/**
 * Resolve a skill search result to the actual file path inside the workspace.
 * `skillPath` is the skill directory and `source` is the matched file relative
 * to it (e.g. `SKILL.md` or `references/foo.md`), so the file viewer needs both
 * joined together. Opening the bare directory path would render a blank page.
 */
function skillResultFilePath(skillPath: string, source: string): string {
  const dir = skillPath.replace(/\/+$/, '');
  const file = source.replace(/^\/+/, '');
  return file ? `${dir}/${file}` : dir;
}

export default function Workspace() {
  const { workspaceId: workspaceIdFromPath } = useParams<{ workspaceId?: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { paths, Link } = useLinkComponent();
  const [showSearch, setShowSearch] = useState(false);
  const [showAddSkillDialog, setShowAddSkillDialog] = useState(false);
  const [removingSkillName, setRemovingSkillName] = useState<string | null>(null);
  const [updatingSkillName, setUpdatingSkillName] = useState<string | null>(null);
  // Track if we installed a skill that wasn't discovered (client-side only, resets on refresh)
  const [hasUndiscoveredInstall, setHasUndiscoveredInstall] = useState(false);

  // Get state from URL query params. A skill's SKILL.md opens the rich skill
  // view; every other file opens in the plain viewer. Skill folders just expand.
  const fileFromUrl = searchParams.get('file');

  // List of all workspaces (global + agent workspaces) - used for workspace metadata lookup
  const { data: workspacesData, error: workspacesError, isLoading: isLoadingWorkspaces } = useWorkspaces();
  const workspaces = workspacesData?.workspaces ?? [];

  // The editor only renders for an explicit :workspaceId. Without one, send the user to the list.
  const effectiveWorkspaceId = workspaceIdFromPath;

  useEffect(() => {
    if (!workspaceIdFromPath) {
      void navigate('/workspaces', { replace: true });
    }
  }, [workspaceIdFromPath, navigate]);

  // Workspace info - calls /api/workspaces/:workspaceId directly
  const {
    data: workspaceInfo,
    isLoading: isLoadingInfo,
    error: workspaceInfoError,
  } = useWorkspaceInfo(effectiveWorkspaceId);

  // Check if 401 unauthorized (session expired)
  const isSessionExpired = is401UnauthorizedError(workspacesError) || is401UnauthorizedError(workspaceInfoError);

  // Check if 403 forbidden (permission denied)
  const isPermissionDenied = is403ForbiddenError(workspacesError) || is403ForbiddenError(workspaceInfoError);

  // Check if workspaces are not supported (501 error from server)
  const isWorkspaceNotSupported =
    isWorkspaceNotSupportedError(workspacesError) || isWorkspaceNotSupportedError(workspaceInfoError);

  // Get the selected workspace metadata from the list (for displaying name, capabilities badge, etc.)
  const selectedWorkspace: WorkspaceItem | undefined = effectiveWorkspaceId
    ? workspaces.find(w => w.id === effectiveWorkspaceId)
    : undefined;

  // Show "Workspaces > <workspace name>" in the route header. The name comes from
  // fetched data so it can't live in the static route handle; override it here.
  // While the name is still loading, render a skeleton crumb instead of the id.
  const workspaceName = workspaceInfo?.name ?? selectedWorkspace?.name;
  const isLoadingWorkspaceName = !workspaceName && (isLoadingInfo || isLoadingWorkspaces);
  const workspaceCrumbs = useMemo<CrumbDef[] | null>(() => {
    if (!effectiveWorkspaceId) return null;
    const leaf: CrumbDef = workspaceName
      ? { id: 'workspace', label: workspaceName }
      : isLoadingWorkspaceName
        ? { id: 'workspace', heading: 'Workspace', node: <Skeleton className="h-4 w-24" /> }
        : { id: 'workspace', label: effectiveWorkspaceId };
    return [navCrumb('/workspaces'), leaf];
  }, [effectiveWorkspaceId, workspaceName, isLoadingWorkspaceName]);

  const { defaultLayout: defaultFilesLayout, onLayoutChange: onFilesLayoutChange } = useDefaultLayout({
    id: `workspace-files-layout-${effectiveWorkspaceId ?? 'default'}`,
    storage: localStorage,
  });

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

  const setSelectedFile = (file: string | null) => {
    updateSearchParams({ file });
  };

  // Use URL-derived values
  const selectedFile = fileFromUrl;

  // Skills - pass workspaceId to get skills from the selected workspace.
  const {
    data: skillsData,
    isLoading: isLoadingSkills,
    refetch: refetchSkills,
  } = useWorkspaceSkills({ workspaceId: effectiveWorkspaceId });
  const skills = skillsData?.skills ?? [];
  const isSkillsConfigured = skillsData?.isSkillsConfigured ?? false;

  // Map skill directory paths → metadata so the tree can mark skill folders and
  // the editor pane can render a skill's SKILL.md as the rich skill view.
  const skillByPath = useMemo(() => {
    const map = new Map<string, SkillMetadata>();
    for (const skill of skillsData?.skills ?? []) {
      if (skill.path) map.set(skill.path.replace(/\/+$/, ''), skill);
    }
    return map;
  }, [skillsData?.skills]);
  const skillPaths = useMemo(() => new Set(skillByPath.keys()), [skillByPath]);

  // Opening a skill's SKILL.md shows the rich skill view; any other file opens
  // in the plain viewer.
  const selectedSkill = useMemo(() => {
    if (!selectedFile) return undefined;
    const dir = selectedFile.replace(/\/+$/, '').replace(/\/SKILL\.md$/i, '');
    return dir !== selectedFile.replace(/\/+$/, '') ? skillByPath.get(dir) : undefined;
  }, [selectedFile, skillByPath]);

  // Selected file content - plain files only; a skill's SKILL.md uses the skill view.
  const { data: fileContent, isLoading: isLoadingFileContent } = useWorkspaceFile(selectedFile ?? '', {
    enabled: !!selectedFile && !selectedSkill,
    workspaceId: effectiveWorkspaceId,
  });

  // Full skill details, fetched only when a skill's SKILL.md is open.
  const { data: skillDetail, isLoading: isLoadingSkillDetail } = useWorkspaceSkill(selectedSkill?.name ?? '', {
    enabled: !!selectedSkill,
    workspaceId: effectiveWorkspaceId,
    path: selectedSkill?.path,
  });

  // Full file tree, loaded eagerly with a single recursive listing.
  const {
    data: filesData,
    isLoading: isLoadingFiles,
    error: filesError,
    refetch: refetchFiles,
  } = useWorkspaceFiles('.', {
    recursive: true,
    workspaceId: effectiveWorkspaceId,
    enabled: workspaceInfo?.capabilities?.hasFilesystem ?? false,
  });
  const createDirectory = useCreateWorkspaceDirectory();
  const deleteFile = useDeleteWorkspaceFile();

  const handleCreateDirectory = useCallback(
    (path: string) => {
      createDirectory.mutate({ path, workspaceId: effectiveWorkspaceId }, { onSuccess: () => void refetchFiles() });
    },
    [createDirectory, effectiveWorkspaceId, refetchFiles],
  );

  const handleDeleteFile = useCallback(
    (path: string) => {
      deleteFile.mutate(
        { path, recursive: true, force: true, workspaceId: effectiveWorkspaceId },
        { onSuccess: () => void refetchFiles() },
      );
    },
    [deleteFile, effectiveWorkspaceId, refetchFiles],
  );

  // Skills.sh hooks
  const installSkill = useInstallSkill();
  const updateSkills = useUpdateSkills();
  const removeSkill = useRemoveSkill();

  const isWorkspaceConfigured = workspaceInfo?.isWorkspaceConfigured ?? false;
  const hasFilesystem = workspaceInfo?.capabilities?.hasFilesystem ?? false;
  const hasSkills = workspaceInfo?.capabilities?.hasSkills ?? false;
  const canBM25 = workspaceInfo?.capabilities?.canBM25 ?? false;
  const canVector = workspaceInfo?.capabilities?.canVector ?? false;
  // Check if the selected workspace is read-only. Prefer the authoritative
  // by-id info response (always loaded on this page for `effectiveWorkspaceId`)
  // over the workspaces list entry, which can be missing or stale on a
  // deep-link to `/workspaces/:id`.
  const isReadOnly = workspaceInfo?.safety?.readOnly ?? selectedWorkspace?.safety?.readOnly ?? false;

  // Can manage skills (install/remove/check/update) if we have filesystem and not read-only
  // None of these operations require sandbox - all are done via GitHub API + filesystem
  const canManageSkills = hasFilesystem && !isReadOnly;

  // Derive writable mounts for CompositeFilesystem
  const mounts = workspaceInfo?.mounts;
  const writableMounts = mounts
    ?.filter(m => !m.readOnly)
    .map(m => ({ path: m.path, displayName: m.displayName, icon: m.icon, provider: m.provider, name: m.name }));

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

              // Reload the file tree so the newly installed skill folder shows up without a manual refresh
              void refetchFiles();

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
    [effectiveWorkspaceId, installSkill, refetchFiles, refetchSkills],
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
                void refetchSkills();
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
              void refetchSkills();
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

  // Whether any search functionality is actually available
  const canSearchFiles = hasFilesystem && (canBM25 || canVector);
  const canSearchSkills = hasSkills && isSkillsConfigured && skills.length > 0;
  const hasSearchCapability = canSearchFiles || canSearchSkills;
  const isSearchActive = showSearch && hasSearchCapability && Boolean(effectiveWorkspaceId);

  // Show loading while fetching workspace list
  if (isLoadingWorkspaces) {
    return (
      <NoDataPageLayout>
        <Spinner />
      </NoDataPageLayout>
    );
  }

  // If session expired (401 error)
  if (isSessionExpired) {
    return (
      <NoDataPageLayout>
        <SessionExpired />
      </NoDataPageLayout>
    );
  }

  // If permission denied (403 error)
  if (isPermissionDenied) {
    return (
      <NoDataPageLayout>
        <PermissionDenied resource="workspaces" />
      </NoDataPageLayout>
    );
  }

  // If workspace v1 is not supported by the server's @mastra/core version
  if (isWorkspaceNotSupported) {
    return (
      <NoDataPageLayout>
        <WorkspaceNotSupported />
      </NoDataPageLayout>
    );
  }

  // Surface any other backend/runtime errors from workspace or workspace info requests
  const genericError = workspacesError || workspaceInfoError;
  if (genericError) {
    return (
      <NoDataPageLayout>
        <ErrorState title="Failed to load workspace" message={(genericError as Error).message} />
      </NoDataPageLayout>
    );
  }

  // If the workspace feature is configured but no workspaces exist yet, show empty state
  if (!isLoadingWorkspaces && workspaces.length === 0) {
    return (
      <NoDataPageLayout>
        <NoWorkspacesInfo />
      </NoDataPageLayout>
    );
  }

  // If the selected workspace is not configured, show the not configured message
  // Also wait for workspaces list to load to avoid showing this before 403 is detected
  if (!isLoadingInfo && !isLoadingWorkspaces && !isWorkspaceConfigured) {
    return (
      <NoDataPageLayout>
        <WorkspaceNotConfigured />
      </NoDataPageLayout>
    );
  }

  // Attached entity (e.g. the owning agent) shown at the bottom of the sidebar,
  // linking back to the entity itself.
  const attachedEntity =
    selectedWorkspace?.source === 'agent' && selectedWorkspace.agentName ? (
      <div className="border-t border-border1 p-3">
        {selectedWorkspace.agentId ? (
          <Link href={paths.agentLink(selectedWorkspace.agentId)} className="inline-block">
            <Badge icon={<AgentIcon />}>{selectedWorkspace.agentName}</Badge>
          </Link>
        ) : (
          <Badge icon={<AgentIcon />}>{selectedWorkspace.agentName}</Badge>
        )}
      </div>
    ) : null;

  return (
    <PageLayout width="wide" height="full" className="grid-rows-[1fr] p-0">
      {workspaceCrumbs && <RouteHeaderCrumbs crumbs={workspaceCrumbs} />}
      <PageLayout.MainArea className="min-h-0 flex flex-col gap-6 overflow-hidden">
        {hasFilesystem && (
          <Group
            className="relative h-full min-h-0 w-full min-w-0 overflow-hidden"
            defaultLayout={defaultFilesLayout}
            onLayoutChange={onFilesLayoutChange}
          >
            {/* Left rail — swaps between the file tree and the search view, VS Code style. */}
            <CollapsiblePanel
              direction="left"
              id="workspace-file-tree"
              minSize={200}
              maxSize="50%"
              defaultSize={320}
              collapsedSize={60}
              collapsible={true}
              className="flex min-w-0 flex-col overflow-hidden border-r border-surface5 bg-surface1"
            >
              <div className="min-h-0 flex-1 overflow-auto">
                {isSearchActive ? (
                  <WorkspaceSearchView
                    key={effectiveWorkspaceId}
                    workspaceId={effectiveWorkspaceId!}
                    canSearchFiles={canSearchFiles}
                    canSearchSkills={canSearchSkills}
                    canBM25={canBM25}
                    canVector={canVector}
                    showInitWarning={!isLoadingInfo && workspaceInfo?.status !== 'ready'}
                    onClose={() => setShowSearch(false)}
                    onViewFileResult={id => {
                      updateSearchParams({ file: id });
                    }}
                    onViewSkillResult={(_skillName, skillPath, source) => {
                      updateSearchParams({ file: skillResultFilePath(skillPath, source) });
                    }}
                  />
                ) : (
                  <FileBrowser
                    entries={filesData?.entries ?? []}
                    currentPath="."
                    isLoading={isLoadingFiles}
                    error={filesError instanceof Error ? filesError : null}
                    onNavigate={() => undefined}
                    onFileSelect={setSelectedFile}
                    selectedPath={selectedFile ?? undefined}
                    skillPaths={skillPaths}
                    onRefresh={() => void refetchFiles()}
                    onCreateDirectory={isReadOnly ? undefined : handleCreateDirectory}
                    onDelete={isReadOnly ? undefined : handleDeleteFile}
                    onAddSkill={canManageSkills ? () => setShowAddSkillDialog(true) : undefined}
                    onToggleSearch={hasSearchCapability ? () => setShowSearch(true) : undefined}
                    isCreatingDirectory={createDirectory.isPending}
                    isDeleting={deleteFile.isPending}
                  />
                )}
              </div>
              {attachedEntity}
            </CollapsiblePanel>
            <PanelSeparator />
            {/* Right pane — rich skill view (a skill's SKILL.md), file viewer, or empty. */}
            <Panel id="workspace-file-preview" className="flex min-w-0 flex-col overflow-hidden bg-surface1">
              <div className="min-h-0 min-w-0 flex-1 overflow-auto">
                {selectedSkill ? (
                  isLoadingSkillDetail || !skillDetail ? (
                    <div className="flex h-full items-center justify-center">
                      <Spinner />
                    </div>
                  ) : (
                    <div className="w-full min-w-0 max-w-4xl px-8 py-8">
                      <SkillDetail
                        skill={skillDetail}
                        onReferenceClick={ref => setSelectedFile(skillResultFilePath(selectedSkill.path, ref))}
                      />
                    </div>
                  )
                ) : selectedFile ? (
                  <FileViewer
                    path={selectedFile}
                    content={fileContent?.content ?? ''}
                    isLoading={isLoadingFileContent}
                    mimeType={fileContent?.mimeType}
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-sm text-neutral4">
                    Select a file to preview its contents
                  </div>
                )}
              </div>
            </Panel>
          </Group>
        )}

        {!hasFilesystem && hasSkills && isSearchActive && (
          <div className="min-h-0 flex-1 overflow-auto">
            <WorkspaceSearchView
              key={effectiveWorkspaceId}
              workspaceId={effectiveWorkspaceId!}
              canSearchFiles={canSearchFiles}
              canSearchSkills={canSearchSkills}
              canBM25={canBM25}
              canVector={canVector}
              showInitWarning={!isLoadingInfo && workspaceInfo?.status !== 'ready'}
              onViewFileResult={id => {
                updateSearchParams({ file: id });
                setShowSearch(false);
              }}
              onViewSkillResult={(skillName, skillPath) => {
                if (effectiveWorkspaceId) {
                  void navigate(
                    `/workspaces/${effectiveWorkspaceId}/skills/${encodeURIComponent(skillName)}?path=${encodeURIComponent(skillPath)}`,
                  );
                }
              }}
              onClose={() => setShowSearch(false)}
            />
          </div>
        )}

        {!hasFilesystem && hasSkills && !isSearchActive && (
          <>
            {hasSearchCapability && (
              <div className="flex items-center justify-end gap-2">
                <Button
                  onClick={() => setShowSearch(!showSearch)}
                  aria-label="Search workspace"
                  aria-pressed={showSearch}
                >
                  <Search />
                  Search
                </Button>
              </div>
            )}
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
            />
          </>
        )}

        {!hasFilesystem && !hasSkills && !isLoadingInfo && (
          <div className="py-12 text-center text-neutral4">
            <p>No workspace capabilities are configured.</p>
          </div>
        )}
      </PageLayout.MainArea>

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
    </PageLayout>
  );
}

function WorkspaceSearchView({
  workspaceId,
  canSearchFiles,
  canSearchSkills,
  canBM25,
  canVector,
  showInitWarning,
  onViewFileResult,
  onViewSkillResult,
  onClose,
}: {
  workspaceId: string;
  canSearchFiles: boolean;
  canSearchSkills: boolean;
  canBM25: boolean;
  canVector: boolean;
  showInitWarning: boolean;
  onViewFileResult: (id: string) => void;
  onViewSkillResult: (skillName: string, skillPath: string, source: string) => void;
  onClose?: () => void;
}) {
  const searchWorkspace = useSearchWorkspace();
  const searchSkills = useSearchWorkspaceSkills();

  return (
    <div className="flex h-full min-w-0 flex-col">
      {/* Header — mirrors the file tree header so the rail swap feels seamless. */}
      <div className="flex h-12 shrink-0 items-center justify-between border-b border-border1 bg-surface3 px-4">
        <div className="flex items-center gap-2 text-sm font-medium text-neutral6">
          <Search className="h-4 w-4 text-neutral4" />
          <span>Search</span>
        </div>
        {onClose && (
          <Button variant="ghost" size="icon-md" onClick={onClose} tooltip="Close search" aria-label="Close search">
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      <div className="min-h-0 flex-1 space-y-4 overflow-auto p-4">
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
              onResultClick={result => onViewSkillResult(result.skillName, result.skillPath, result.source)}
            />
          </div>
        )}
      </div>
    </div>
  );
}
