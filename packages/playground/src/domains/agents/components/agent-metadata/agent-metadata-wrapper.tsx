export interface AgentMetadataWrapperProps {
  children: React.ReactNode;
}

export const AgentMetadataWrapper = ({ children }: AgentMetadataWrapperProps) => {
  return <div className="py-2 overflow-y-auto h-full px-5">{children}</div>;
};
