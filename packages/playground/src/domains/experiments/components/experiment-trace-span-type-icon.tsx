import { cn } from '@mastra/playground-ui/utils/cn';

type ExperimentTraceSpanTypeIconProps = {
  icon: React.ReactNode;
  color?: string;
};

export function ExperimentTraceSpanTypeIcon({ icon, color }: ExperimentTraceSpanTypeIconProps) {
  return (
    <span
      className={cn(
        'flex h-[1.1rem] w-[1.1rem] shrink-0 items-center justify-center rounded-md',
        '[&>svg]:h-[.9rem] [&>svg]:w-[.9rem] [&>svg]:text-background',
      )}
      style={{ backgroundColor: color }}
    >
      {icon}
    </span>
  );
}
