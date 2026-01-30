import { RefreshCw, Trash2, Loader2 } from 'lucide-react';
import { Button } from '@/ds/components/Button';
import { Icon } from '@/ds/icons/Icon';
import { IconButton } from '@/ds/components/IconButton';
import { AlertDialog } from '@/ds/components/AlertDialog';

export interface SkillActionsHeaderProps {
  onCheckUpdates?: () => void;
  onUpdateAll?: () => void;
  isCheckingUpdates?: boolean;
  isUpdating?: boolean;
}

/**
 * Header actions for the skills table (Check Updates, Update All)
 */
export function SkillActionsHeader({
  onCheckUpdates,
  onUpdateAll,
  isCheckingUpdates,
  isUpdating,
}: SkillActionsHeaderProps) {
  return (
    <div className="flex items-center gap-2">
      {onCheckUpdates && (
        <Button variant="light" size="sm" onClick={onCheckUpdates} disabled={isCheckingUpdates || isUpdating}>
          {isCheckingUpdates ? (
            <Icon>
              <Loader2 className="h-4 w-4 animate-spin" />
            </Icon>
          ) : (
            <Icon>
              <RefreshCw className="h-4 w-4" />
            </Icon>
          )}
          Check Updates
        </Button>
      )}
      {onUpdateAll && (
        <Button variant="light" size="sm" onClick={onUpdateAll} disabled={isUpdating || isCheckingUpdates}>
          {isUpdating ? (
            <Icon>
              <Loader2 className="h-4 w-4 animate-spin" />
            </Icon>
          ) : (
            <Icon>
              <RefreshCw className="h-4 w-4" />
            </Icon>
          )}
          Update All
        </Button>
      )}
    </div>
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
        <IconButton
          variant="light"
          size="sm"
          disabled={isRemoving}
          tooltip={`Remove ${skillName}`}
        >
          {isRemoving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
        </IconButton>
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
