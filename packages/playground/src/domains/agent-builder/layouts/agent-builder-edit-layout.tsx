import { cn } from '@mastra/playground-ui';
import type { ReactNode } from 'react';

export interface AgentBuilderEditLayoutProps {
  topBar: ReactNode;
  profile: ReactNode;
  chat: ReactNode;
  /**
   * Layout variant.
   * - `'split'` (default): chat on the left, profile on the right (2-col grid on lg+).
   * - `'centered'`: chat is centered as a single column; the profile slot is not rendered.
   *
   * Callers can wrap variant changes in `startViewTransition` to crossfade between layouts.
   */
  variant?: 'split' | 'centered';
}

export const AgentBuilderEditLayout = ({ topBar, chat, profile, variant = 'split' }: AgentBuilderEditLayoutProps) => {
  const isCentered = variant === 'centered';

  return (
    <div className="h-full grid grid-rows-[auto_1fr]">
      {topBar}
      <div
        className={cn(
          'flex flex-1 min-h-0 min-w-0 flex-col pt-4 md:pb-10',
          !isCentered && 'lg:grid lg:grid-rows-1 lg:grid-cols-[1fr_2fr]',
        )}
      >
        <div
          className={cn(
            'h-full w-full min-w-0 overflow-hidden px-4 md:px-10',
            isCentered && 'lg:mx-auto lg:max-w-[80ch]',
          )}
          data-testid="agent-builder-panel-chat"
          style={{ viewTransitionName: 'agent-builder-chat-panel' }}
        >
          <div className="min-h-0 min-w-0 h-full overflow-hidden md:max-w-[80ch] md:mx-auto w-full">{chat}</div>
        </div>

        {!isCentered && (
          <div
            className={cn(
              'min-w-0 overflow-hidden',
              'flex-1 px-4 md:px-10',
              'lg:flex-none lg:h-full lg:min-h-0 lg:pl-0 lg:pr-10',
            )}
            data-testid="agent-builder-panel-profile"
            style={{ viewTransitionName: 'agent-builder-profile-panel' }}
          >
            <div className="h-full min-h-0 w-full min-w-0 overflow-hidden">{profile}</div>
          </div>
        )}
      </div>
    </div>
  );
};
