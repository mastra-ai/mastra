import { cn } from '@mastra/playground-ui/utils/cn';

type ExperimentTraceSpanTypeIconProps = {
  icon: React.ReactNode;
  color?: string;
};

export function ExperimentTraceSpanTypeIcon({ icon, color }: ExperimentTraceSpanTypeIconProps) {
  return (
    <span
      className={cn(
        'flex size-[1.1rem] shrink-0 items-center justify-center rounded-md',
        '[&>svg]:size-[.9rem] [&>svg]:text-surface2',
      )}
      style={{ backgroundColor: color }}
    >
      {icon}
    </span>
  );
}
