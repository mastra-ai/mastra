import { SideDialog, Switch, Txt } from '@mastra/playground-ui';
import { GraduationCapIcon } from 'lucide-react';
import { useState } from 'react';
import { skillsFixture } from '../../../fixtures';

interface SkillsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const SkillsDialog = ({ open, onOpenChange }: SkillsDialogProps) => {
  const [enabledMap, setEnabledMap] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(skillsFixture.map(s => [s.id, s.enabled])),
  );

  const toggle = (id: string, next: boolean) => setEnabledMap(prev => ({ ...prev, [id]: next }));

  return (
    <SideDialog
      isOpen={open}
      onClose={() => onOpenChange(false)}
      dialogTitle="Skills"
      dialogDescription="Turn on the skills your agent should specialize in."
      level={2}
    >
      <SideDialog.Top>
        <GraduationCapIcon className="size-4" /> Skills
      </SideDialog.Top>
      <SideDialog.Content>
        <SideDialog.Header>
          <SideDialog.Heading>
            <GraduationCapIcon /> Skills
          </SideDialog.Heading>
        </SideDialog.Header>

        <Txt variant="ui-sm" className="text-neutral3">
          Turn on the skills your agent should specialize in.
        </Txt>

        <div className="flex flex-col gap-2">
          {skillsFixture.map(skill => (
            <div
              key={skill.id}
              className="flex items-start justify-between gap-4 rounded-md border border-border1 bg-surface2 p-4"
            >
              <div className="flex flex-col gap-1">
                <Txt variant="ui-sm" className="font-medium text-neutral6">
                  {skill.name}
                </Txt>
                <Txt variant="ui-sm" className="text-neutral3">
                  {skill.description}
                </Txt>
              </div>
              <Switch checked={enabledMap[skill.id] ?? false} onCheckedChange={next => toggle(skill.id, next)} />
            </div>
          ))}
        </div>
      </SideDialog.Content>
    </SideDialog>
  );
};
