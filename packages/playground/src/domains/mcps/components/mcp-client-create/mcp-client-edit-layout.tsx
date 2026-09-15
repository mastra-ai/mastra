export interface MCPClientEditLayoutProps {
  children: React.ReactNode;
  leftSlot: React.ReactNode;
}

export const MCPClientEditLayout = ({ children, leftSlot }: MCPClientEditLayoutProps) => {
  return (
    <div className="bg-surface1 grid h-full grid-cols-[1fr_2fr] overflow-hidden">
      <div className="border-border1 bg-surface2 h-full overflow-hidden border-r">{leftSlot}</div>
      <div className="h-full overflow-y-auto py-4">{children}</div>
    </div>
  );
};
