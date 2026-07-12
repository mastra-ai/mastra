import type { ReactNode } from 'react';

export interface AgentBuilderViewLayoutProps {
  topBar: ReactNode;
  chat: ReactNode;
  /** Optional browser modal overlay rendered outside the layout panels */
  browserOverlay?: ReactNode;
}

export const AgentBuilderViewLayout = ({ topBar, chat, browserOverlay }: AgentBuilderViewLayoutProps) => {
  return (
    <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col">
      {topBar}

      <div
        className="min-h-0 w-full min-w-0 flex-1 overflow-hidden px-4 pt-10 pb-4 md:mx-auto md:max-w-[80ch] md:px-10 md:pt-4 md:pb-10"
        data-testid="agent-builder-panel-chat"
      >
        {chat}
      </div>

      {browserOverlay}
    </div>
  );
};
