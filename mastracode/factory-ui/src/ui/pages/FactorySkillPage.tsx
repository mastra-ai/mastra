import { PageLayout } from '@mastra/playground-ui/components/PageLayout';
import { Button } from '@mastra/playground-ui/components/Button';
import { EmptyState } from '@mastra/playground-ui/components/EmptyState';
import { Notice } from '@mastra/playground-ui/components/Notice';
import { Link, useLocation, useNavigate, useParams } from 'react-router';

import { useFactorySkillsQuery } from '../../hooks/useFactorySkills';
import { NewSkillEditor } from '../domains/boardConfig/components/skills/NewSkillEditor';
import { SkillEditor } from '../domains/boardConfig/components/skills/SkillEditor';
import { SkillEditorSkeleton } from '../domains/boardConfig/components/skills/SkillEditorSkeleton';
import { SettingsHrefLink } from '../domains/settings/components/SettingsHrefLink';
import { settingsSectionPath, skillPath } from '../domains/settings/settingsSections';
import { useActiveFactory } from '../domains/workspaces/components/FactoryLayout';
import { LoadErrorState } from '../ui/LoadErrorState';

/** A skill's page or the new skill form, under Settings › Skills. */
export function FactorySkillPage() {
  const factory = useActiveFactory();
  const { skillName } = useParams<{ skillName: string }>();

  return (
    <PageLayout
      variant="form"
      backHref={settingsSectionPath(factory.id, 'skills')}
      backLabel="Skills"
      title={skillName ?? 'New skill'}
      LinkComponent={SettingsHrefLink}
    >
      <SkillPageBody factoryId={factory.id} skillName={skillName} />
    </PageLayout>
  );
}

function SkillPageBody({ factoryId, skillName }: { factoryId: string; skillName?: string }) {
  const navigate = useNavigate();
  // Moving within Settings keeps the page Settings was opened from, for Back to app.
  const { state } = useLocation();
  const skills = useFactorySkillsQuery(factoryId);
  const skillsPath = settingsSectionPath(factoryId, 'skills');

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
        onCreated={name => void navigate(skillPath(factoryId, name), { replace: true, state })}
      />
    );
  }
  const skill = skills.data.skills.find(candidate => candidate.name === skillName);
  if (!skill) {
    return (
      <EmptyState
        variant="fill"
        titleSlot={<span role="alert">This factory has no {skillName} skill.</span>}
        actionSlot={<Button render={<Link to={skillsPath} state={state} />}>Back to skills</Button>}
      />
    );
  }
  return (
    <SkillEditor
      key={`${factoryId}/${skill.name}`}
      factoryId={factoryId}
      skill={skill}
      canEdit={canEdit}
      onDeleted={() => void navigate(skillsPath, { replace: true, state })}
    />
  );
}
