import { Txt } from '@mastra/playground-ui/components/Txt';
import { cn } from '@mastra/playground-ui/utils/cn';

export type SectionTitleProps = {
  icon?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
};

export function SectionTitle({ icon, children, className }: SectionTitleProps) {
  return (
    <Txt
      as="h3"
      variant="column"
      tone="muted"
      className={cn('flex items-center gap-2', '[&>svg]:h-[1.2em] [&>svg]:w-[1.2em]', className)}
    >
      {icon}
      {children}
    </Txt>
  );
}
