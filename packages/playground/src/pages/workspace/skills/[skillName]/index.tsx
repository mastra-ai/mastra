import { PageLayout } from '@mastra/playground-ui/components/PageLayout';
import { PermissionDenied } from '@mastra/playground-ui/components/PermissionDenied';
import { SessionExpired } from '@mastra/playground-ui/components/SessionExpired';
import { is401UnauthorizedError, is403ForbiddenError } from '@mastra/playground-ui/utils/errors';
import { useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';

import { useParams, useSearchParams } from 'react-router';

import { validateAgentId } from './validate-agent-id';
import { PageBreadcrumbs } from '@/components/ui/page-breadcrumbs';
import { decodeRouteParam, navCrumb, type CrumbDef } from '@/domains/navigation/crumbs';
import { ReferenceViewerDialog } from '@/domains/workspace/components/reference-viewer-dialog';
import { SkillDetail } from '@/domains/workspace/components/skill-detail';
import { useWorkspaceFile } from '@/domains/workspace/hooks/use-workspace';
import { useWorkspaceSkill, useWorkspaceSkillReference } from '@/domains/workspace/hooks/use-workspace-skills';

export default function WorkspaceSkillDetailPage() {
  const { skillName, workspaceId } = useParams<{ skillName: string; workspaceId: string }>();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const decodedSkillName = skillName ? decodeURIComponent(skillName) : '';

  // Optional path query param for disambiguation when multiple skills share the same name
  const skillPath = searchParams.get('path');
  const decodedSkillPath = skillPath ? decodeURIComponent(skillPath) : undefined;

  // When the page is reached from an agent (?agentId=...), swap the breadcrumb
  // from "Workspaces > workspaceId > skill" to "Agents > agentId > skill".
  // Validate the URL-provided id against the cached agents list so URL tampering
  // doesn't link to a non-existent agent. Cache may be cold on a direct visit;
  // we fall back to the workspace breadcrumb in that case.
  const agentId = searchParams.get('agentId');
  const decodedAgentId = agentId ? decodeURIComponent(agentId) : null;
  const agentsCache = queryClient.getQueriesData<Record<string, unknown>>({ queryKey: ['agents'] });
  const cachedAgents = agentsCache?.[0]?.[1] ?? null;
  const validAgentId = validateAgentId(decodedAgentId, cachedAgents);

  const crumbs = useMemo<CrumbDef[]>(
    () =>
      validAgentId
        ? [
            navCrumb('/agents'),
            { id: 'agent', label: validAgentId, to: `/agents/${encodeURIComponent(validAgentId)}` },
            { id: 'skill', label: decodedSkillName },
          ]
        : [
            navCrumb('/workspaces'),
            {
              id: 'workspace',
              label: decodeRouteParam(workspaceId),
              to: workspaceId ? `/workspaces/${encodeURIComponent(workspaceId)}` : undefined,
            },
            { id: 'skill', label: decodedSkillName },
          ],
    [validAgentId, workspaceId, decodedSkillName],
  );

  const [viewingReference, setViewingReference] = useState<string | null>(null);

  // Fetch skill details - pass workspaceId to fetch from correct workspace
  const {
    data: skill,
    isLoading,
    error,
  } = useWorkspaceSkill(decodedSkillName, { workspaceId, path: decodedSkillPath });

  // Fetch raw SKILL.md file for "Source" view
  const { data: rawSkillMdData } = useWorkspaceFile(skill?.path ? `${skill.path}/SKILL.md` : '', {
    enabled: !!skill?.path,
    workspaceId,
  });

  // Fetch reference content when viewing
  const { data: referenceData, isLoading: isLoadingReference } = useWorkspaceSkillReference(
    decodedSkillName,
    viewingReference ?? '',
    {
      enabled: !!viewingReference,
      workspaceId,
      path: decodedSkillPath,
    },
  );

  if (isLoading) {
    return (
      <PageLayout breadcrumbs={<PageBreadcrumbs crumbs={crumbs} />} className="p-4">
        <div className="grid h-full place-items-center">
          <div className="border-accent1 h-8 w-8 animate-spin rounded-full border-2 border-t-transparent" />
        </div>
      </PageLayout>
    );
  }

  // 401 check - session expired
  if (error && is401UnauthorizedError(error)) {
    return (
      <PageLayout breadcrumbs={<PageBreadcrumbs crumbs={crumbs} />} className="p-4">
        <div className="flex h-full items-center justify-center">
          <SessionExpired />
        </div>
      </PageLayout>
    );
  }

  // 403 check - permission denied for workspaces
  if (error && is403ForbiddenError(error)) {
    return (
      <PageLayout breadcrumbs={<PageBreadcrumbs crumbs={crumbs} />} className="p-4">
        <div className="flex h-full items-center justify-center">
          <PermissionDenied resource="workspaces" />
        </div>
      </PageLayout>
    );
  }

  if (error || !skill) {
    return (
      <PageLayout breadcrumbs={<PageBreadcrumbs crumbs={crumbs} />} className="p-4">
        <div className="grid h-full place-items-center">
          <div className="text-center">
            <p className="mb-2 text-red-400">Failed to load skill</p>
            <p className="text-muted-foreground text-ui-md">
              {error instanceof Error ? error.message : 'Skill not found'}
            </p>
          </div>
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout breadcrumbs={<PageBreadcrumbs crumbs={crumbs} />} className="p-4">
      <div className="grid h-full overflow-x-hidden overflow-y-auto">
        <div className="mx-auto h-full w-full max-w-[100rem] overflow-x-hidden px-[3rem] py-5">
          <SkillDetail skill={skill} rawSkillMd={rawSkillMdData?.content} onReferenceClick={setViewingReference} />
        </div>
      </div>

      <ReferenceViewerDialog
        open={!!viewingReference}
        onOpenChange={open => !open && setViewingReference(null)}
        skillName={skill.name}
        referencePath={viewingReference ?? ''}
        content={referenceData?.content}
        isLoading={isLoadingReference}
      />
    </PageLayout>
  );
}
