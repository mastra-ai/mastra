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
} from '@mastra/playground-ui';

import { Link, useParams } from 'react-router';
import { Folder, Wand2 } from 'lucide-react';

export default function WorkspaceSkillDetailPage() {
  const { skillName } = useParams<{ skillName: string }>();
  const decodedSkillName = skillName ? decodeURIComponent(skillName) : '';

  const [viewingReference, setViewingReference] = useState<string | null>(null);

  // Fetch skill details
  const { data: skill, isLoading, error } = useWorkspaceSkill(decodedSkillName);

  // Fetch reference content when viewing
  const { data: referenceData, isLoading: isLoadingReference } = useWorkspaceSkillReference(
    decodedSkillName,
    viewingReference ?? '',
    {
      enabled: !!viewingReference,
    },
  );

  if (isLoading) {
    return (
      <MainContentLayout>
        <Header>
          <Breadcrumb>
            <Crumb as={Link} to="/workspace">
              <Icon>
                <Folder className="h-4 w-4" />
              </Icon>
              Workspace
            </Crumb>
            <Crumb as={Link} to="/workspace">
              <Icon>
                <Wand2 className="h-4 w-4" />
              </Icon>
              Skills
            </Crumb>
            <Crumb as="span" to="" isCurrent>
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
            <Crumb as={Link} to="/workspace">
              <Icon>
                <Folder className="h-4 w-4" />
              </Icon>
              Workspace
            </Crumb>
            <Crumb as={Link} to="/workspace">
              <Icon>
                <Wand2 className="h-4 w-4" />
              </Icon>
              Skills
            </Crumb>
            <Crumb as="span" to="" isCurrent>
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
          <Crumb as={Link} to="/workspace">
            <Icon>
              <Folder className="h-4 w-4" />
            </Icon>
            Workspace
          </Crumb>
          <Crumb as={Link} to="/workspace">
            <Icon>
              <Wand2 className="h-4 w-4" />
            </Icon>
            Skills
          </Crumb>
          <Crumb as="span" to="" isCurrent>
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
        content={referenceData?.content}
        isLoading={isLoadingReference}
      />
    </MainContentLayout>
  );
}
