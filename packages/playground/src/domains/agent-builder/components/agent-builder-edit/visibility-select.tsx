import {
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  toast,
} from '@mastra/playground-ui';
import { Globe, LockIcon } from 'lucide-react';
import type { ComponentProps } from 'react';
import { useState } from 'react';
import { useFormContext, useWatch } from 'react-hook-form';
import type { AgentBuilderEditFormValues } from '../../schemas';
import { useStoredAgentMutations } from '@/domains/agents/hooks/use-stored-agents';

export type Visibility = 'private' | 'public';

export interface VisibilitySelectProps {
  agentId: string;
  variant?: ComponentProps<typeof SelectTrigger>['variant'];
}

const COPY: Record<Visibility, { title: string; description: string; toast: string }> = {
  public: {
    title: 'Make this agent public?',
    description:
      'This agent will be added to your organization library. Anyone in your organization will be able to discover, view, and chat with it.',
    toast: 'Agent is now public',
  },
  private: {
    title: 'Make this agent private?',
    description:
      'This agent will be removed from your organization library. You will be the only person able to see, edit, or chat with it.',
    toast: 'Agent is now private',
  },
};

export function VisibilitySelect({ agentId, variant = 'ghost' }: VisibilitySelectProps) {
  const formMethods = useFormContext<AgentBuilderEditFormValues>();
  const value = (useWatch({ control: formMethods.control, name: 'visibility' }) ?? 'private') as Visibility;

  const { updateStoredAgent } = useStoredAgentMutations(agentId);
  const [pending, setPending] = useState<Visibility | null>(null);
  const isOpen = pending !== null;

  const handleValueChange = (next: string) => {
    const nextVisibility = next as Visibility;
    if (nextVisibility === value) return;
    setPending(nextVisibility);
  };

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
      <Select value={value} onValueChange={handleValueChange}>
        <SelectTrigger
          size="sm"
          variant={variant}
          aria-label="Visibility"
          data-testid="agent-builder-visibility-trigger"
        >
          <SelectValue placeholder="Visibility" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="private">
            <span className="flex items-center gap-2">
              <LockIcon className="h-3.5 w-3.5" />
              Private
            </span>
          </SelectItem>
          <SelectItem value="public">
            <span className="flex items-center gap-2">
              <Globe className="h-3.5 w-3.5" />
              Public
            </span>
          </SelectItem>
        </SelectContent>
      </Select>

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
