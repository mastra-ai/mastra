import type React from 'react';
import { cn } from '@/lib/utils';

export function PageContentTopBar({ children, className }: { children: React.ReactNode; className?: string }) {
  return <aside className={cn('flex items-center py-3 min-h-[2rem] justify-end', className)}>{children}</aside>;
}
