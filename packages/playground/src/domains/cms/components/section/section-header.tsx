import { Txt } from '@mastra/playground-ui/components/Txt';
import { Icon } from '@mastra/playground-ui/icons/Icon';
import { cn } from '@mastra/playground-ui/utils/cn';

export type SectionHeaderProps = {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  icon?: React.ReactNode;
  className?: string;
};

export function SectionHeader({ title, subtitle, icon, className }: SectionHeaderProps) {
  return (
    <header className={cn('flex flex-col w-fit', className)}>
      <Txt as="h2" variant="heading" className="flex items-center gap-2">
        {icon && (
          <Icon size="lg" className="text-accent1">
            {icon}
          </Icon>
        )}
        {title}
      </Txt>
      {subtitle && <Txt className="text-body text-muted-foreground">{subtitle}</Txt>}
    </header>
  );
}

export function SubSectionHeader({ title, icon }: SectionHeaderProps) {
  return (
    <Txt as="h4" variant="caption" className="text-placeholder flex items-center gap-1 uppercase">
      {icon && (
        <Icon size="xs" className="text-placeholder">
          {icon}
        </Icon>
      )}
      {title}
    </Txt>
  );
}
