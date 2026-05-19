import { cn } from '@mastra/playground-ui';
import type { ReactNode } from 'react';

export interface AgentBuilderEditLayoutProps {
  topBar: ReactNode;
  profile: ReactNode;
  chat: ReactNode;
}

export const AgentBuilderEditLayout = ({ topBar, chat, profile }: AgentBuilderEditLayoutProps) => {
  return (
    <div className={cn('flex flex-1 min-h-0 min-w-0 flex-col', 'lg:grid lg:grid-rows-1 lg:grid-cols-2')}>
      <div className="flex flex-1 min-h-0 min-w-0 flex-col lg:overflow-hidden ">
        {topBar}
        <div
          className="h-full w-full min-w-0 overflow-hidden py-6 px-4 md:px-10"
          data-testid="agent-builder-panel-chat"
        >
          <div className="min-h-0 min-w-0 h-full overflow-hidden md:max-w-[80ch] md:mx-auto w-full">{chat}</div>
        </div>
      </div>

      <div
        className={cn(
          'min-w-0 overflow-hidden',
          'flex-1 px-4 md:px-10 py-6',
          'lg:flex-none lg:h-full lg:min-h-0 lg:pl-0 lg:pr-10',
        )}
        data-testid="agent-builder-panel-profile"
      >
        <div className="h-full min-h-0 w-full min-w-0 overflow-hidden">{profile}</div>
      </div>
    </div>
  );
};
