import {
  Button,
  cn,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DropdownMenu,
  IconButton,
} from '@mastra/playground-ui';
import { Globe, LockIcon, MoreVerticalIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { useState } from 'react';
import { useFormContext, useWatch } from 'react-hook-form';
import type { AgentBuilderEditFormValues } from '../../schemas';
import { SlackIcon } from './slack-icon';
import type { Visibility } from './visibility-select';

export interface AgentBuilderMobileMenuProps {
  /** When true, includes the "Set visibility" item + dialog. Edit page only. */
  showSetVisibility?: boolean;
  /** When true, includes the "Publish to Slack" item. */
  showPublishToSlack?: boolean;
  /** Disables all actions (e.g. during streaming). */
  disabled?: boolean;
}

export function AgentBuilderMobileMenu({
  showSetVisibility = false,
  showPublishToSlack = true,
  disabled = false,
}: AgentBuilderMobileMenuProps) {
  const formMethods = useFormContext<AgentBuilderEditFormValues>();
  const visibility = (useWatch({ control: formMethods.control, name: 'visibility' }) ?? 'private') as Visibility;
  const [dialogOpen, setDialogOpen] = useState(false);

  if (!showSetVisibility && !showPublishToSlack) return null;

  const setVisibility = (next: Visibility) => {
    formMethods.setValue('visibility', next, { shouldDirty: true });
  };

  return (
    <div className="lg:hidden" data-testid="agent-builder-mobile-menu">
      <DropdownMenu>
        <DropdownMenu.Trigger asChild>
          <IconButton variant="ghost" tooltip="More actions" data-testid="agent-builder-mobile-menu-trigger">
            <MoreVerticalIcon />
          </IconButton>
        </DropdownMenu.Trigger>
        <DropdownMenu.Content align="end">
          {showSetVisibility && (
            <DropdownMenu.Item
              data-testid="agent-builder-mobile-menu-visibility"
              disabled={disabled}
              onSelect={event => {
                event.preventDefault();
                setDialogOpen(true);
              }}
            >
              {visibility === 'public' ? <Globe /> : <LockIcon />}
              <span>Set visibility</span>
            </DropdownMenu.Item>
          )}
          {showPublishToSlack && (
            <DropdownMenu.Item
              data-testid="agent-builder-mobile-menu-publish-slack"
              disabled={disabled}
              onSelect={() => {
                /* same no-op as PublishToSlackButton today */
              }}
            >
              <SlackIcon className="h-4 w-4" />
              <span>Publish to Slack</span>
            </DropdownMenu.Item>
          )}
        </DropdownMenu.Content>
      </DropdownMenu>

      {showSetVisibility && (
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="w-[calc(100%-2rem)]" data-testid="agent-builder-visibility-dialog">
            <DialogHeader>
              <DialogTitle>Set visibility</DialogTitle>
              <DialogDescription>Choose who can see this agent.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-2 px-6">
              <VisibilityRadioOption
                value="private"
                current={visibility}
                onSelect={setVisibility}
                icon={<LockIcon className="h-4 w-4" />}
                label="Private"
                hint="Only you can see this agent"
                testId="agent-builder-visibility-dialog-option-private"
              />
              <VisibilityRadioOption
                value="public"
                current={visibility}
                onSelect={setVisibility}
                icon={<Globe className="h-4 w-4" />}
                label="Public"
                hint="Anyone in the workspace can see this agent"
                testId="agent-builder-visibility-dialog-option-public"
              />
            </div>
            <DialogFooter className="px-6">
              <Button
                variant="default"
                onClick={() => setDialogOpen(false)}
                data-testid="agent-builder-visibility-dialog-done"
              >
                Done
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

interface VisibilityRadioOptionProps {
  value: Visibility;
  current: Visibility;
  onSelect: (value: Visibility) => void;
  icon: ReactNode;
  label: string;
  hint: string;
  testId: string;
}

function VisibilityRadioOption({ value, current, onSelect, icon, label, hint, testId }: VisibilityRadioOptionProps) {
  const selected = current === value;
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      data-testid={testId}
      onClick={() => onSelect(value)}
      className={cn(
        'flex w-full items-start gap-3 rounded-lg border px-3 py-2 text-left transition-colors',
        selected ? 'border-accent1 bg-surface4' : 'border-border1 hover:bg-surface4',
      )}
    >
      <span className="mt-0.5 text-neutral4">{icon}</span>
      <span className="flex flex-col">
        <span className="text-ui-md text-white">{label}</span>
        <span className="text-ui-sm text-neutral3">{hint}</span>
      </span>
    </button>
  );
}
