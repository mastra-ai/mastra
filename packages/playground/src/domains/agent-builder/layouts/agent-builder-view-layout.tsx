import type { ReactNode } from 'react';

export interface AgentBuilderViewLayoutProps {
  topBar: ReactNode;
  chat: ReactNode;
  /** Optional browser modal overlay rendered outside the layout panels */
  browserOverlay?: ReactNode;
}

export const AgentBuilderViewLayout = ({ topBar, chat, browserOverlay }: AgentBuilderViewLayoutProps) => {
  return (
    <div className="flex flex-1 min-w-0 flex-col h-full min-h-0">
      {topBar}

      <div className="flex flex-1 min-h-0 min-w-0 flex-col py-6">
        <div className="flex flex-1 min-h-0 min-w-0 flex-col px-4 md:px-10 lg:overflow-hidden">
          <div className="h-full w-full min-w-0 overflow-hidden" data-testid="agent-builder-panel-chat">
            <div className="min-h-0 min-w-0 h-full overflow-hidden md:max-w-[80ch] md:mx-auto w-full">{chat}</div>
          </div>
        </div>
      </div>

      {browserOverlay}
    </div>
  );
};
