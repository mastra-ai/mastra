import { Button } from '@mastra/playground-ui/components/Button';
import { EmptyState, EmptyStateIllustration } from '@mastra/playground-ui/components/EmptyState';
import { Popover, PopoverContent, PopoverTrigger } from '@mastra/playground-ui/components/Popover';
import { Spinner } from '@mastra/playground-ui/components/Spinner';
import { Icon } from '@mastra/playground-ui/icons/Icon';
import { Lock, Users } from 'lucide-react';
import { useId } from 'react';

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
          <Button
            variant="ghost"
            size={inHeader ? 'sm' : 'icon-sm'}
            aria-label={inHeader ? 'Private session' : `Private session: ${name}`}
            disabled={disabled}
          >
            {inHeader ? (
              <Lock />
            ) : (
              <Icon size="xs">
                <Lock />
              </Icon>
            )}
            {inHeader ? 'Private' : null}
          </Button>
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
              <Button onClick={onShare} disabled={sharing} aria-busy={sharing}>
                {sharing ? <Spinner size="sm" aria-hidden /> : <Users />}
                Share with organization
              </Button>
            ) : undefined
          }
        />
      </PopoverContent>
    </Popover>
  );
}
