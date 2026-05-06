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
import { Globe, LockIcon } from 'lucide-react';
import { useState } from 'react';
import { useFormContext, useWatch } from 'react-hook-form';
import type { AgentBuilderEditFormValues } from '../../schemas';
import { useStoredAgentMutations } from '@/domains/agents/hooks/use-stored-agents';

export type Visibility = 'private' | 'public';

export interface VisibilitySelectProps {
  agentId: string;
}

const COPY: Record<Visibility, { title: string; description: string; toast: string }> = {
  public: {
    title: 'Add this agent to your library?',
    description:
      'Adding this agent to the library means your teammates will be able to discover, view, and chat with it.',
    toast: 'Agent added to the library',
  },
  private: {
    title: 'Remove this agent from your library?',
    description:
      'Removing this agent from the library means your teammates will no longer be able to discover, view, or chat with it. You will be the only person with access.',
    toast: 'Agent removed from the library',
  },
};

export function VisibilitySelect({ agentId }: VisibilitySelectProps) {
  const formMethods = useFormContext<AgentBuilderEditFormValues>();
  const value = (useWatch({ control: formMethods.control, name: 'visibility' }) ?? 'private') as Visibility;

  const { updateStoredAgent } = useStoredAgentMutations(agentId);
  const [pending, setPending] = useState<Visibility | null>(null);
  const isOpen = pending !== null;

  const handleCancel = () => {
    setPending(null);
  };

  const handleConfirm = async () => {
    if (!pending) return;
    const nextVisibility = pending;
    try {
      await updateStoredAgent.mutateAsync({ visibility: nextVisibility });
      formMethods.setValue('visibility', nextVisibility, { shouldDirty: false });
      toast.success(COPY[nextVisibility].toast);
    } catch (error) {
      toast.error(`Failed to update visibility: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setPending(null);
    }
  };

  const dialogCopy = pending ? COPY[pending] : null;

  return (
    <>
      {value === 'private' ? (
        <Button
          size="sm"
          variant="default"
          onClick={() => setPending('public')}
          data-testid="agent-builder-visibility-add"
        >
          <Globe className="h-3.5 w-3.5" />
          Add to library
        </Button>
      ) : (
        <Button
          size="sm"
          variant="ghost"
          onClick={() => setPending('private')}
          data-testid="agent-builder-visibility-remove"
        >
          <LockIcon className="h-3.5 w-3.5" />
          Remove from library
        </Button>
      )}

      <Dialog open={isOpen} onOpenChange={open => !open && handleCancel()}>
        <DialogContent data-testid="agent-builder-visibility-confirm-dialog">
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
                  disabled={updateStoredAgent.isPending}
                  data-testid="agent-builder-visibility-confirm-cancel"
                >
                  Cancel
                </Button>
                <Button
                  variant="default"
                  onClick={handleConfirm}
                  disabled={updateStoredAgent.isPending}
                  data-testid="agent-builder-visibility-confirm-yes"
                >
                  Confirm
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
