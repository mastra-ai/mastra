import { PageLayout } from '@mastra/playground-ui/components/PageLayout';
import { Button } from '@mastra/playground-ui/components/Button';
import { EmptyState } from '@mastra/playground-ui/components/EmptyState';
import { Notice } from '@mastra/playground-ui/components/Notice';
import { Link, useNavigate, useParams } from 'react-router';

import { useFactorySkillsQuery } from '../../hooks/useFactorySkills';
import { boardSkillPath, boardSkillsPath } from '../domains/boardConfig/boardConfigPaths';
import { NewSkillEditor } from '../domains/boardConfig/components/skills/NewSkillEditor';
import { SkillEditor } from '../domains/boardConfig/components/skills/SkillEditor';
import { SkillEditorSkeleton } from '../domains/boardConfig/components/skills/SkillEditorSkeleton';
import { useBoardConfigRoute } from '../domains/boardConfig/hooks/useBoardConfigRoute';
import { useActiveFactory } from '../domains/workspaces/components/FactoryLayout';
import { HrefLink } from '../ui/HrefLink';
import { LoadErrorState } from '../ui/LoadErrorState';

export function FactorySkillPage() {
  const factory = useActiveFactory();
  const boardId = useBoardConfigRoute()?.boardId ?? '';
  const { skillName } = useParams<{ skillName: string }>();
  const skillsPath = boardSkillsPath(factory.id, boardId);

  return (
    <PageLayout
      variant="form"
      backHref={skillsPath}
      backLabel="Skills"
      title={skillName ?? 'New skill'}
      LinkComponent={HrefLink}
    >
      <SkillPageBody factoryId={factory.id} boardId={boardId} skillName={skillName} />
    </PageLayout>
  );
}

function SkillPageBody({ factoryId, boardId, skillName }: { factoryId: string; boardId: string; skillName?: string }) {
  const navigate = useNavigate();
  const skills = useFactorySkillsQuery(factoryId);
  const skillsPath = boardSkillsPath(factoryId, boardId);

  if (skills.isPending) return <SkillEditorSkeleton />;
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
