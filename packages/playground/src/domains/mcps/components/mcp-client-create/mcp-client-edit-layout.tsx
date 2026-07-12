export interface MCPClientEditLayoutProps {
  children: React.ReactNode;
  leftSlot: React.ReactNode;
}

export const MCPClientEditLayout = ({ children, leftSlot }: MCPClientEditLayoutProps) => {
  return (
    <div className="grid h-full grid-cols-[1fr_2fr] overflow-hidden bg-surface1">
      <div className="h-full overflow-hidden border-r border-border1 bg-surface2">{leftSlot}</div>
      <div className="h-full overflow-y-auto py-4">{children}</div>
    </div>
  );
};
