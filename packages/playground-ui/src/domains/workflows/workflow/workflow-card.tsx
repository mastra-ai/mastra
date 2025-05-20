export interface WorkflowCardProps {
  header: React.ReactNode;
  children?: React.ReactNode;
  footer?: React.ReactNode;
}

export const WorkflowCard = ({ header, children, footer }: WorkflowCardProps) => {
  return (
    <div className="rounded-lg border-sm border-border1 bg-surface4">
      <div className="py-1 px-2 flex items-center gap-3">{header}</div>
      {children && <div className="border-t-sm border-border1">{children}</div>}
      {footer && <div className="py-1 px-2 border-t-sm border-border1">{footer}</div>}
    </div>
  );
};
