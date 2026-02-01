import { cn } from '@/lib/utils';

export type SectionHeaderProps = {
  title: string;
  subtitle?: React.ReactNode;
  icon?: React.ReactNode;
  className?: string;
};

export function SectionHeader({ title, subtitle, icon, className }: SectionHeaderProps) {
  return (
    <header className={cn('flex flex-col gap-1', className)}>
      <h2 className="flex items-center gap-2 text-ui-md font-medium text-neutral5">
        {icon}
        {title}
      </h2>
      {subtitle && <p className="text-ui-sm text-neutral3">{subtitle}</p>}
    </header>
  );
}
