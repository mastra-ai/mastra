import type { ReactNode } from 'react';
import { Txt } from '@/ds/components/Txt';

export type DataListSubHeadingProps = {
  children: ReactNode;
  className?: string;
};

export function DataListSubHeading({ children, className }: DataListSubHeadingProps) {
  return (
    <Txt as="span" variant="caption" tone="faint" className={className}>
      {children}
    </Txt>
  );
}
