import type { ReactNode } from 'react';
import { Txt } from '@/ds/components/Txt';
import type { TextStyleProps } from '@/ds/primitives/text';
import { cn } from '@/lib/utils';

export interface DataPanelSectionHeadingProps {
  variant?: TextStyleProps['variant'];
  /** Optional leading icon. Rendered before `children` and sized via `[&>svg]:size-3.5`. */
  icon?: ReactNode;
  className?: string;
  children: ReactNode;
}

/**
 * Section heading inside a DataPanel.Content (e.g. above a code block or a key-values list).
 * Used by `DataCodeSection` and any consumer that needs a matching small-caps label.
 */
export function DataPanelSectionHeading({
  icon,
  className,
  children,
  variant = 'eyebrow',
}: DataPanelSectionHeadingProps) {
  return (
    <Txt
      as="div"
      variant={variant}
      tone="faint"
      className={cn('flex items-center gap-1.5 [&>svg]:size-3.5', className)}
    >
      {icon}
      {children}
    </Txt>
  );
}
