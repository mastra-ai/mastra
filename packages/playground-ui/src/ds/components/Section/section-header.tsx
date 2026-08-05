import React from 'react';
import { cn } from '@/lib/utils';

export type SectionHeaderProps = {
  children: React.ReactNode;
  className?: string;
};

export function SectionHeader({ children, className }: SectionHeaderProps) {
  return <header className={cn('grid grid-cols-[1fr_auto] items-center', className)}>{children}</header>;
}
