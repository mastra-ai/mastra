import { Txt } from '@/ds/components/Txt';
import type { TextStyleProps } from '@/ds/primitives/text';
import { cn } from '@/lib/utils';

export type TextAndIconProps = {
  children: React.ReactNode;
  className?: string;
} & TextStyleProps;

export function TextAndIcon({ children, className, variant = 'caption', tone = 'muted', font }: TextAndIconProps) {
  return (
    <Txt
      as="span"
      variant={variant}
      tone={tone}
      font={font}
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
