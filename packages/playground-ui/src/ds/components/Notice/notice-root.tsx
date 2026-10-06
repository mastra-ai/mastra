import { FileTextIcon, InfoIcon, LightbulbIcon, OctagonAlertIcon, TriangleAlertIcon } from 'lucide-react';
import React from 'react';
import './notice.css';
import { GrainFill } from '@/ds/components/GrainFill';
import { textStyle } from '@/ds/primitives/text';
import { cn } from '@/lib/utils';

export type NoticeVariant = 'warning' | 'destructive' | 'success' | 'info' | 'note';

const variantConfig: Record<NoticeVariant, { icon: React.ReactNode; iconClass: string }> = {
  success: { icon: <LightbulbIcon />, iconClass: 'text-success-indicator' },
  destructive: { icon: <OctagonAlertIcon />, iconClass: 'text-destructive-indicator' },
  warning: { icon: <TriangleAlertIcon />, iconClass: 'text-warning-foreground' },
  info: { icon: <InfoIcon />, iconClass: 'text-info-indicator' },
  note: { icon: <FileTextIcon />, iconClass: 'text-muted-foreground' },
};

const titledMessage = { variant: 'caption', tone: 'muted' } as const;
const plainMessage = { variant: 'body-sm', tone: 'ink' } as const;

function lastRowOf({ action, children }: Pick<NoticeRootProps, 'action' | 'children'>) {
  if (action) return 'action';
  if (children) return 'message';
  return 'title';
}

export interface NoticeRootProps {
  variant: NoticeVariant;
  title?: React.ReactNode;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}

export function NoticeRoot({ variant, title, icon, action, children, className }: NoticeRootProps) {
  const { icon: defaultIcon, iconClass } = variantConfig[variant];
  const glyph = (
    <span className={cn('flex h-lh shrink-0 items-center [&>svg]:size-icon-sm', iconClass)}>{icon ?? defaultIcon}</span>
  );

  const lastRow = lastRowOf({ action, children });
  const messageText = title ? titledMessage : plainMessage;

  return (
    <div
      data-slot="notice"
      className={cn(
        'relative isolate flex flex-col gap-2 overflow-hidden rounded-2xl border border-surface-rim bg-card p-3',
        'animate-in duration-200 fade-in-0 slide-in-from-top-2',
        className,
      )}
    >
      {variant !== 'note' && (
        <GrainFill
          tone={variant}
          width={464}
          height={200}
          className="absolute inset-0 -z-10 max-w-116 mask-r-from-34%"
        />
      )}
      {title && (
        <div className={cn(textStyle({ variant: 'subheading', tone: 'ink' }), 'flex min-w-0 items-start gap-2')}>
          <span className="min-w-0 flex-1 truncate">{title}</span>
          {lastRow === 'title' && glyph}
        </div>
      )}
      {children && (
        <div className={cn(textStyle(messageText), 'flex min-w-0 items-end gap-2')}>
          {/* wrap-anywhere — messages carry URLs and tokens with no break opportunity */}
          <div className="flex min-w-0 flex-1 flex-col gap-2 wrap-anywhere">{children}</div>
          {lastRow === 'message' && glyph}
        </div>
      )}
      {action && (
        <div className={cn(textStyle({ variant: 'label' }), 'flex min-w-0 items-center justify-between gap-2')}>
          <div className="flex min-w-0">{action}</div>
          {glyph}
        </div>
      )}
    </div>
  );
}
