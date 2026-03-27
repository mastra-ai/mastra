export interface DataDetailsPanelContentProps {
  children: React.ReactNode;
}

export function DataDetailsPanelContent({ children }: DataDetailsPanelContentProps) {
  return <div className="flex-1 overflow-y-auto">{children}</div>;
}
