import { cn } from '@/lib/utils';

export type SectionTitleProps = {
  icon?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
};

export function SectionTitle({ icon, children, className }: SectionTitleProps) {
  return (
    <h3
      className={cn(
        'flex items-center gap-2 text-ui-sm font-medium text-neutral4',
        '[&>svg]:w-[1.2em] [&>svg]:h-[1.2em]',
        className,
      )}
    >
      {icon}
      {children}
    </h3>
  );
}
