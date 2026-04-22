import { cn } from '@mastra/playground-ui';

type SpanTypeIconProps = {
  icon: React.ReactNode;
  color?: string;
};

export function SpanTypeIcon({ icon, color }: SpanTypeIconProps) {
  return (
    <span
      className={cn(
        'flex w-[0.9rem] h-[0.9rem] shrink-0 rounded-sm items-center justify-center',
        '[&>svg]:w-[0.7rem] [&>svg]:h-[0.7rem] [&>svg]:text-surface2',
      )}
      style={{ backgroundColor: color }}
    >
      {icon}
    </span>
  );
}
