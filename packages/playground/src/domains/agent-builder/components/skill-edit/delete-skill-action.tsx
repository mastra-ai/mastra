import { AlertDialog } from '@mastra/playground-ui/components/AlertDialog';
import { Button } from '@mastra/playground-ui/components/Button';
import { DropdownMenu } from '@mastra/playground-ui/components/DropdownMenu';
import { toast } from '@mastra/playground-ui/utils/toast';
import { Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useDeleteSkill } from '@/domains/agent-builder/hooks/use-delete-skill';

interface UseDeleteSkillActionParams {
  skillId: string;
}

const useDeleteSkillAction = ({ skillId }: UseDeleteSkillActionParams) => {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const deleteSkill = useDeleteSkill(skillId);

  const confirm = async () => {
    try {
      await deleteSkill.mutateAsync();
      toast.success('Skill deleted');
      setOpen(false);
      void navigate('/agent-builder/skills', { viewTransition: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete skill');
    }
  };

  return {
    open,
    setOpen,
    isPending: deleteSkill.isPending,
    confirm,
  };
};

interface DeleteSkillDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  skillName: string;
  isPending: boolean;
  onConfirm: () => void;
}

const DeleteSkillDialog = ({ open, onOpenChange, skillName, isPending, onConfirm }: DeleteSkillDialogProps) => (
  <AlertDialog open={open} onOpenChange={onOpenChange}>
    <AlertDialog.Content data-testid="skill-builder-delete-skill-dialog">
      <AlertDialog.Header>
        <AlertDialog.Title>Delete skill?</AlertDialog.Title>
        <AlertDialog.Description>
          This permanently deletes &quot;{skillName}&quot;. This cannot be undone.
        </AlertDialog.Description>
      </AlertDialog.Header>
      <AlertDialog.Footer>
        <AlertDialog.Cancel data-testid="skill-builder-delete-skill-cancel" disabled={isPending}>
          Cancel
        </AlertDialog.Cancel>
        <Button
          variant="primary"
          data-testid="skill-builder-delete-skill-confirm"
          disabled={isPending}
          onClick={() => {
            // Use a plain button (not AlertDialog.Close) so the dialog stays
            // open while the request is in flight and on error.
            onConfirm();
          }}
        >
          {isPending ? 'Deleting…' : 'Delete skill'}
        </Button>
      </AlertDialog.Footer>
    </AlertDialog.Content>
  </AlertDialog>
);

interface DeleteSkillEntryProps {
  skillId: string;
  skillName: string;
  disabled?: boolean;
}

export const DeleteSkillPanelButton = ({ skillId, skillName, disabled = false }: DeleteSkillEntryProps) => {
  const { open, setOpen, isPending, confirm } = useDeleteSkillAction({ skillId });

  return (
    <>
      <Button
        size="lg"
        variant="default"
        onClick={() => setOpen(true)}
        disabled={disabled || isPending}
        className="w-full"
        data-testid="skill-builder-delete-skill"
      >
        <Trash2 />
        <span>Delete skill</span>
      </Button>
      <DeleteSkillDialog
        open={open}
        onOpenChange={setOpen}
        skillName={skillName}
        isPending={isPending}
        onConfirm={confirm}
      />
    </>
  );
};

export const DeleteSkillMenuItem = ({ skillId, skillName, disabled = false }: DeleteSkillEntryProps) => {
  const { open, setOpen, isPending, confirm } = useDeleteSkillAction({ skillId });

  return (
    <>
      <DropdownMenu.Item
        data-testid="skill-builder-mobile-menu-delete"
        disabled={disabled}
        className="text-red-500 focus:text-red-400"
        onSelect={event => {
          event.preventDefault();
          setOpen(true);
        }}
      >
        <Trash2 />
        <span>Delete skill</span>
      </DropdownMenu.Item>
      <DeleteSkillDialog
        open={open}
        onOpenChange={setOpen}
        skillName={skillName}
        isPending={isPending}
        onConfirm={confirm}
      />
    </>
  );
};
