import { MainContentLayout } from '@mastra/playground-ui/components/MainContent';
import { PermissionDenied } from '@mastra/playground-ui/components/PermissionDenied';
import { SessionExpired } from '@mastra/playground-ui/components/SessionExpired';
import { is401UnauthorizedError, is403ForbiddenError } from '@mastra/playground-ui/utils/errors';
import { useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';

import { useParams, useSearchParams } from 'react-router';

import { validateAgentId } from './validate-agent-id';
import { ReferenceViewerDialog } from '@/domains/workspace/components/reference-viewer-dialog';
import { SkillDetail } from '@/domains/workspace/components/skill-detail';
import { useWorkspaceFile } from '@/domains/workspace/hooks/use-workspace';
import { useWorkspaceSkill, useWorkspaceSkillReference } from '@/domains/workspace/hooks/use-workspace-skills';
import { navCrumb } from '@/lib/nav';
import { RouteHeaderCrumbs } from '@/lib/route-header';
import type { CrumbDef } from '@/lib/route-header';

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

  const agentCrumbs = useMemo<CrumbDef[] | null>(
    () =>
      validAgentId
        ? [
            navCrumb('/agents'),
            { id: 'agent', label: validAgentId, to: `/agents/${encodeURIComponent(validAgentId)}` },
            { id: 'skill', label: decodedSkillName },
          ]
        : null,
    [validAgentId, decodedSkillName],
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
      <MainContentLayout>
        {agentCrumbs && <RouteHeaderCrumbs crumbs={agentCrumbs} />}
        <div className="grid place-items-center h-full">
          <div className="h-8 w-8 border-2 border-accent1 border-t-transparent rounded-full animate-spin" />
        </div>
      </MainContentLayout>
    );
  }

  // 401 check - session expired
  if (error && is401UnauthorizedError(error)) {
    return (
      <MainContentLayout>
        {agentCrumbs && <RouteHeaderCrumbs crumbs={agentCrumbs} />}
        <div className="flex h-full items-center justify-center">
          <SessionExpired />
        </div>
      </MainContentLayout>
    );
  }

  // 403 check - permission denied for workspaces
  if (error && is403ForbiddenError(error)) {
    return (
      <MainContentLayout>
        {agentCrumbs && <RouteHeaderCrumbs crumbs={agentCrumbs} />}
        <div className="flex h-full items-center justify-center">
          <PermissionDenied resource="workspaces" />
        </div>
      </MainContentLayout>
    );
  }

  if (error || !skill) {
    return (
      <MainContentLayout>
        {agentCrumbs && <RouteHeaderCrumbs crumbs={agentCrumbs} />}
        <div className="grid place-items-center h-full">
          <div className="text-center">
            <p className="text-red-400 mb-2">Failed to load skill</p>
            <p className="text-sm text-neutral3">{error instanceof Error ? error.message : 'Skill not found'}</p>
          </div>
        </div>
      </MainContentLayout>
    );
  }

  return (
    <MainContentLayout>
      {agentCrumbs && <RouteHeaderCrumbs crumbs={agentCrumbs} />}
      <div className="grid overflow-y-auto overflow-x-hidden h-full">
        <div className="max-w-[100rem] px-[3rem] mx-auto py-8 h-full w-full overflow-x-hidden">
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
    </MainContentLayout>
  );
}
