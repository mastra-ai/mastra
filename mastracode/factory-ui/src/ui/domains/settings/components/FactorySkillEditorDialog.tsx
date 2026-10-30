import {
  Dialog,
  DialogBody,
  DialogCancel,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@mastra/playground-ui/components/Dialog';
import { Button } from '@mastra/playground-ui/components/Button';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { SkillSimpleForm } from '@mastra/playground-ui/domains/skills/skill-simple-form';
import { useState } from 'react';

import type { FactorySkillInfo } from '../../../../api/types';

interface FactorySkillEditorDialogProps {
  skill: FactorySkillInfo;
  onClose: () => void;
}

/**
 * Opens a Factory skill in the shared skill editor. Edits stay local to the
 * dialog and are discarded on close: saving Factory skills is not supported yet.
 */
export function FactorySkillEditorDialog({ skill, onClose }: FactorySkillEditorDialogProps) {
  const [name, setName] = useState(skill.name);
  const [description, setDescription] = useState(skill.description);
  const [instructions, setInstructions] = useState(skill.content);

  return (
    <Dialog open onOpenChange={open => !open && onClose()}>
      <DialogContent size="xl">
        <DialogHeader>
          <DialogTitle>Edit skill</DialogTitle>
          <DialogDescription>
            Changes stay in this editor and are discarded when you close it. Saving Factory skills is not available yet.
          </DialogDescription>
        </DialogHeader>
        <DialogBody>
          <div className="flex h-[60vh] flex-col">
            <SkillSimpleForm
              name={name}
              onNameChange={setName}
              description={description}
              onDescriptionChange={setDescription}
              instructions={instructions}
              onInstructionsChange={setInstructions}
            />
          </div>
        </DialogBody>
        <DialogFooter>
          <Txt as="span" variant="caption" tone="muted" className="mr-auto">
            Saving is not available yet
          </Txt>
          <DialogCancel>Cancel</DialogCancel>
          <Button variant="primary" disabled>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
