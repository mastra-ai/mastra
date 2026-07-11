import type { StoredSkillResponse } from '@mastra/client-js';
import { Checkbox } from '@mastra/playground-ui/components/Checkbox';
import { Txt } from '@mastra/playground-ui/components/Txt';
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
    <div className="h-full min-h-0 overflow-y-auto py-2">
      {availableSkills.length === 0 ? (
        <SkillEmptyState />
      ) : (
        <ul className="flex flex-col">
          {availableSkills.map(skill => {
            const isChecked = Boolean(selected[skill.id]);

            return (
              <li key={skill.id}>
                <SkillItem skill={skill} editable={editable} onToggle={toggle} isChecked={isChecked} />
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};

interface SkillItemProps {
  skill: StoredSkillResponse;
  editable: boolean;
  onToggle: (id: string, next: boolean) => void;
  isChecked: boolean;
}

const SkillItem = ({ skill, editable, onToggle, isChecked }: SkillItemProps) => {
  return (
    <label
      className="flex cursor-pointer items-start gap-3 px-6 py-4 transition-colors hover:bg-surface2"
      aria-disabled={!editable}
    >
      <div className="mt-0.5">
        <Checkbox
          checked={isChecked}
          onCheckedChange={next => onToggle(skill.id, next === true)}
          disabled={!editable}
        />
      </div>
      <div className="flex min-w-0 flex-col">
        <Txt variant="ui-sm" className="font-medium text-neutral6">
          {skill.name}
        </Txt>
        {skill.description && (
          <Txt variant="ui-xs" className="mt-0.5 truncate text-neutral3" title={skill.description}>
            {skill.description}
          </Txt>
        )}
      </div>
    </label>
  );
};

const SkillEmptyState = () => {
  return (
    <div className="flex items-center justify-center py-12">
      <Txt variant="ui-sm" className="text-neutral3">
        No skills available in this project.
      </Txt>
    </div>
  );
};
