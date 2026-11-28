import { useState } from 'react';
import { SkillCreateDialogBody } from './skill-create-dialog-body';
import type { SkillSource } from './skill-create-dialog-body';
import { SkillSaveButton } from './skill-save-button';
import type { SkillSimpleFormProps } from './skill-simple-form';
import { Button } from '@/ds/components/Button';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/ds/components/Dialog';
import { Notice } from '@/ds/components/Notice';
import { SegmentedControl, SegmentedControlItem } from '@/ds/components/SegmentedControl';

export function SkillCreateDialog({
  fields,
  pending,
  error,
  onClose,
  onCreate,
  editing = false,
}: {
  fields: SkillSimpleFormProps;
  pending: boolean;
  error?: string;
  onClose: () => void;
  onCreate: () => void;
  editing?: boolean;
}) {
  const [source, setSource] = useState<SkillSource>(editing ? 'write' : 'upload');

  return (
    <Dialog open onOpenChange={open => !open && !pending && onClose()}>
      <DialogContent size="lg" className="h-[min(80dvh,48rem)]" aria-busy={pending}>
        <DialogHeader>
          <DialogTitle>{editing ? 'Edit skill' : 'New skill'}</DialogTitle>
          <DialogDescription>
            {editing
              ? 'Changes apply to all agents using the latest version of this project skill.'
              : 'Upload a SKILL.md, or write the skill here.'}
          </DialogDescription>
          {editing ? null : (
            <SegmentedControl
              className="mt-3 self-start"
              aria-label="Start from"
              value={source}
              onValueChange={setSource}
            >
              <SegmentedControlItem value="upload">Upload</SegmentedControlItem>
              <SegmentedControlItem value="write">Write</SegmentedControlItem>
            </SegmentedControl>
          )}
        </DialogHeader>
        <DialogBody layout="fill" className="overflow-y-auto">
          <SkillCreateDialogBody
            source={source}
            fields={fields}
            onUpload={skill => {
              fields.onNameChange(skill.name);
              fields.onDescriptionChange(skill.description);
              fields.onInstructionsChange(skill.instructions);
              setSource('write');
            }}
          />
          {error && <Notice variant="warning" title={error} role="alert" />}
        </DialogBody>
        <DialogFooter>
          <Button type="button" disabled={pending} onClick={onClose}>
            Cancel
          </Button>
          <SkillSaveButton
            editing={editing}
            disabled={source === 'upload' || !fields.name.trim() || !fields.instructions.trim()}
            pending={pending}
            onSave={onCreate}
          />
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
