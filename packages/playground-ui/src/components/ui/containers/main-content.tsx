import { cn } from '@/lib/utils';

export function MainContent({
  children,
  className,
  style,
  variant = 'default',
}: {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  variant?: 'default' | 'forAgent' | 'forAgentWithHistory' | 'forWorkflow' | 'forTool' | 'forMcpsServer';
}) {
  return (
    <div
      className={cn(
        {
          // default
          'mc_d grid overflow-y-auto h-full overflow-x-auto min-w-[min-content]': variant !== 'default',
          // agent-chat screen without history
          'mc_fa grid grid-cols-[1fr_1fr]': variant === 'forAgent',
          '[&>:nth-child(1)]:bg-black [&>:nth-child(1)]:py-6': variant === 'forAgent', // for clarity styles applied to the container child defined in a separate row
          // agent-chat screen with history
          'mc_fawh grid grid-cols-[auto_1fr_1fr]': variant === 'forAgentWithHistory',
          '[&>:nth-child(2)]:bg-black [&>:nth-child(2)]:py-6': variant === 'forAgentWithHistory',
          // tool screen
          'mc_ft grid grid-cols-[auto_1fr] relative': variant === 'forTool',
          // MCPs server screen
          'mc_fms grid grid-cols-[2fr_1fr]': variant === 'forMcpsServer',
          '[&>:nth-child(2)]:border-l [&>:nth-child(1)]:border-border1': variant === 'forMcpsServer',
          // workflow/graph screen
          'mc_fw flex': variant === 'forWorkflow',
        },
        className,
      )}
      style={style}
    >
      {children}
    </div>
  );
}
