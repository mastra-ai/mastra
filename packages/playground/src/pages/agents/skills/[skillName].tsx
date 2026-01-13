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
  useAgentSkill,
  useSkillReference,
} from '@mastra/playground-ui';

import { Link, useParams } from 'react-router';
import { Bot, Wand2 } from 'lucide-react';

export function AgentSkillDetailPage() {
  const { agentId, skillName } = useParams<{ agentId: string; skillName: string }>();
  const decodedAgentId = agentId ? decodeURIComponent(agentId) : '';
  const decodedSkillName = skillName ? decodeURIComponent(skillName) : '';

  const [viewingReference, setViewingReference] = useState<string | null>(null);

  // Fetch skill details from agent-specific endpoint
  const { data: skill, isLoading, error } = useAgentSkill(decodedAgentId, decodedSkillName);

  // Fetch reference content when viewing (uses global endpoint as references are shared)
  const {
    data: referenceData,
    isLoading: isLoadingReference,
    error: referenceError,
  } = useSkillReference(decodedSkillName, viewingReference ?? '', {
    enabled: !!viewingReference,
  });

  if (isLoading) {
    return (
      <MainContentLayout>
        <Header>
          <Breadcrumb>
            <Crumb as={Link} to={`/agents/${decodedAgentId}`}>
              <Icon>
                <Bot className="h-4 w-4" />
              </Icon>
              {decodedAgentId}
            </Crumb>
            <Crumb as="span" to="" isCurrent>
              <Icon>
                <Wand2 className="h-4 w-4" />
              </Icon>
              Loading...
            </Crumb>
          </Breadcrumb>
        </Header>
        <div className="grid place-items-center h-full">
          <div className="h-8 w-8 border-2 border-accent1 border-t-transparent rounded-full animate-spin" />
        </div>
      </MainContentLayout>
    );
  }

  if (error || !skill) {
    return (
      <MainContentLayout>
        <Header>
          <Breadcrumb>
            <Crumb as={Link} to={`/agents/${decodedAgentId}`}>
              <Icon>
                <Bot className="h-4 w-4" />
              </Icon>
              {decodedAgentId}
            </Crumb>
            <Crumb as="span" to="" isCurrent>
              <Icon>
                <Wand2 className="h-4 w-4" />
              </Icon>
              Error
            </Crumb>
          </Breadcrumb>
        </Header>
        <div className="grid place-items-center h-full">
          <div className="text-center">
            <p className="text-red-400 mb-2">Failed to load skill</p>
            <p className="text-sm text-icon3">{error?.message ?? 'Skill not found'}</p>
          </div>
        </div>
      </MainContentLayout>
    );
  }

  return (
    <MainContentLayout>
      <Header>
        <Breadcrumb>
          <Crumb as={Link} to={`/agents/${decodedAgentId}`}>
            <Icon>
              <Bot className="h-4 w-4" />
            </Icon>
            {decodedAgentId}
          </Crumb>
          <Crumb as="span" to="" isCurrent>
            <Icon>
              <Wand2 className="h-4 w-4" />
            </Icon>
            {decodedSkillName}
          </Crumb>
        </Breadcrumb>

        <HeaderAction>
          <Button as={Link} to="https://mastra.ai/en/docs/skills/overview" target="_blank">
            <Icon>
              <DocsIcon />
            </Icon>
            Documentation
          </Button>
        </HeaderAction>
      </Header>

      <div className="grid overflow-y-auto h-full">
        <div className="max-w-[100rem] px-[3rem] mx-auto py-8 h-full w-full">
          <SkillDetail skill={skill} onReferenceClick={setViewingReference} />
        </div>
      </div>

      <ReferenceViewerDialog
        open={!!viewingReference}
        onOpenChange={open => !open && setViewingReference(null)}
        skillName={decodedSkillName}
        referencePath={viewingReference ?? ''}
        content={referenceData?.content ?? null}
        isLoading={isLoadingReference}
        error={referenceError?.message}
      />
    </MainContentLayout>
  );
}
