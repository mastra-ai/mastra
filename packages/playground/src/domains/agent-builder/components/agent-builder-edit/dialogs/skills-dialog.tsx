import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Switch,
  Txt,
} from '@mastra/playground-ui';
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[640px]">
        <DialogHeader>
          <DialogTitle>Skills</DialogTitle>
          <DialogDescription>Turn on the skills your agent should specialize in.</DialogDescription>
        </DialogHeader>
        <DialogBody>
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
                <Switch
                  checked={enabledMap[skill.id] ?? false}
                  onCheckedChange={next => toggle(skill.id, next)}
                />
              </div>
            ))}
          </div>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
};
