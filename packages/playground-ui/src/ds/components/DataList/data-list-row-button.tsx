import type { ReactNode } from 'react';
import { dataListRowStyles } from './shared';
import { cn } from '@/lib/utils';

export type DataListRowButtonProps = {
  children: ReactNode;
  onClick?: () => void;
  className?: string;
};

export function DataListRowButton({ children, onClick, className }: DataListRowButtonProps) {
  return (
    <button type="button" onClick={onClick} className={cn(...dataListRowStyles, 'text-left', className)}>
      {children}
    </button>
  );
}
