import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

import './shimmer.css';

export interface ShimmerProps {
  children: ReactNode;
  className?: string;
}

export const Shimmer = ({ children, className }: ShimmerProps) => {
  return <span className={cn('shimmer-text inline-block', className)}>{children}</span>;
};
