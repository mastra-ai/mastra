import { Txt } from '@/ds/components/Txt';
import type { TextStyleProps } from '@/ds/primitives/text';
import { cn } from '@/lib/utils';

export interface DataDetailsPanelHeadingProps extends TextStyleProps {
  className?: string;
  children: React.ReactNode;
}

export function DataDetailsPanelHeading({
  className,
  children,
  variant = 'body',
  tone = 'muted',
  font,
}: DataDetailsPanelHeadingProps) {
  return (
    <Txt
      as="h3"
      variant={variant}
      tone={tone}
      font={font}
      className={cn('flex gap-2 [&>b]:text-caption [&>b]:text-placeholder', className)}
    >
      {children}
    </Txt>
  );
}
