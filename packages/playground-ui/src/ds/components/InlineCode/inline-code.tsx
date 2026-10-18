import type { HTMLAttributes } from 'react';

import { cn } from '@/lib/utils';

export type InlineCodeProps = HTMLAttributes<HTMLElement>;

export const InlineCode = ({ className, ...props }: InlineCodeProps) => (
  <code
    className={cn('rounded-sm bg-fill box-decoration-clone px-1 py-0.5 font-mono wrap-break-word', className)}
    {...props}
  />
);
