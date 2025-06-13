import { cn } from '@/lib/utils';

export function MainColumnSection({
  title,
  icon,
  children,
  className,
  style,
}: {
  title?: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div className={cn('grid gap-4 mb-10 border-b border-border1 pb-9', className)} style={{ ...style }}>
      {title && (
        <h2 className="items-center gap-2 group [&>svg]:w-[1.1em] [&>svg]:h-[1.1em] text-muted-foreground font-normal text-lg flex">
          {icon && icon}
          {title}
        </h2>
      )}
      <div className={cn({ 'pl-7': icon })}>{children}</div>
    </div>
  );
}
