import { Txt } from '@/ds/components/Txt';
import { Icon } from '@/ds/icons/Icon';
import { cn } from '@/lib/utils';

export type SectionHeaderProps = {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  icon?: React.ReactNode;
  className?: string;
};

export function SectionHeader({ title, subtitle, icon, className }: SectionHeaderProps) {
  return (
    <header className={cn('flex flex-col w-fit', className)}>
      <Txt as="h2" variant="header-md" className="flex items-center gap-2">
        {icon && (
          <Icon size="lg" className="text-accent1">
            {icon}
          </Icon>
        )}
        {title}
      </Txt>
      {subtitle && <Txt className="text-ui-md text-neutral3 !font-light">{subtitle}</Txt>}
    </header>
  );
}

export function SubSectionHeader({ title, icon }: SectionHeaderProps) {
  return (
    <Txt as="h4" variant="ui-sm" className="flex items-center gap-1 text-neutral2 uppercase">
      {icon && (
        <Icon size="sm" className="text-neutral1">
          {icon}
        </Icon>
      )}
      {title}
    </Txt>
  );
}
