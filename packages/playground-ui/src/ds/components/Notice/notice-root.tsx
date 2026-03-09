import { cn } from '@/lib/utils';
import React from 'react';

export type NoticeVariant = 'warning' | 'destructive' | 'success' | 'info';

const variantClasses: Record<NoticeVariant, string> = {
  warning: 'bg-[#352f26] ',
  destructive: 'bg-accent2/20',
  info: 'bg-accent5/20',
  success: 'bg-accent1/15',
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
        'flex items-center gap-3 px-4 pr-3 py-3 rounded-lg  text-neutral4/80',
        'animate-in fade-in-0 slide-in-from-top-2 duration-200',
        '[>svg]:w-[1em] [&>dvg]:h-[1em] [&>svg]:opacity-50 [&>svg]:text-neutral4',
        variantClasses[variant],
        className,
      )}
    >
      {children}
    </div>
  );
}
