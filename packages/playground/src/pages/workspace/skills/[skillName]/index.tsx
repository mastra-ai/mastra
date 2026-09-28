import { EmptyState } from '@mastra/playground-ui/components/EmptyState';
import { PageLayout } from '@mastra/playground-ui/components/PageLayout';
import { Spinner } from '@mastra/playground-ui/components/Spinner';
import { PermissionDenied } from '@mastra/playground-ui/domains/auth/components/permission-denied';
import { SessionExpired } from '@mastra/playground-ui/domains/auth/components/session-expired';
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
      <PageLayout variant="fit" breadcrumbs={<PageBreadcrumbs crumbs={crumbs} />}>
        <h1 className="sr-only">{skillName}</h1>
        <Spinner fill size="lg" />
      </PageLayout>
    );
  }

  // 401 check - session expired
  if (error && is401UnauthorizedError(error)) {
    return (
      <PageLayout variant="fit" breadcrumbs={<PageBreadcrumbs crumbs={crumbs} />}>
        <h1 className="sr-only">{skillName}</h1>
        <SessionExpired variant="fill" />
      </PageLayout>
    );
  }

  // 403 check - permission denied for workspaces
  if (error && is403ForbiddenError(error)) {
    return (
      <PageLayout variant="fit" breadcrumbs={<PageBreadcrumbs crumbs={crumbs} />}>
        <h1 className="sr-only">{skillName}</h1>
        <PermissionDenied variant="fill" resource="workspaces" />
      </PageLayout>
    );
  }

  if (error || !skill) {
    return (
      <PageLayout variant="fit" breadcrumbs={<PageBreadcrumbs crumbs={crumbs} />}>
        <h1 className="sr-only">{skillName}</h1>
        <EmptyState
          tone="error"
          variant="fill"
          titleSlot="Failed to load skill"
          descriptionSlot={error instanceof Error ? error.message : 'Skill not found'}
        />
      </PageLayout>
    );
  }

  return (
    <PageLayout variant="fit" breadcrumbs={<PageBreadcrumbs crumbs={crumbs} />}>
      <h1 className="sr-only">{skillName}</h1>
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
