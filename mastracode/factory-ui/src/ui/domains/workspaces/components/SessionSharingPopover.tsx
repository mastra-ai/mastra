import { Button } from '@mastra/playground-ui/components/Button';
import { EmptyState, EmptyStateIllustration } from '@mastra/playground-ui/components/EmptyState';
import { Popover, PopoverContent, PopoverTrigger } from '@mastra/playground-ui/components/Popover';
import { Sidebar } from '@mastra/playground-ui/components/Sidebar';
import { Spinner } from '@mastra/playground-ui/components/Spinner';
import { Icon } from '@mastra/playground-ui/icons/Icon';
import { useId } from 'react';
import { IconLock } from '@mastra/playground-ui/icons/central/IconLock';
import { IconUserDuo } from '@mastra/playground-ui/icons/central/IconUserDuo';

/** Private-session entry point shared by the sidebar and session header. */
export function SessionSharingPopover({
  name,
  placement = 'sidebar',
  disabled,
  onShare,
  sharing,
}: {
  name: string;
  placement?: 'sidebar' | 'header';
  disabled?: boolean;
  onShare?: () => void;
  sharing?: boolean;
}) {
  const titleId = useId();
  const inHeader = placement === 'header';

  return (
    <Popover>
      <PopoverTrigger
        render={
          inHeader ? (
            <Button variant="ghost" size="sm" aria-label="Private session" disabled={disabled}>
              <IconLock />
              Private
            </Button>
          ) : (
            <Sidebar.NavAction aria-label={`Private session: ${name}`} disabled={disabled}>
              <Icon size="xs">
                <IconLock />
              </Icon>
            </Sidebar.NavAction>
          )
        }
      />
      <PopoverContent align="end" aria-labelledby={titleId}>
        <EmptyState
          iconSlot={<EmptyStateIllustration name="locked" />}
          titleSlot={<span id={titleId}>This session is private</span>}
          descriptionSlot={
            onShare
              ? 'Only you can see this session. Share it to let anyone in your organization view and continue the conversation.'
              : 'Only you can see this session.'
          }
          actionSlot={
            onShare ? (
              <Button onClick={onShare} disabled={disabled || sharing} aria-busy={sharing}>
                {sharing ? <Spinner size="sm" aria-hidden /> : <IconUserDuo />}
                Share with organization
              </Button>
            ) : undefined
          }
        />
      </PopoverContent>
    </Popover>
  );
}
