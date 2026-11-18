import { Breadcrumb, Crumb } from '@mastra/playground-ui/components/Breadcrumb';
import { Button } from '@mastra/playground-ui/components/Button';
import { EmptyState } from '@mastra/playground-ui/components/EmptyState';
import { Notice } from '@mastra/playground-ui/components/Notice';
import { PageLayout } from '@mastra/playground-ui/components/PageLayout';
import { useSidebar } from '@mastra/playground-ui/components/Sidebar';
import { IconArrowLeft } from '@mastra/playground-ui/icons/central/IconArrowLeft';
import { cn } from '@mastra/playground-ui/utils/cn';
import { Link, NavigationType, useLocation, useNavigate, useNavigationType, useParams } from 'react-router';

import { useBoardQuery } from '../../hooks/useBoardEditor';
import { useFactorySkillsQuery } from '../../hooks/useFactorySkills';
import { useSidebarHeaderSlots } from '../domains/chat/components/useSidebarHeaderSlots';
import { boardConfigPath, boardSkillPath, boardSkillsPath } from '../domains/boardConfig/boardConfigPaths';
import { NewSkillEditor } from '../domains/boardConfig/components/skills/NewSkillEditor';
import { SkillEditor } from '../domains/boardConfig/components/skills/SkillEditor';
import { SkillEditorSkeleton } from '../domains/boardConfig/components/skills/SkillEditorSkeleton';
import { useBoardConfigRoute } from '../domains/boardConfig/hooks/useBoardConfigRoute';
import { SETTINGS_COLUMN } from '../domains/boardConfig/settingsColumn';
import { useActiveFactory } from '../domains/workspaces/components/FactoryLayout';
import { LoadErrorState } from '../ui/LoadErrorState';

export function FactorySkillPage() {
  const factory = useActiveFactory();
  const boardId = useBoardConfigRoute()?.boardId ?? '';
  const { skillName } = useParams<{ skillName: string }>();
  const navigate = useNavigate();
  const navigationType = useNavigationType();
  const { key: historyKey } = useLocation();
  const openedInApp = historyKey !== 'default' && navigationType !== NavigationType.Replace;
  const { isMobile, desktopState } = useSidebar();
  const sidebarHidden = isMobile || desktopState === 'collapsed';
  const board = useBoardQuery(factory.id, boardId).data?.board;
  const skillsPath = boardSkillsPath(factory.id, boardId);

  const goBack = () => {
    if (openedInApp) void navigate(-1);
    else void navigate(skillsPath);
  };

  const slots = useSidebarHeaderSlots({
    breadcrumbs:
      sidebarHidden && board ? (
        <Breadcrumb label="Breadcrumb" className="min-w-0 flex-1 overflow-hidden">
          <Crumb as={Link} to={boardConfigPath(factory.id, boardId)}>
            {board.name}
          </Crumb>
          <Crumb as={Link} to={skillsPath}>
            Skills
          </Crumb>
          <Crumb as="span" isCurrent>
            {skillName ?? 'New skill'}
          </Crumb>
        </Breadcrumb>
      ) : undefined,
  });

  return (
    <PageLayout {...slots}>
      <div className="sticky top-0 z-10 w-fit p-2">
        <Button variant="default" size="sm" icon={<IconArrowLeft />} onClick={goBack}>
          Back
        </Button>
      </div>
      <div className={cn(SETTINGS_COLUMN, 'flex flex-col pt-4')}>
        <SkillPageBody factoryId={factory.id} boardId={boardId} skillName={skillName} />
      </div>
    </PageLayout>
  );
}

function SkillPageBody({ factoryId, boardId, skillName }: { factoryId: string; boardId: string; skillName?: string }) {
  const navigate = useNavigate();
  const skills = useFactorySkillsQuery(factoryId);
  const skillsPath = boardSkillsPath(factoryId, boardId);

  if (skills.isPending) return <SkillEditorSkeleton toolbar={skillName !== undefined} />;
  if (skills.isLoadingError) {
    return (
      <LoadErrorState
        title="Couldn’t load skills"
        error={skills.error}
        onRetry={() => void skills.refetch()}
        retrying={skills.isFetching}
      />
    );
  }

  const canEdit = skills.data.canEdit ?? false;
  if (skillName === undefined && !canEdit) {
    return <Notice variant="info">Only organization admins can create skills.</Notice>;
  }
  if (skillName === undefined) {
    return (
      <NewSkillEditor
        key={factoryId}
        factoryId={factoryId}
        onCreated={name => void navigate(boardSkillPath(factoryId, boardId, name), { replace: true })}
      />
    );
  }
  const skill = skills.data.skills.find(candidate => candidate.name === skillName);
  if (!skill) {
    return (
      <EmptyState
        variant="fill"
        titleSlot={<span role="alert">This factory has no {skillName} skill.</span>}
        actionSlot={<Button render={<Link to={skillsPath} />}>Back to skills</Button>}
      />
    );
  }
  return (
    <SkillEditor
      key={`${factoryId}/${skill.name}`}
      factoryId={factoryId}
      skill={skill}
      canEdit={canEdit}
      onDeleted={() => void navigate(skillsPath, { replace: true })}
    />
  );
}
