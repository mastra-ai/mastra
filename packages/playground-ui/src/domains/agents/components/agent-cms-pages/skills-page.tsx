import { useCallback, useState } from 'react';
import { useWatch } from 'react-hook-form';
import { Plus, Pencil, Trash2, Drill } from 'lucide-react';

import { SectionHeader } from '@/domains/cms';
import { ScrollArea } from '@/ds/components/ScrollArea';
import { Button } from '@/ds/components/Button';
import { Entity, EntityContent, EntityName, EntityDescription } from '@/ds/components/Entity';

import { useAgentEditFormContext } from '../../context/agent-edit-form-context';
import type { SkillFormValue } from '../agent-edit-page/utils/form-validation';
import { SkillEditDialog } from './skill-edit-dialog';
import { EmptyState } from '@/ds/components/EmptyState';

export function SkillsPage() {
  const { form, readOnly } = useAgentEditFormContext();
  const { control } = form;
  const skills = useWatch({ control, name: 'skills' }) ?? [];

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSkill, setEditingSkill] = useState<SkillFormValue | undefined>(undefined);

  const handleAdd = useCallback(() => {
    setEditingSkill(undefined);
    setDialogOpen(true);
  }, []);

  const handleEdit = useCallback((skill: SkillFormValue) => {
    setEditingSkill(skill);
    setDialogOpen(true);
  }, []);

  const handleRemove = useCallback(
    (localId: string) => {
      const next = skills.filter(s => s.localId !== localId);
      form.setValue('skills', next);
    },
    [skills, form],
  );

  const handleSave = useCallback(
    (skill: SkillFormValue) => {
      const existing = skills.findIndex(s => s.localId === skill.localId);
      if (existing >= 0) {
        const next = [...skills];
        next[existing] = skill;
        form.setValue('skills', next);
      } else {
        form.setValue('skills', [...skills, skill]);
      }
      setDialogOpen(false);
      setEditingSkill(undefined);
    },
    [skills, form],
  );

  const handleClose = useCallback(() => {
    setDialogOpen(false);
    setEditingSkill(undefined);
  }, []);

  const showAddButton = !readOnly && skills.length > 0;

  return (
    <ScrollArea className="h-full">
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <SectionHeader
            title="Skills"
            subtitle={`Give your agent specialized knowledge by using skills.${skills.length > 0 ? ` (${skills.length} configured)` : ''}`}
          />

          {showAddButton && (
            <Button variant="outline" size="sm" onClick={handleAdd}>
              <Plus className="size-3" />
              Add a skill
            </Button>
          )}
        </div>

        {skills.length > 0 && (
          <div className="flex flex-col gap-2">
            {skills.map(skill => (
              <Entity key={skill.localId} className="bg-surface2">
                <EntityContent>
                  <EntityName>{skill.name}</EntityName>
                  <EntityDescription>{skill.description || 'No description'}</EntityDescription>
                </EntityContent>

                {!readOnly && (
                  <div className="flex items-center gap-1 shrink-0">
                    <Button variant="ghost" size="sm" onClick={() => handleEdit(skill)}>
                      <Pencil className="size-3" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleRemove(skill.localId)}>
                      <Trash2 className="size-3" />
                    </Button>
                  </div>
                )}
              </Entity>
            ))}
          </div>
        )}

        {skills.length === 0 && (
          <div className="py-12">
            <EmptyState
              iconSlot={<Drill height={40} width={40} />}
              titleSlot="No skills configured yet"
              descriptionSlot="Skills are used to define the behavior of the agent. You can add a skill to get started."
              actionSlot={
                <Button variant="outline" size="sm" onClick={handleAdd}>
                  <Plus className="size-3" />
                  Add a skill
                </Button>
              }
            />
          </div>
        )}
      </div>

      <SkillEditDialog
        isOpen={dialogOpen}
        onClose={handleClose}
        onSave={handleSave}
        initialSkill={editingSkill}
        readOnly={readOnly}
      />
    </ScrollArea>
  );
}
