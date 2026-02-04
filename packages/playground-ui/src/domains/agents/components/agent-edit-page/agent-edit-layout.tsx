import { cn } from '@/lib/utils';

export interface AgentEditLayoutProps {
  children: React.ReactNode;
  leftSlot: React.ReactNode;
  rightSlot?: React.ReactNode;
}

export const AgentEditLayout = ({ children, leftSlot, rightSlot }: AgentEditLayoutProps) => {
  const hasRightSlot = Boolean(rightSlot);

  return (
    <div
      className={cn('grid overflow-y-auto h-full', hasRightSlot ? 'grid-cols-[1fr_2fr_1fr]' : 'grid-cols-[1fr_2fr]')}
    >
      <div className="overflow-y-auto h-full border-r border-border1">{leftSlot}</div>
      <div className="overflow-y-auto h-full py-4">{children}</div>
      {rightSlot && <div className="overflow-y-auto h-full border-l border-border1">{rightSlot}</div>}
    </div>
  );
};
