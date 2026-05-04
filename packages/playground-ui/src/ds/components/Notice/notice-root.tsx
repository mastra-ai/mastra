import { FileTextIcon, InfoIcon, LightbulbIcon, OctagonAlertIcon, TriangleAlertIcon } from 'lucide-react';
import React from 'react';
import { cn } from '@/lib/utils';

export type NoticeVariant = 'warning' | 'destructive' | 'success' | 'info' | 'note';

const variantConfig: Record<NoticeVariant, { icon: React.ReactNode; classes: string }> = {
  success: {
    icon: <LightbulbIcon />,
    classes: 'bg-notice-success/20 border-notice-success/20 text-notice-success-fg',
  },
  destructive: {
    icon: <OctagonAlertIcon />,
    classes: 'bg-notice-destructive/20 border-notice-destructive/20 text-notice-destructive-fg',
  },
  warning: {
    icon: <TriangleAlertIcon />,
    classes: 'bg-notice-warning/20 border-notice-warning/20 text-notice-warning-fg',
  },
  info: {
    icon: <InfoIcon />,
    classes: 'bg-notice-info/20 border-notice-info/20 text-notice-info-fg',
  },
  note: {
    icon: <FileTextIcon />,
    classes: 'bg-notice-note border-border1 text-notice-note-fg',
  },
};

export interface NoticeRootProps {
  variant: NoticeVariant;
  title?: React.ReactNode;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}

export function NoticeRoot({ variant, title, icon, action, children, className }: NoticeRootProps) {
  const { icon: defaultIcon, classes } = variantConfig[variant];
  const resolvedIcon = icon ?? defaultIcon;

  if (!title) {
    return (
      <div
        className={cn(
          'relative @container flex items-start gap-2 rounded-2xl border p-3 [&>svg]:size-4',
          'animate-in fade-in-0 slide-in-from-top-2 duration-200',
          classes,
          className,
        )}
      >
        <span className="mt-0.5 shrink-0 [&>svg]:size-4">{resolvedIcon}</span>
        {children && <div className="flex-1 text-ui-md leading-ui-md">{children}</div>}
        {action && <div className="self-start ml-auto">{action}</div>}
      </div>
    );
  }

  return (
    <div
      className={cn(
        'relative @container flex flex-col gap-4 rounded-2xl border p-3',
        'animate-in fade-in-0 slide-in-from-top-2 duration-200',
        classes,
        className,
      )}
    >
      <div className="flex h-4 items-center gap-2 [&>svg]:size-4">
        {resolvedIcon}
        <span className="text-ui-sm font-medium uppercase tracking-wide leading-none">{title}</span>
      </div>
      {action && <div className="absolute right-2 top-2 hidden @md:block">{action}</div>}
      {(children || action) && (
        <div className="flex flex-col gap-5">
          {children}
          {action && <div className="self-start @md:hidden">{action}</div>}
        </div>
      )}
    </div>
  );
}
