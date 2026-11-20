import type { StoredSkillResponse } from '@mastra/client-js';
import { StoredSkillsPicker } from '@mastra/playground-ui/domains/skills/stored-skills-picker';
import { useFormContext } from 'react-hook-form';
import type { AgentBuilderEditFormValues } from '../../../schemas';

interface SkillsProps {
  editable?: boolean;
  availableSkills?: StoredSkillResponse[];
}

export const Skills = ({ editable = true, availableSkills = [] }: SkillsProps) => {
  const { setValue, getValues, watch } = useFormContext<AgentBuilderEditFormValues>();
  const selected = watch('skills') ?? {};

  const toggle = (id: string, next: boolean) => {
    const current = getValues('skills') ?? {};
    setValue('skills', { ...current, [id]: next }, { shouldDirty: true });
  };

  return (
    <StoredSkillsPicker
      availableSkills={availableSkills}
      selectedSkillIds={Object.keys(selected).filter(id => selected[id])}
      disabled={!editable}
      onAttach={id => toggle(id, true)}
      onRemove={id => toggle(id, false)}
    />
  );
};
