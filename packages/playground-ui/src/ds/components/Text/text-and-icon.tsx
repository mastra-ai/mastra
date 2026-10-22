import { cn } from '../../../lib/utils';
import { Txt } from '../Txt';

export type TextAndIconProps = {
  children: React.ReactNode;
  className?: string;
};

export function TextAndIcon({ children, className }: TextAndIconProps) {
  return (
    <Txt
      as="span"
      variant="caption"
      tone="muted"
      className={cn(
        'inline-flex items-center gap-1',
        '[&>svg]:size-icon-sm [&>svg]:shrink-0 [&>svg]:opacity-50',
        className,
      )}
    >
      {children}
    </Txt>
  );
}
