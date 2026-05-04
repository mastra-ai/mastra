import {
  Button,
  cn,
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DropdownMenu,
  StatusBadge,
  toast,
} from '@mastra/playground-ui';
import { Globe, LockIcon, MoreVerticalIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { useState } from 'react';
import { useFormContext, useWatch } from 'react-hook-form';
import type { AgentBuilderEditFormValues } from '../../schemas';
import { ChannelDialog } from './publish-channel-dialogs';
import type { Visibility } from './visibility-select';
import { PlatformIcon } from '@/domains/agents/components/agent-channels/platform-icons';
import {
  useChannelInstallations,
  useChannelPlatforms,
  useConnectChannel,
} from '@/domains/agents/hooks/use-channels';
import type { ChannelInstallationInfo, ChannelPlatformInfo } from '@/domains/agents/hooks/use-channels';

export interface AgentBuilderMobileMenuProps {
  /** Agent the publish actions apply to. */
  agentId?: string;
  /** When true, includes the "Set visibility" item + dialog. Edit page only. */
  showSetVisibility?: boolean;
  /** When true, includes the per-channel publish items. */
  showPublishToChannel?: boolean;
  /** Disables all actions (e.g. during streaming). */
  disabled?: boolean;
}

export function AgentBuilderMobileMenu({
  agentId,
  showSetVisibility = false,
  showPublishToChannel = true,
  disabled = false,
}: AgentBuilderMobileMenuProps) {
  const formMethods = useFormContext<AgentBuilderEditFormValues>();
  const visibility = (useWatch({ control: formMethods.control, name: 'visibility' }) ?? 'private') as Visibility;
  const [dialogOpen, setDialogOpen] = useState(false);
  const [activeChannel, setActiveChannel] = useState<{
    platform: ChannelPlatformInfo;
    installation?: ChannelInstallationInfo;
  } | null>(null);

  const canPublishToChannel = showPublishToChannel && Boolean(agentId);
  const { data: platforms = [] } = useChannelPlatforms();
  const platformsToShow = canPublishToChannel ? platforms : [];

  if (!showSetVisibility && (!canPublishToChannel || platformsToShow.length === 0)) return null;

  const setVisibility = (next: Visibility) => {
    formMethods.setValue('visibility', next, { shouldDirty: true });
  };

  return (
    <div className="lg:hidden" data-testid="agent-builder-mobile-menu">
      <DropdownMenu>
        <DropdownMenu.Trigger asChild>
          <Button size="icon-sm" variant="ghost" tooltip="More actions" data-testid="agent-builder-mobile-menu-trigger">
            <MoreVerticalIcon />
          </Button>
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
          {canPublishToChannel && platformsToShow.length > 0 && (
            <>
              {showSetVisibility && <DropdownMenu.Separator />}
              <DropdownMenu.Label>Publish to…</DropdownMenu.Label>
              {platformsToShow.map(platform => (
                <MobileMenuChannelItem
                  key={platform.id}
                  platform={platform}
                  agentId={agentId as string}
                  disabled={disabled}
                  onSelect={installation => setActiveChannel({ platform, installation })}
                />
              ))}
            </>
          )}
        </DropdownMenu.Content>
      </DropdownMenu>

      {showSetVisibility && (
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent data-testid="agent-builder-visibility-dialog">
            <DialogHeader>
              <DialogTitle>Set visibility</DialogTitle>
              <DialogDescription>Choose who can see this agent.</DialogDescription>
            </DialogHeader>
            <DialogBody className="grid gap-2">
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
            </DialogBody>
            <DialogFooter>
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

      {activeChannel && agentId ? (
        <ChannelDialog
          platform={activeChannel.platform}
          agentId={agentId}
          installation={activeChannel.installation}
          open
          onOpenChange={open => {
            if (!open) setActiveChannel(null);
          }}
        />
      ) : null}
    </div>
  );
}

interface MobileMenuChannelItemProps {
  platform: ChannelPlatformInfo;
  agentId: string;
  disabled: boolean;
  onSelect: (installation: ChannelInstallationInfo | undefined) => void;
}

function MobileMenuChannelItem({ platform, agentId, disabled, onSelect }: MobileMenuChannelItemProps) {
  const { data: installations = [] } = useChannelInstallations(platform.id, agentId);
  const installation = installations.find(i => i.status === 'active');
  const { mutate: connect, isPending: isConnecting } = useConnectChannel(platform.id);

  // Slack-specific shortcut: when the platform is configured but not yet
  // connected, the dialog adds nothing — the user's intent ("connect Slack")
  // is unambiguous from the menu item itself, so kick off the OAuth flow
  // directly instead of opening the dialog.
  const shouldDirectConnect = platform.id === 'slack' && platform.isConfigured && !installation;

  const handleSelect = (event: Event) => {
    event.preventDefault();

    if (!shouldDirectConnect) {
      onSelect(installation);
      return;
    }

    connect(
      { agentId },
      {
        onSuccess: result => {
          if (result.type === 'oauth') {
            window.location.href = result.authorizationUrl;
            return;
          }
          if (result.type === 'deep_link') {
            const popup = window.open(result.url, '_blank', 'noopener,noreferrer');
            if (!popup) {
              toast.error('Popup blocked — please allow popups and try again');
            }
          }
          // 'immediate' → installation list will be invalidated by the hook;
          // no further UI action needed.
        },
        onError: (err: Error & { body?: { error?: string } }) => {
          toast.error(err.body?.error || err.message || 'Failed to connect channel');
        },
      },
    );
  };

  return (
    <DropdownMenu.Item
      data-testid={`agent-builder-mobile-menu-publish-channel-${platform.id}`}
      disabled={disabled || isConnecting}
      onSelect={handleSelect}
    >
      <PlatformIcon platform={platform.id} className="h-4 w-4" />
      <span className="flex-1">{platform.name}</span>
      {!platform.isConfigured ? (
        <StatusBadge variant="warning" size="sm">
          Not configured
        </StatusBadge>
      ) : installation ? (
        <StatusBadge variant="success" size="sm">
          Connected
        </StatusBadge>
      ) : null}
    </DropdownMenu.Item>
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
