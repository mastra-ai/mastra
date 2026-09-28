export interface AgentEditLayoutProps {
  children: React.ReactNode;
  leftSlot: React.ReactNode;
}

export const AgentEditLayout = ({ children, leftSlot }: AgentEditLayoutProps) => {
  return (
    <div className="grid h-full grid-cols-[auto_1fr] overflow-y-auto">
      <div className="h-full overflow-y-auto border-r border-border bg-card">{leftSlot}</div>
      <div className="h-full overflow-y-auto py-4">{children}</div>
    </div>
  );
};
