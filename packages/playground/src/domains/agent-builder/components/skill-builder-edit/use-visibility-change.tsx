import {
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  toast,
} from '@mastra/playground-ui';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { useFormContext } from 'react-hook-form';

import type { Visibility } from './visibility-select';
import type { SkillEditFormValues } from '@/domains/agent-builder/hooks/use-autosave-skill';
import { useUpdateSkill } from '@/domains/agents/hooks/use-update-skill';

const COPY: Record<Visibility, { title: string; description: string; toast: string }> = {
  public: {
    title: 'Add this skill to your library?',
    description: 'Adding this skill to the library means your teammates will be able to discover and use it.',
    toast: 'Skill added to the library',
  },
  private: {
    title: 'Remove this skill from your library?',
    description:
      'Removing this skill from the library means your teammates will no longer be able to discover or use it. You will be the only person with access.',
    toast: 'Skill removed from the library',
  },
};

export interface UseVisibilityChange {
  requestChange: (next: Visibility) => void;
  dialog: ReactNode;
}

export function useVisibilityChange(skillId: string): UseVisibilityChange {
  const formMethods = useFormContext<SkillEditFormValues>();
  const updateSkill = useUpdateSkill({ silent: true });
  const [pending, setPending] = useState<Visibility | null>(null);
  const isOpen = pending !== null;

  const handleCancel = () => {
    setPending(null);
  };

  const handleConfirm = async () => {
    if (!pending) return;
    const nextVisibility = pending;
    try {
      await updateSkill.mutateAsync({ id: skillId, visibility: nextVisibility });
      formMethods.setValue('visibility', nextVisibility, { shouldDirty: false });
      toast.success(COPY[nextVisibility].toast);
    } catch (error) {
      toast.error(`Failed to update visibility: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setPending(null);
    }
  };

  const dialogCopy = pending ? COPY[pending] : null;

  const dialog = (
    <Dialog open={isOpen} onOpenChange={open => !open && handleCancel()}>
      <DialogContent data-testid="skill-builder-visibility-confirm-dialog">
        {dialogCopy && (
          <>
            <DialogHeader>
              <DialogTitle>{dialogCopy.title}</DialogTitle>
              <DialogDescription>{dialogCopy.description}</DialogDescription>
            </DialogHeader>
            <DialogBody>
              <p className="text-sm text-muted-foreground">{dialogCopy.description}</p>
            </DialogBody>
            <DialogFooter>
              <Button
                variant="light"
                onClick={handleCancel}
                disabled={updateSkill.isPending}
                data-testid="skill-builder-visibility-confirm-cancel"
              >
                Cancel
              </Button>
              <Button
                variant="default"
                onClick={handleConfirm}
                disabled={updateSkill.isPending}
                data-testid="skill-builder-visibility-confirm-yes"
              >
                Confirm
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );

  return { requestChange: setPending, dialog };
}
