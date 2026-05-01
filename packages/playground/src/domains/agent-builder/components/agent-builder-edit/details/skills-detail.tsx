import type { StoredSkillResponse } from '@mastra/client-js';
import { Button, Checkbox, Txt } from '@mastra/playground-ui';
import { SparklesIcon, XIcon } from 'lucide-react';
import { useFormContext } from 'react-hook-form';
import type { AgentBuilderEditFormValues } from '../../../schemas';

interface SkillsDetailProps {
  onClose: () => void;
  editable?: boolean;
  availableSkills?: StoredSkillResponse[];
}

export const SkillsDetail = ({ onClose, editable = true, availableSkills = [] }: SkillsDetailProps) => {
  const { setValue, getValues, watch } = useFormContext<AgentBuilderEditFormValues>();
  const selected = watch('skills') ?? {};
  const activeCount = availableSkills.filter(skill => selected[skill.id]).length;

  const toggle = (id: string, next: boolean) => {
    const current = getValues('skills') ?? {};
    setValue('skills', { ...current, [id]: next }, { shouldDirty: true });
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between gap-3 px-6 py-4 border-b border-border1">
        <div className="flex items-center gap-2 min-w-0">
          <SparklesIcon className="h-4 w-4 shrink-0 text-neutral3" />
          <Txt variant="ui-md" className="font-medium text-neutral6 truncate">
            Skills
          </Txt>
          {availableSkills.length > 0 && (
            <Txt variant="ui-xs" className="shrink-0 tabular-nums text-neutral3">
              {activeCount} / {availableSkills.length}
            </Txt>
          )}
        </div>
        <Button
          size="icon-sm"
          variant="ghost"
          tooltip="Close"
          className="rounded-full"
          onClick={onClose}
          data-testid="skills-detail-close"
        >
          <XIcon />
        </Button>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto py-2">
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
    </div>
  );
};
