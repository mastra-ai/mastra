import type { StoredSkillResponse } from '@mastra/client-js';
import { Checkbox, Txt } from '@mastra/playground-ui';
import { useFormContext } from 'react-hook-form';
import type { AgentBuilderEditFormValues } from '../../../schemas';

interface SkillsDetailProps {
  editable?: boolean;
  availableSkills?: StoredSkillResponse[];
}

export const SkillsDetail = ({ editable = true, availableSkills = [] }: SkillsDetailProps) => {
  const { setValue, getValues, watch } = useFormContext<AgentBuilderEditFormValues>();
  const selected = watch('skills') ?? {};

  const toggle = (id: string, next: boolean) => {
    const current = getValues('skills') ?? {};
    setValue('skills', { ...current, [id]: next }, { shouldDirty: true });
  };

  return (
    <div className="h-full min-h-0 overflow-y-auto py-2">
      {availableSkills.length === 0 ? (
        <Txt variant="ui-sm" className="px-6 py-4 text-neutral3">
          No skills available in this project.
        </Txt>
      ) : (
        <ul className="flex flex-col">
          {availableSkills.map(skill => {
            const isChecked = Boolean(selected[skill.id]);
            return (
              <li key={skill.id}>
                <label
                  className="flex cursor-pointer items-start gap-3 px-6 py-4 transition-colors hover:bg-surface2"
                  aria-disabled={!editable}
                >
                  <div className="mt-0.5">
                    <Checkbox
                      variant="neutral"
                      checked={isChecked}
                      onCheckedChange={next => toggle(skill.id, next === true)}
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
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};
