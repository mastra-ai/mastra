import {
  Breadcrumb,
  Button,
  Crumb,
  DocsIcon,
  Header,
  HeaderAction,
  Icon,
  MainContentLayout,
  PermissionDenied,
  SessionExpired,
  is401UnauthorizedError,
  is403ForbiddenError,
} from '@mastra/playground-ui';
import { useQueryClient } from '@tanstack/react-query';
import { Bot, Folder, Wand2 } from 'lucide-react';
import { useState } from 'react';

import { Link, useParams, useSearchParams } from 'react-router';

import { validateAgentId } from './validate-agent-id';
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

  // Check if we came from an agent page (for breadcrumb context)
  const agentId = searchParams.get('agentId');
  const decodedAgentId = agentId ? decodeURIComponent(agentId) : null;

  // Validate agentId against cached agent list (no extra API call).
  // If the cache is cold (e.g. direct URL visit) or the ID doesn't match,
  // we fall back to the workspace breadcrumb.
  // Note: getQueriesData matches all queries starting with ['agents'] (across requestContext variants).
  // We take the first match, which is acceptable since agent IDs are globally unique.
  const agentsCache = queryClient.getQueriesData<Record<string, unknown>>({ queryKey: ['agents'] });
  const cachedAgents = agentsCache?.[0]?.[1] ?? null;
  const validAgentId = validateAgentId(decodedAgentId, cachedAgents);

  // Build back link based on context
  const backLink = validAgentId
    ? `/agents/${validAgentId}` // Back to agent
    : workspaceId
      ? `/workspaces/${workspaceId}?tab=skills` // Back to workspace skills tab
      : '/workspaces';

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

  // Breadcrumb component based on context
  const renderBreadcrumb = (currentLabel: string) =>
    validAgentId ? (
      // Agent context: Agent > Skill
      <Breadcrumb>
        <Crumb as={Link} to={backLink}>
          <Icon>
            <Bot className="h-4 w-4" />
          </Icon>
          {validAgentId}
        </Crumb>
        <Crumb as="span" to="" isCurrent>
          <Icon>
            <Wand2 className="h-4 w-4" />
          </Icon>
          {currentLabel}
        </Crumb>
      </Breadcrumb>
    ) : (
      // Workspace context: Workspace > Skills > Skill
      <Breadcrumb>
        <Crumb as={Link} to={backLink}>
          <Icon>
            <Folder className="h-4 w-4" />
          </Icon>
          Workspace
        </Crumb>
        <Crumb as={Link} to={backLink}>
          <Icon>
            <Wand2 className="h-4 w-4" />
          </Icon>
          Skills
        </Crumb>
        <Crumb as="span" to="" isCurrent>
          {currentLabel}
        </Crumb>
      </Breadcrumb>
    );

  if (isLoading) {
    return (
      <MainContentLayout>
        <Header>{renderBreadcrumb('Loading...')}</Header>
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
        <Header>{renderBreadcrumb('Session Expired')}</Header>
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
        <Header>{renderBreadcrumb('Permission Denied')}</Header>
        <div className="flex h-full items-center justify-center">
          <PermissionDenied resource="workspaces" />
        </div>
      </MainContentLayout>
    );
  }

  if (error || !skill) {
    return (
      <MainContentLayout>
        <Header>{renderBreadcrumb('Error')}</Header>
        <div className="grid place-items-center h-full">
          <div className="text-center">
            <p className="text-red-400 mb-2">Failed to load skill</p>
            <p className="text-sm text-neutral3">{error?.message ?? 'Skill not found'}</p>
          </div>
        </div>
      </MainContentLayout>
    );
  }

  return (
    <MainContentLayout>
      <Header>
        {renderBreadcrumb(skill.name)}

        <HeaderAction>
          <Button as={Link} to="https://mastra.ai/en/docs/workspace/skills" target="_blank">
            <Icon>
              <DocsIcon />
            </Icon>
            Documentation
          </Button>
        </HeaderAction>
      </Header>

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
