import { cn } from '@/lib/utils';

type SpanTypeIconProps = {
  icon: React.ReactNode;
  color: string;
};

export function SpanTypeIcon({ icon, color }: SpanTypeIconProps) {
  return (
    <span
      className={cn(
        'flex w-[1.1rem] h-[1.1rem] shrink-0 rounded-md  items-center justify-center',
        '[&>svg]:w-[.9rem] [&>svg]:h-[.9rem] [&>svg]:text-surface2',
      )}
      style={{ backgroundColor: color }}
    >
      {icon}
    </span>
  );
}
