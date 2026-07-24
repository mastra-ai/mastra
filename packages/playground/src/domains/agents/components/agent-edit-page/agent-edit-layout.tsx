export interface AgentEditLayoutProps {
  children: React.ReactNode;
  leftSlot: React.ReactNode;
}

export const AgentEditLayout = ({ children, leftSlot }: AgentEditLayoutProps) => {
  return (
    <div className="grid overflow-y-auto h-full grid-cols-[auto_1fr]">
      <div className="overflow-y-auto h-full border-r border-border1 bg-surface3">{leftSlot}</div>
      <div className="overflow-y-auto h-full py-4">{children}</div>
    </div>
  );
};
