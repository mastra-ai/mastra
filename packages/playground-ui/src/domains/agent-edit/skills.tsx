import type { StoredSkillResponse } from '@mastra/client-js';
import { Checkbox } from '@/ds/components/Checkbox';
import { Field, FieldLabel } from '@/ds/components/Field';
import { Txt } from '@/ds/components/Txt';
import type { ReactNode } from 'react';
import { useFormContext } from 'react-hook-form';
import type { AgentEditFormValues } from './types';

export interface SkillsProps {
  editable?: boolean;
  availableSkills?: StoredSkillResponse[];
  /** Host-supplied control shown at the end of each skill row (e.g. an edit button). */
  renderSkillAction?: (skill: StoredSkillResponse) => ReactNode;
}

export const Skills = ({ editable = true, availableSkills = [], renderSkillAction }: SkillsProps) => {
  const { setValue, getValues, watch } = useFormContext<AgentEditFormValues>();
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
              <li key={skill.id} className="flex items-center gap-2 pr-2">
                <div className="min-w-0 flex-1">
                  <SkillItem skill={skill} editable={editable} onToggle={toggle} isChecked={isChecked} />
                </div>
                {renderSkillAction?.(skill)}
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
    <Field disabled={!editable}>
      <FieldLabel className="flex shrink items-start gap-3 px-4 py-4 hover:bg-fill-subtle">
        <span className="mt-0.5 flex">
          <Checkbox checked={isChecked} onCheckedChange={next => onToggle(skill.id, next === true)} />
        </span>
        <span className="flex min-w-0 flex-col">
          <Txt as="span" variant="column" tone="ink">
            {skill.name}
          </Txt>
          {skill.description && (
            <Txt as="span" variant="meta" tone="muted" className="mt-0.5 truncate" title={skill.description}>
              {skill.description}
            </Txt>
          )}
        </span>
      </FieldLabel>
    </Field>
  );
};

const SkillEmptyState = () => {
  return (
    <div className="flex items-center justify-center py-8">
      <Txt variant="caption" tone="muted">
        No skills available in this project.
      </Txt>
    </div>
  );
};
