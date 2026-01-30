import { cn } from '@/lib/utils';

export interface AgentLayoutProps {
  agentId: string;
  children: React.ReactNode;
  leftSlot?: React.ReactNode;
  rightSlot?: React.ReactNode;
}

export const AgentLayout = ({ children, leftSlot, rightSlot }: AgentLayoutProps) => {
  return (
    <div
      className={cn(
        'grid h-full overflow-hidden border-t border-border1',
        rightSlot && !leftSlot && 'grid-cols-2',
        leftSlot && !rightSlot && 'grid-cols-2',
        leftSlot && rightSlot && 'grid-cols-3',
        !leftSlot && !rightSlot && 'grid-cols-1',
      )}
    >
      {leftSlot && <div className="overflow-y-auto bg-surface1">{leftSlot}</div>}
      <div className="overflow-y-auto bg-surface1 py-4">{children}</div>
      {rightSlot && <div className="overflow-y-auto bg-surface2 border-l border-border1">{rightSlot}</div>}
    </div>
  );
};
