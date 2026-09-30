import { Badge } from '@mastra/playground-ui/components/Badge';
import { Button } from '@mastra/playground-ui/components/Button';
import { Combobox } from '@mastra/playground-ui/components/Combobox';
import { EmptyState } from '@mastra/playground-ui/components/EmptyState';
import { PageLayout } from '@mastra/playground-ui/components/PageLayout';
import { Spinner } from '@mastra/playground-ui/components/Spinner';
import { PermissionDenied } from '@mastra/playground-ui/domains/auth/components/permission-denied';
import { SessionExpired } from '@mastra/playground-ui/domains/auth/components/session-expired';
import { WorkspaceTreeView } from '@mastra/playground-ui/domains/workspace';
import { is401UnauthorizedError, is403ForbiddenError } from '@mastra/playground-ui/utils/errors';
import { toast } from '@mastra/playground-ui/utils/toast';
import { useQueryClient } from '@tanstack/react-query';
import { Wand2 } from 'lucide-react';
import { useState, useCallback } from 'react';
import { useSearchParams, useParams, useNavigate } from 'react-router';
import { PageBreadcrumbs } from '@/components/ui/page-breadcrumbs';
import { navCrumb } from '@/domains/navigation/crumbs';
import { isWorkspaceNotSupportedError } from '@/domains/workspace/compatibility';
import { AddSkillDialog } from '@/domains/workspace/components';
import { NoWorkspacesInfo } from '@/domains/workspace/components/no-workspaces-info';
import { WorkspaceNotConfigured } from '@/domains/workspace/components/workspace-not-configured';
import { WorkspaceNotSupported } from '@/domains/workspace/components/workspace-not-supported';
import { useInstallSkill } from '@/domains/workspace/hooks';
import {
  useWorkspaceInfo,
  useWorkspaces,
  useDeleteWorkspaceFile,
  useCreateWorkspaceDirectory,
} from '@/domains/workspace/hooks/use-workspace';
import { useWorkspaceSkills } from '@/domains/workspace/hooks/use-workspace-skills';
import type { WorkspaceItem } from '@/domains/workspace/types';

const crumbs = [navCrumb('/workspaces')];

export default function Workspace() {
  const { workspaceId: workspaceIdFromPath } = useParams<{ workspaceId?: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showAddSkillDialog, setShowAddSkillDialog] = useState(false);

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
    void navigate(`/workspaces/${id}`);
  };

  const setSelectedFile = (file: string | null) => {
    updateSearchParams({ file });
  };

  const selectedFile = fileFromUrl;

  const deleteFile = useDeleteWorkspaceFile();
  const createDirectory = useCreateWorkspaceDirectory();

  // Skills - pass workspaceId to get skills from the selected workspace
  const { data: skillsData, refetch: refetchSkills } = useWorkspaceSkills({ workspaceId: effectiveWorkspaceId });

  // Skills.sh hooks
  const installSkill = useInstallSkill();

  const isWorkspaceConfigured = workspaceInfo?.isWorkspaceConfigured ?? false;
  const hasFilesystem = workspaceInfo?.capabilities?.hasFilesystem ?? false;
  const hasSkills = workspaceInfo?.capabilities?.hasSkills ?? false;
  // Check if the selected workspace is read-only
  const isReadOnly = selectedWorkspace?.safety?.readOnly ?? false;

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
              void queryClient.invalidateQueries({ queryKey: ['workspace', effectiveWorkspaceId, 'fs'] });

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
    [effectiveWorkspaceId, installSkill, refetchSkills, queryClient],
  );

  const skills = skillsData?.skills ?? [];
  const isSkillsConfigured = skillsData?.isSkillsConfigured ?? false;

  // Whether any search functionality is actually available
  const canSearchFiles =
    hasFilesystem && Boolean(workspaceInfo?.capabilities?.canBM25 || workspaceInfo?.capabilities?.canVector);
  const canSearchSkills = hasSkills && isSkillsConfigured && skills.length > 0;

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

  const workspaceOptions = workspaces.map(workspace => ({
    value: workspace.id,
    label: workspace.name,
    description: workspace.source === 'agent' ? `Agent: ${workspace.agentName}` : 'Global workspace',
    end: (
      <span className="flex shrink-0 gap-1">
        {workspace.safety?.readOnly && (
          <Badge size="xs" variant="warning">
            Read-only
          </Badge>
        )}
        {workspace.capabilities.hasFilesystem && <Badge size="xs">FS</Badge>}
        {workspace.capabilities.hasSandbox && <Badge size="xs">Sandbox</Badge>}
        {workspace.capabilities.hasSkills && <Badge size="xs">Skills</Badge>}
      </span>
    ),
  }));

  return (
    <PageLayout
      variant="fit"
      breadcrumbs={<PageBreadcrumbs crumbs={crumbs} />}
      headerActions={
        <div className="flex items-center gap-2">
          <Combobox
            aria-label="Workspace"
            variant="ghost"
            className="w-auto"
            options={workspaceOptions}
            value={selectedWorkspace?.id}
            onValueChange={setSelectedWorkspaceId}
            placeholder="Select workspace"
            searchPlaceholder="Search workspaces..."
            emptyText="No workspaces found."
          />
          {isReadOnly && (
            <Badge size="xs" variant="warning">
              Read-only
            </Badge>
          )}
        </div>
      }
    >
      <h1 className="sr-only">Workspaces</h1>
      <div className="grid min-h-0 grid-rows-1">
        {hasFilesystem && effectiveWorkspaceId && (
          <div className="min-h-0">
            <WorkspaceTreeView
              key={effectiveWorkspaceId}
              workspaceId={effectiveWorkspaceId}
              initialFile={selectedFile ?? undefined}
              onActiveFileChange={setSelectedFile}
              readOnlyPaths={readOnlyPaths}
              searchFiles={canSearchFiles}
              searchSkills={canSearchSkills}
              onSkillSelect={({ skillName, skillPath }) =>
                void navigate(
                  `/workspaces/${effectiveWorkspaceId}/skills/${encodeURIComponent(skillName)}?path=${encodeURIComponent(skillPath)}`,
                )
              }
              onCreateDirectory={path =>
                createDirectory.mutateAsync({ path, recursive: true, workspaceId: effectiveWorkspaceId })
              }
              asideActions={
                canManageSkills ? (
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Add skill"
                    tooltip="Add skill"
                    onClick={() => setShowAddSkillDialog(true)}
                  >
                    <Wand2 />
                  </Button>
                ) : undefined
              }
              onDelete={({ path }) =>
                deleteFile.mutateAsync({ path, recursive: true, force: true, workspaceId: effectiveWorkspaceId })
              }
            />
          </div>
        )}

        {!hasFilesystem && !isLoadingInfo && (
          <div className="min-h-0">
            <EmptyState
              variant="fill"
              titleSlot="No filesystem or skills configured"
              descriptionSlot="Add a filesystem or skills to this workspace to browse its files here."
            />
          </div>
        )}
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
    </PageLayout>
  );
}
