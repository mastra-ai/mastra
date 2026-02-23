import { useState } from 'react';
import { useWatch } from 'react-hook-form';
import { Plus, Drill } from 'lucide-react';
import type { StoredSkillResponse } from '@mastra/client-js';

import { SectionHeader } from '@/domains/cms';
import { ScrollArea } from '@/ds/components/ScrollArea';
import { Button } from '@/ds/components/Button';
import { Entity, EntityContent, EntityName, EntityDescription } from '@/ds/components/Entity';
import { Switch } from '@/ds/components/Switch';
import { Searchbar } from '@/ds/components/Searchbar';
import { EmptyState } from '@/ds/components/EmptyState';

import { useAgentEditFormContext } from '../../context/agent-edit-form-context';
import { useStoredSkills } from '../../hooks/use-stored-skills';
import { SkillEditDialog } from './skill-edit-dialog';

export function SkillsPage() {
  const { form, readOnly } = useAgentEditFormContext();
  const { control } = form;
  const { data: storedSkillsResponse, isLoading } = useStoredSkills();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [search, setSearch] = useState('');

  const selectedSkills = useWatch({ control, name: 'skills' }) ?? {};
  const selectedSkillIds = Object.keys(selectedSkills);

  const storedSkills = storedSkillsResponse?.skills ?? [];

  const getSkillDescription = (skillId: string): string => {
    const skill = storedSkills.find(s => s.id === skillId);
    return skill?.description || '';
  };

  const handleToggleSkill = (skillId: string) => {
    const currentSkills = form.getValues('skills') ?? {};
    const isSelected = currentSkills[skillId] !== undefined;
    if (isSelected) {
      const next = { ...currentSkills };
      delete next[skillId];
      form.setValue('skills', next);
    } else {
      form.setValue('skills', {
        ...currentSkills,
        [skillId]: { description: getSkillDescription(skillId) },
      });
    }
  };

  const handleSkillCreated = (skill: StoredSkillResponse, workspaceId: string) => {
    const currentSkills = form.getValues('skills') ?? {};
    form.setValue('skills', {
      ...currentSkills,
      [skill.id]: { description: skill.description || '' },
    });
    form.setValue('workspace', { type: 'id', workspaceId });
    setDialogOpen(false);
  };

  const filteredSkills = storedSkills.filter(skill => skill.name.toLowerCase().includes(search.toLowerCase()));

  const totalCount = selectedSkillIds.length;

  return (
    <ScrollArea className="h-full">
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <SectionHeader
            title="Skills"
            subtitle={`Give your agent specialized knowledge by using skills.${totalCount > 0 ? ` (${totalCount} selected)` : ''}`}
          />

          {!readOnly && (
            <Button variant="outline" size="sm" onClick={() => setDialogOpen(true)}>
              <Plus className="size-3" />
              Add a skill
            </Button>
          )}
        </div>

        <Searchbar onSearch={setSearch} label="Search skills" placeholder="Search skills" />

        {filteredSkills.length > 0 && (
          <div className="flex flex-col gap-2">
            {filteredSkills.map(skill => (
              <Entity key={skill.id} className="bg-surface2">
                <EntityContent>
                  <EntityName>{skill.name}</EntityName>
                  <EntityDescription>{skill.description || 'No description'}</EntityDescription>
                </EntityContent>

                {!readOnly && (
                  <Switch
                    checked={selectedSkillIds.includes(skill.id)}
                    onCheckedChange={() => handleToggleSkill(skill.id)}
                  />
                )}
              </Entity>
            ))}
          </div>
        )}

        {!isLoading && storedSkills.length === 0 && (
          <div className="py-12">
            <EmptyState
              iconSlot={<Drill height={40} width={40} />}
              titleSlot="No skills available"
              descriptionSlot="Create a skill to give your agent specialized knowledge."
              actionSlot={
                !readOnly ? (
                  <Button variant="outline" size="sm" onClick={() => setDialogOpen(true)}>
                    <Plus className="size-3" />
                    Add a skill
                  </Button>
                ) : undefined
              }
            />
          </div>
        )}
      </div>

      <SkillEditDialog
        isOpen={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onSkillCreated={handleSkillCreated}
        readOnly={readOnly}
      />
    </ScrollArea>
  );
}
