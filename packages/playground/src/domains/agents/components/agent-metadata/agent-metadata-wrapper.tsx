export interface AgentMetadataWrapperProps {
  children: React.ReactNode;
}

export const AgentMetadataWrapper = ({ children }: AgentMetadataWrapperProps) => {
  return <div className="h-full overflow-y-auto px-5 py-2">{children}</div>;
};
