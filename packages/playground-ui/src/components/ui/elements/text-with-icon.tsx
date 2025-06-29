import { cn } from '@/lib/utils';

export function TextWithIcon({
  children,
  className,
  style,
}: {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div
      className={cn(
        'flex justify-start items-center gap-1 text-[11px] text-left',
        '[&>svg]:w-[12px] [&>svg]:h-[12px] [&>svg]:text-icon3',
        className,
      )}
      style={{
        ...style,
      }}
    >
      {children}
    </div>
  );
}
