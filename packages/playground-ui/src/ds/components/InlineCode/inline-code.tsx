import type { HTMLAttributes } from 'react';

import { textStyle } from '@/ds/primitives/text';
import type { TextStyleProps } from '@/ds/primitives/text';
import { cn } from '@/lib/utils';

export type InlineCodeProps = HTMLAttributes<HTMLElement> & Pick<TextStyleProps, 'variant' | 'tone'>;

export const InlineCode = ({ className, variant, tone, ...props }: InlineCodeProps) => (
  <code
    className={cn(
      'rounded-sm bg-fill box-decoration-clone px-1 py-0.5 font-mono wrap-break-word',
      textStyle({ variant, tone }),
      className,
    )}
    {...props}
  />
);
