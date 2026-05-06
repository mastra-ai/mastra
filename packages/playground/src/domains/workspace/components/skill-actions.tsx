import { AlertDialog, Button } from '@mastra/playground-ui';
import { Trash2, Loader2, Download } from 'lucide-react';

export interface SkillUpdateButtonProps {
  skillName: string;
  onUpdate: () => void;
  isUpdating?: boolean;
}

/**
 * Update button for a single skill
 */
export function SkillUpdateButton({ skillName, onUpdate, isUpdating }: SkillUpdateButtonProps) {
  return (
    <Button variant="default" size="icon-sm" disabled={isUpdating} tooltip={`Update ${skillName}`} onClick={onUpdate}>
      {isUpdating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
    </Button>
  );
}

export interface SkillRemoveButtonProps {
  skillName: string;
  onRemove: () => void;
  isRemoving?: boolean;
}

/**
 * Remove button with confirmation dialog for a single skill
 */
export function SkillRemoveButton({ skillName, onRemove, isRemoving }: SkillRemoveButtonProps) {
  return (
    <AlertDialog>
      <AlertDialog.Trigger asChild>
        <Button variant="default" size="icon-sm" disabled={isRemoving} tooltip={`Remove ${skillName}`}>
          {isRemoving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
        </Button>
      </AlertDialog.Trigger>
      <AlertDialog.Content>
        <AlertDialog.Header>
          <AlertDialog.Title>Remove Skill</AlertDialog.Title>
          <AlertDialog.Description>
            Are you sure you want to remove the skill "{skillName}"? This action cannot be undone.
          </AlertDialog.Description>
        </AlertDialog.Header>
        <AlertDialog.Footer>
          <AlertDialog.Cancel>Cancel</AlertDialog.Cancel>
          <AlertDialog.Action onClick={onRemove}>Remove</AlertDialog.Action>
        </AlertDialog.Footer>
      </AlertDialog.Content>
    </AlertDialog>
  );
}
