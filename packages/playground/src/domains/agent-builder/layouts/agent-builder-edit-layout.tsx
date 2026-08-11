import { cn } from '@mastra/playground-ui/utils/cn';
import type { ReactNode } from 'react';

export interface AgentBuilderEditLayoutProps {
  topBar: ReactNode;
  profile: ReactNode;
  chat: ReactNode;
  /**
   * Optional content rendered inside the chat column, below the chat itself.
   * Mobile-only: hidden at lg+ so it never shifts the desktop composer.
   * Aligned to the same max-width as the chat composer.
   */
  chatFooter?: ReactNode;
  /**
   * Layout variant.
   * - `'split'` (default): chat on the left, profile on the right (2-col grid on lg+).
   * - `'centered'`: chat is centered as a single column; the profile slot is not rendered.
   *
   * Callers can wrap variant changes in `startViewTransition` to crossfade between layouts.
   */
  variant?: 'split' | 'centered';
  /**
   * When true and variant is `'split'`, the chat column is hidden on mobile
   * (visible at `lg+`). The chat React subtree stays mounted to preserve state
   * when the viewport changes.
   */
  hideMobileChat?: boolean;
}

export const AgentBuilderEditLayout = ({
  topBar,
  chat,
  chatFooter,
  profile,
  variant = 'split',
  hideMobileChat = false,
}: AgentBuilderEditLayoutProps) => {
  const isCentered = variant === 'centered';
  const applyMobileChatHide = hideMobileChat && !isCentered;

  return (
    <div className="grid h-full grid-rows-[auto_1fr]">
      {topBar}
      <div
        className={cn(
          'flex flex-1 min-h-0 min-w-0 flex-col pt-4 pb-4 md:pb-10',
          !isCentered && 'lg:grid lg:grid-rows-1 lg:grid-cols-[1fr_2fr]',
        )}
      >
        <div
          className={cn(
            'h-full w-full min-w-0 overflow-hidden px-4 md:px-10',
            isCentered && 'lg:mx-auto lg:max-w-[80ch]',
            applyMobileChatHide && 'hidden lg:block',
          )}
          data-testid="agent-builder-panel-chat"
          style={{ viewTransitionName: 'agent-builder-chat-panel' }}
        >
          <div className="grid h-full min-h-0 w-full min-w-0 grid-rows-[1fr_auto] overflow-hidden md:mx-auto md:max-w-[80ch]">
            <div className="h-full min-h-0 min-w-0 overflow-hidden">{chat}</div>
            {chatFooter ? (
              <div data-testid="agent-builder-chat-footer" className="w-full pt-3 lg:hidden">
                {chatFooter}
              </div>
            ) : null}
          </div>
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
