export interface AgentEditLayoutProps {
  children: React.ReactNode;
  leftSlot: React.ReactNode;
}

export const AgentEditLayout = ({ children, leftSlot }: AgentEditLayoutProps) => {
  return (
    <div className="grid overflow-y-auto h-full bg-surface1 grid-cols-[1fr_2fr]">
      <div className="overflow-y-auto h-full border-r border-border1 bg-surface2">{leftSlot}</div>
      <div className="overflow-y-auto h-full py-4">{children}</div>
    </div>
  );
};
