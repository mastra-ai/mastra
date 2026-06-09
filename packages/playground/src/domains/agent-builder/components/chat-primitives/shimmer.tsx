import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export const Shimmer = ({ children, className }: { children: ReactNode; className?: string }) => {
  return (
    <span
      className={cn('inline-block text-transparent', className)}
      style={{
        backgroundImage: 'linear-gradient(to right, var(--neutral3), var(--neutral6), var(--neutral3))',
        backgroundSize: '200% 100%',
        backgroundClip: 'text',
        WebkitBackgroundClip: 'text',
        animation: 'shimmer-text 2s linear infinite',
      }}
    >
      {children}
    </span>
  );
};
