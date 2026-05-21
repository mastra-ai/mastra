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

      <div
        className="h-full w-full min-w-0 overflow-hidden px-4 md:px-10 md:max-w-[80ch] md:mx-auto w-full pb-10"
        data-testid="agent-builder-panel-chat"
      >
        {chat}
      </div>

      {browserOverlay}
    </div>
  );
};
