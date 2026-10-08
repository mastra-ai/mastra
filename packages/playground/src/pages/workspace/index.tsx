import { Badge } from '@mastra/playground-ui/components/Badge';
import { Button } from '@mastra/playground-ui/components/Button';
import { EmptyState } from '@mastra/playground-ui/components/EmptyState';
import { PageLayout } from '@mastra/playground-ui/components/PageLayout';
import { Spinner } from '@mastra/playground-ui/components/Spinner';
import { PermissionDenied } from '@mastra/playground-ui/domains/auth/components/permission-denied';
import { SessionExpired } from '@mastra/playground-ui/domains/auth/components/session-expired';
import type { WorkspaceSkillInstallParams } from '@mastra/playground-ui/domains/workspace';
import { is401UnauthorizedError, is403ForbiddenError } from '@mastra/playground-ui/utils/errors';
import { toast } from '@mastra/playground-ui/utils/toast';
import {
  isWorkspaceNotSupportedError,
  useInstallSkill,
  useRemoveSkill,
  useUpdateSkills,
  useWorkspaceInfo,
  useWorkspaces,
  useDeleteWorkspaceFile,
  useCreateWorkspaceDirectory,
  useWorkspaceSkills,
} from '@mastra/react/hooks/workspace';
import type { WorkspaceItem } from '@mastra/react/hooks/workspace';
import { useQueryClient } from '@tanstack/react-query';
import { RefreshCw } from 'lucide-react';
import { useSearchParams, useParams } from 'react-router';
import { PageBreadcrumbs } from '@/components/ui/page-breadcrumbs';
import { usePermissions } from '@/domains/auth/hooks/use-permissions';
import { navCrumb } from '@/domains/navigation/crumbs';
import { NoWorkspacesInfo } from '@/domains/workspace/components/no-workspaces-info';
import { WorkspaceBrowser } from '@/domains/workspace/components/workspace-browser';
import { WorkspaceNotConfigured } from '@/domains/workspace/components/workspace-not-configured';
import { WorkspaceNotSupported } from '@/domains/workspace/components/workspace-not-supported';
import { WorkspaceNotices } from '@/domains/workspace/components/workspace-notices';

const crumbs = [navCrumb('/workspaces')];

const errorMessage = (error: unknown) =>
  is403ForbiddenError(error)
    ? "you don't have permission to modify this workspace"
    : error instanceof Error
      ? error.message
      : 'Unknown error';

export default function Workspace() {
  const { workspaceId: workspaceIdFromPath } = useParams<{ workspaceId?: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();

  // Get state from URL query params (path, file, tab are still query params)
  const fileFromUrl = searchParams.get('file');

  // List of all workspaces (global + agent workspaces) - used for workspace selector dropdown
  const { data: workspacesData, error: workspacesError, isLoading: isLoadingWorkspaces } = useWorkspaces();
  const workspaces = workspacesData?.workspaces ?? [];

  // Use workspaceId from path directly if available, otherwise fall back to first workspace from list
  const effectiveWorkspaceId = workspaceIdFromPath ?? workspaces[0]?.id;

  // Workspace info - calls /api/workspaces/:workspaceId directly
  const {
    data: workspaceInfo,
    isLoading: isLoadingInfo,
    error: workspaceInfoError,
  } = useWorkspaceInfo({ workspaceId: effectiveWorkspaceId, queryOptions: { enabled: !!effectiveWorkspaceId } });

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

  const setSelectedFile = (file: string | undefined) => {
    updateSearchParams({ file: file ?? null });
  };

  const selectedFile = fileFromUrl ?? undefined;

  const deleteFile = useDeleteWorkspaceFile();
  const createDirectory = useCreateWorkspaceDirectory();

  // Skills - pass workspaceId to get skills from the selected workspace
  const { data: skillsData, refetch: refetchSkills } = useWorkspaceSkills({
    workspaceId: effectiveWorkspaceId,
    queryOptions: { enabled: !!effectiveWorkspaceId },
  });

  // Skills.sh hooks
  const installSkill = useInstallSkill();
  const updateSkills = useUpdateSkills();
  const removeSkill = useRemoveSkill();

  // Skills installed from skills.sh live in `.agents/skills/<name>`; map a tree folder back to its skill name.
  const installedSkillName = (path: string) => {
    const match = /^\.agents\/skills\/([^/]+)$/.exec(path);
    if (!match) return undefined;
    const skill = skills.find(s => s.path?.replace(/^\.?\/+|\/+$/g, '') === path);
    return skill?.name ?? match[1];
  };

  // Re-fetches every installed skill; the whole tree is refreshed afterwards, so this lives with the header actions.
  const handleUpdateSkills = async () => {
    if (!effectiveWorkspaceId) return;
    try {
      const result = await updateSkills.mutateAsync({ workspaceId: effectiveWorkspaceId });
      const failed = result.updated.filter(u => !u.success);
      if (failed.length > 0) {
        toast.error(`Failed to update ${failed.map(u => u.skillName).join(', ')}`);
      } else {
        toast.success(`${result.updated.length} skill(s) updated`);
      }
      void queryClient.invalidateQueries({ queryKey: ['workspace', effectiveWorkspaceId, 'fs'] });
    } catch (error) {
      toast.error(`Failed to update skills: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  // Deleting an installed skill folder uninstalls the skill instead of only removing its files.
  const handleDelete = async ({ path, type }: { path: string; type: 'file' | 'directory' }) => {
    if (!effectiveWorkspaceId) return;
    const skillName = type === 'directory' ? installedSkillName(path) : undefined;
    if (!skillName) {
      try {
        await deleteFile.mutateAsync({ path, recursive: true, force: true, workspaceId: effectiveWorkspaceId });
      } catch (error) {
        toast.error(`Failed to delete ${path}: ${errorMessage(error)}`);
        throw error;
      }
      return;
    }
    try {
      const result = await removeSkill.mutateAsync({ workspaceId: effectiveWorkspaceId, skillName });
      if (!result.success) throw new Error(`Failed to remove skill "${skillName}"`);
      toast.success(`Skill "${skillName}" removed`);
      void refetchSkills();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to remove skill');
      throw error;
    }
  };

  const isWorkspaceConfigured = workspaceInfo?.isWorkspaceConfigured ?? false;
  const hasFilesystem = workspaceInfo?.capabilities?.hasFilesystem ?? false;
  const hasSkills = workspaceInfo?.capabilities?.hasSkills ?? false;
  // Check if the selected workspace is read-only
  const isReadOnly = selectedWorkspace?.safety?.readOnly ?? false;

  // Can manage skills (install/remove/check/update) if we have filesystem and not read-only
  // None of these operations require sandbox - all are done via GitHub API + filesystem
  // RBAC: actions stay hidden until permissions resolve so they never flash in and out.
  const { canEdit, canDelete, canExecute, isLoading: isLoadingPermissions } = usePermissions();
  const canWrite = !isLoadingPermissions && canEdit('workspaces') && !isReadOnly;
  const canRemove = !isLoadingPermissions && canDelete('workspaces') && !isReadOnly;
  const canSearch = !isLoadingPermissions && canExecute('workspaces');
  const canManageSkills = hasFilesystem && hasSkills && canWrite;

  // Derive writable mounts for CompositeFilesystem
  const mounts = workspaceInfo?.mounts;
  const writableMounts = mounts
    ?.filter(m => !m.readOnly)
    .map(m => ({ path: m.path, displayName: m.displayName, icon: m.icon, provider: m.provider, name: m.name }));

  const handleInstallSkill = async (params: WorkspaceSkillInstallParams) => {
    if (!effectiveWorkspaceId) return;
    try {
      const result = await installSkill.mutateAsync({ ...params, workspaceId: effectiveWorkspaceId });
      if (!result.success) throw new Error('Unknown error');
      void queryClient.invalidateQueries({ queryKey: ['workspace', effectiveWorkspaceId, 'fs'] });
      void refetchSkills();
      toast.success(`Skill "${result.skillName}" installed successfully (${result.filesWritten} files)`);
    } catch (error) {
      toast.error(`Failed to install skill: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  };

  const skills = skillsData?.skills ?? [];
  const isSkillsConfigured = skillsData?.isSkillsConfigured ?? false;

  // Whether any search functionality is actually available
  const canSearchFiles =
    canSearch &&
    hasFilesystem &&
    Boolean(workspaceInfo?.capabilities?.canBM25 || workspaceInfo?.capabilities?.canVector);
  const canSearchSkills = canSearch && hasSkills && isSkillsConfigured && skills.length > 0;

  // Mount paths are absolute (`/data`); tree paths are workspace-relative (`data`).
  const readOnlyPaths = isReadOnly
    ? ['.']
    : (mounts ?? []).filter(m => m.readOnly).map(m => m.path.replace(/^\/+|\/+$/g, '') || '.');

  // Show loading while fetching workspace list
  if (isLoadingWorkspaces) {
    return (
      <PageLayout breadcrumbs={<PageBreadcrumbs crumbs={crumbs} />}>
        <h1 className="sr-only">Workspaces</h1>
        <Spinner fill />
      </PageLayout>
    );
  }

  // If session expired (401 error)
  if (isSessionExpired) {
    return (
      <PageLayout breadcrumbs={<PageBreadcrumbs crumbs={crumbs} />}>
        <h1 className="sr-only">Workspaces</h1>
        <SessionExpired variant="fill" />
      </PageLayout>
    );
  }

  // If permission denied (403 error)
  if (isPermissionDenied) {
    return (
      <PageLayout breadcrumbs={<PageBreadcrumbs crumbs={crumbs} />}>
        <h1 className="sr-only">Workspaces</h1>
        <PermissionDenied variant="fill" resource="workspaces" />
      </PageLayout>
    );
  }

  // If workspace v1 is not supported by the server's @mastra/core version
  if (isWorkspaceNotSupported) {
    return (
      <PageLayout breadcrumbs={<PageBreadcrumbs crumbs={crumbs} />}>
        <h1 className="sr-only">Workspaces</h1>
        <WorkspaceNotSupported />
      </PageLayout>
    );
  }

  // Surface any other backend/runtime errors from workspace or workspace info requests
  const genericError = workspacesError || workspaceInfoError;
  if (genericError) {
    return (
      <PageLayout breadcrumbs={<PageBreadcrumbs crumbs={crumbs} />}>
        <h1 className="sr-only">Workspaces</h1>
        <EmptyState
          tone="error"
          variant="fill"
          titleSlot="Failed to load workspace"
          descriptionSlot={genericError.message}
        />
      </PageLayout>
    );
  }

  // If the workspace feature is configured but no workspaces exist yet, show empty state
  if (!isLoadingWorkspaces && workspaces.length === 0) {
    return (
      <PageLayout breadcrumbs={<PageBreadcrumbs crumbs={crumbs} />}>
        <h1 className="sr-only">Workspaces</h1>
        <NoWorkspacesInfo />
      </PageLayout>
    );
  }

  // If the selected workspace is not configured, show the not configured message
  // Also wait for workspaces list to load to avoid showing this before 403 is detected
  if (!isLoadingInfo && !isLoadingWorkspaces && !isWorkspaceConfigured) {
    return (
      <PageLayout breadcrumbs={<PageBreadcrumbs crumbs={crumbs} />}>
        <h1 className="sr-only">Workspaces</h1>
        <WorkspaceNotConfigured />
      </PageLayout>
    );
  }

  return (
    <PageLayout
      variant="fit"
      breadcrumbs={<PageBreadcrumbs crumbs={crumbs} />}
      headerActions={
        <div className="flex items-center gap-2">
          {isReadOnly && (
            <Badge size="xs" variant="warning">
              Read-only
            </Badge>
          )}
        </div>
      }
    >
      <h1 className="sr-only">Workspaces</h1>
      <div className="flex min-h-0 flex-col">
        {hasFilesystem && effectiveWorkspaceId && (
          <WorkspaceNotices
            workspaceId={effectiveWorkspaceId}
            showInitWarning={canSearchFiles && !isLoadingInfo && workspaceInfo?.status !== 'ready'}
            skills={hasSkills && skillsData ? skills : undefined}
          />
        )}
        {hasFilesystem && effectiveWorkspaceId && (
          <div className="min-h-0 flex-1">
            <WorkspaceBrowser
              key={effectiveWorkspaceId}
              workspaceId={effectiveWorkspaceId}
              activeFilePath={selectedFile}
              onActiveFileChange={setSelectedFile}
              readOnlyPaths={readOnlyPaths}
              skillCount={hasSkills && skillsData ? skills.length : undefined}
              searchFiles={canSearchFiles}
              searchSkills={canSearchSkills}
              onCreateDirectory={
                canWrite
                  ? async path => {
                      try {
                        await createDirectory.mutateAsync({ path, recursive: true, workspaceId: effectiveWorkspaceId });
                      } catch (error) {
                        toast.error(`Failed to create ${path}: ${errorMessage(error)}`);
                        throw error;
                      }
                    }
                  : undefined
              }
              asideActions={
                canManageSkills && skills.some(s => s.path?.includes('.agents/skills/')) ? (
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    tooltip="Update skills"
                    disabled={updateSkills.isPending}
                    onClick={() => void handleUpdateSkills()}
                  >
                    <RefreshCw className={updateSkills.isPending ? 'animate-spin' : undefined} />
                  </Button>
                ) : undefined
              }
              addSkill={
                canManageSkills
                  ? {
                      onInstall: handleInstallSkill,
                      // Precise IDs for skills with source info (owner/repo/name); names as fallback.
                      installedSkillIds: skills
                        .filter(s => s.skillsShSource)
                        .map(s => `${s.skillsShSource!.owner}/${s.skillsShSource!.repo}/${s.name}`),
                      installedSkillNames: skills.filter(s => !s.skillsShSource).map(s => s.name),
                      writableMounts,
                      installedSkillPaths: Object.fromEntries(skills.filter(s => s.path).map(s => [s.name, s.path])),
                    }
                  : undefined
              }
              onDelete={canRemove ? handleDelete : undefined}
            />
          </div>
        )}

        {!hasFilesystem && !isLoadingInfo && (
          <div className="min-h-0 flex-1">
            <EmptyState
              variant="fill"
              titleSlot="No filesystem or skills configured"
              descriptionSlot="Add a filesystem or skills to this workspace to browse its files here."
            />
          </div>
        )}
      </div>
    </PageLayout>
  );
}
