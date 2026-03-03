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
  SkillDetail,
  ReferenceViewerDialog,
  useWorkspaceSkill,
  useWorkspaceSkillReference,
  useWorkspaceFile,
  PermissionDenied,
  is403ForbiddenError,
} from '@mastra/playground-ui';

import { Link, useParams, useSearchParams } from 'react-router';
import { Bot, Folder, Wand2 } from 'lucide-react';

export default function WorkspaceSkillDetailPage() {
  const { skillName, workspaceId } = useParams<{ skillName: string; workspaceId: string }>();
  const [searchParams] = useSearchParams();
  const decodedSkillName = skillName ? decodeURIComponent(skillName) : '';

  // Check if we came from an agent page (for breadcrumb context)
  const agentId = searchParams.get('agentId');
  const decodedAgentId = agentId ? decodeURIComponent(agentId) : null;

  // Build back link based on context
  const backLink = decodedAgentId
    ? `/agents/${decodedAgentId}` // Back to agent
    : workspaceId
      ? `/workspaces/${workspaceId}?tab=skills` // Back to workspace skills tab
      : '/workspaces';

  const [viewingReference, setViewingReference] = useState<string | null>(null);

  // Fetch skill details - pass workspaceId to fetch from correct workspace
  const { data: skill, isLoading, error } = useWorkspaceSkill(decodedSkillName, { workspaceId });

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
    },
  );

  // Breadcrumb component based on context
  const renderBreadcrumb = (currentLabel: string) =>
    decodedAgentId ? (
      // Agent context: Agent > Skill
      <Breadcrumb>
        <Crumb as={Link} to={backLink}>
          <Icon>
            <Bot className="h-4 w-4" />
          </Icon>
          {decodedAgentId}
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
        {renderBreadcrumb(decodedSkillName)}

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
        skillName={decodedSkillName}
        referencePath={viewingReference ?? ''}
        content={referenceData?.content}
        isLoading={isLoadingReference}
      />
    </MainContentLayout>
  );
}
