import React from 'react';
import { cn } from '@/lib/utils';

export type NoticeVariant = 'warning' | 'destructive' | 'success' | 'info';

const variantClasses: Record<NoticeVariant, string> = {
  warning: 'bg-accent6/10 border-accent6/15 [&>svg]:text-accent6',
  destructive: 'bg-accent2/10 border-accent2/15 [&>svg]:text-accent2',
  info: 'bg-accent5/10 border-accent5/15 [&>svg]:text-accent5',
  success: 'bg-accent1/10 border-accent1/15 [&>svg]:text-accent1',
};

export interface NoticeRootProps {
  children: React.ReactNode;
  variant: NoticeVariant;
  className?: string;
}

export function NoticeRoot({ children, variant, className }: NoticeRootProps) {
  return (
    <div
      className={cn(
        'flex items-center gap-3 px-4 pr-3 py-3 rounded-xl border text-neutral4/90 backdrop-blur-md',
        'animate-in fade-in-0 slide-in-from-top-2 duration-200',
        '[&>svg]:w-[1em] [&>svg]:h-[1em] [&>svg]:opacity-90',
        variantClasses[variant],
        className,
      )}
    >
      {children}
    </div>
  );
}
