export interface MCPClientEditLayoutProps {
  children: React.ReactNode;
  leftSlot: React.ReactNode;
}

export const MCPClientEditLayout = ({ children, leftSlot }: MCPClientEditLayoutProps) => {
  return (
    <div className="grid overflow-hidden h-full bg-surface1 grid-cols-[1fr_2fr]">
      <div className="overflow-hidden h-full border-r border-border1 bg-surface2">{leftSlot}</div>
      <div className="overflow-y-auto h-full py-4">{children}</div>
    </div>
  );
};
