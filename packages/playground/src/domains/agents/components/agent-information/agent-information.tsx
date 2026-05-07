import { AgentMetadata } from '../agent-metadata';

export interface AgentInformationProps {
  agentId: string;
  threadId: string;
}

export function AgentInformation({ agentId }: AgentInformationProps) {
  return (
    <AgentInformationLayout>
      <div className="flex-1 overflow-hidden flex flex-col">
        <AgentMetadata agentId={agentId} />
      </div>
    </AgentInformationLayout>
  );
}

export interface AgentInformationLayoutProps {
  children: React.ReactNode;
}

export const AgentInformationLayout = ({ children }: AgentInformationLayoutProps) => {
  return (
    <div className="grid grid-rows-[1fr] h-full items-start overflow-y-auto overflow-x-hidden min-w-0 w-full bg-surface2">
      {children}
    </div>
  );
};
