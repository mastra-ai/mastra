import { cn } from '@/lib/utils';
import React from 'react';

type SectionHeaderProps = {
  children: React.ReactNode;
  className?: string;
};

export function SectionHeader({ children, className }: SectionHeaderProps) {
  return <header className={cn('grid items-center grid-cols-[1fr_auto]', className)}>{children}</header>;
}
