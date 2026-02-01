import { cn } from '@/lib/utils';

export interface AgentLayoutProps {
  agentId: string;
  children: React.ReactNode;
  leftSlot?: React.ReactNode;
  rightSlot?: React.ReactNode;
  headerSlot?: React.ReactNode;
}

export const AgentLayout = ({ children, leftSlot, rightSlot, headerSlot }: AgentLayoutProps) => {
  return (
    <div className="flex flex-col h-full overflow-hidden">
      {headerSlot}
      <div
        className={cn(
          'grid flex-1 min-h-0 overflow-hidden',
          rightSlot && !leftSlot && 'grid-cols-[2fr_1fr]',
          leftSlot && !rightSlot && 'grid-cols-[1fr_2fr]',
          leftSlot && rightSlot && 'grid-cols-[1fr_2fr_1fr]',
          !leftSlot && !rightSlot && 'grid-cols-1',
        )}
      >
        {leftSlot && <div className="overflow-y-auto bg-surface1">{leftSlot}</div>}
        <div className="overflow-y-auto bg-surface1">{children}</div>
        {rightSlot && <div className="overflow-y-auto bg-surface2 border-l border-border1">{rightSlot}</div>}
      </div>
    </div>
  );
};
