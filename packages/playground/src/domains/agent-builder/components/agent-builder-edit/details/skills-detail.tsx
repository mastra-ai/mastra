import {
  EmptyState,
  Entity,
  EntityContent,
  EntityName,
  EntityDescription,
  IconButton,
  Skeleton,
  Switch,
  Txt,
} from '@mastra/playground-ui';
import { GraduationCapIcon, XIcon } from 'lucide-react';
import { useFormContext, useWatch } from 'react-hook-form';

import type { AgentBuilderEditFormValues } from '../../../schemas';
import { useStoredSkills } from '@/domains/agents/hooks/use-stored-skills';

interface SkillsDetailProps {
  onClose: () => void;
  editable?: boolean;
}

export const SkillsDetail = ({ onClose, editable = true }: SkillsDetailProps) => {
  const { control, setValue, getValues } = useFormContext<AgentBuilderEditFormValues>();
  const { data: storedSkillsResponse, isLoading } = useStoredSkills();
  const storedSkills = storedSkillsResponse?.skills ?? [];

  const selectedSkills = useWatch({ control, name: 'skills' }) ?? {};
  const selectedCount = Object.keys(selectedSkills).length;

  const handleToggleSkill = (skillId: string, description?: string) => {
    const currentSkills = getValues('skills') ?? {};
    const isSelected = currentSkills[skillId] !== undefined;
    if (isSelected) {
      const next = { ...currentSkills };
      delete next[skillId];
      setValue('skills', next, { shouldDirty: true });
    } else {
      setValue(
        'skills',
        {
          ...currentSkills,
          [skillId]: description ? { description } : {},
        },
        { shouldDirty: true },
      );
    }
  };

  return (
    <div className="flex h-full flex-col" data-testid="skills-detail">
      <div className="flex items-center justify-between gap-3 px-6 py-4 border-b border-border1">
        <div className="flex items-center gap-2 min-w-0">
          <GraduationCapIcon className="h-4 w-4 shrink-0 text-neutral3" />
          <Txt variant="ui-md" className="font-medium text-neutral6 truncate">
            Skills
          </Txt>
          {storedSkills.length > 0 && (
            <Txt variant="ui-xs" className="shrink-0 tabular-nums text-neutral3">
              {selectedCount} / {storedSkills.length}
            </Txt>
          )}
        </div>
        <IconButton tooltip="Close" className="rounded-full" onClick={onClose} data-testid="skills-detail-close">
          <XIcon />
        </IconButton>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-6 py-4">
        {isLoading ? (
          <div className="flex flex-col gap-2" data-testid="skills-detail-loading">
            {[0, 1, 2].map(i => (
              <Skeleton key={i} className="h-14 w-full rounded" />
            ))}
          </div>
        ) : storedSkills.length === 0 ? (
          <EmptyState
            iconSlot={<GraduationCapIcon className="size-6 text-neutral3" />}
            titleSlot="No skills in this project yet"
            descriptionSlot="You can still shape your agent with instructions and tools."
          />
        ) : (
          <div className="flex flex-col gap-2">
            {storedSkills.map(skill => (
              <Entity key={skill.id} className="bg-surface2">
                <EntityContent>
                  <EntityName>{skill.name}</EntityName>
                  <EntityDescription>{skill.description || 'No description'}</EntityDescription>
                </EntityContent>
                <Switch
                  checked={selectedSkills[skill.id] !== undefined}
                  disabled={!editable}
                  onCheckedChange={() => handleToggleSkill(skill.id, skill.description)}
                  data-testid={`skills-detail-toggle-${skill.id}`}
                />
              </Entity>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
