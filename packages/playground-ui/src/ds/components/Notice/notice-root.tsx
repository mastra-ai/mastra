import { FileTextIcon, InfoIcon, LightbulbIcon, OctagonAlertIcon, TriangleAlertIcon, XIcon } from 'lucide-react';
import { Children } from 'react';
import type { ComponentProps, ReactNode } from 'react';
import { Button } from '../Button/Button';
import './notice.css';
import { cn } from '@/lib/utils';

export type NoticeVariant = 'warning' | 'destructive' | 'success' | 'info' | 'note';

const variantConfig: Record<NoticeVariant, { icon: ReactNode; iconClass: string }> = {
  success: { icon: <LightbulbIcon />, iconClass: 'text-success-indicator' },
  destructive: { icon: <OctagonAlertIcon />, iconClass: 'text-destructive-indicator' },
  warning: { icon: <TriangleAlertIcon />, iconClass: 'text-warning-foreground' },
  info: { icon: <InfoIcon />, iconClass: 'text-info-indicator' },
  note: { icon: <FileTextIcon />, iconClass: 'text-muted-foreground' },
};

function hasContent(content: ReactNode) {
  return Children.toArray(content).some(child => child !== '');
}

export interface NoticeRootProps extends Omit<ComponentProps<'div'>, 'title'> {
  variant: NoticeVariant;
  title?: ReactNode;
  icon?: ReactNode;
  action?: ReactNode;
  actionPlacement?: 'below' | 'end';
  onDismiss?: () => void;
}

export function NoticeRoot({
  variant,
  title,
  icon,
  action,
  actionPlacement = 'below',
  onDismiss,
  children,
  className,
  ...props
}: NoticeRootProps) {
  const { icon: defaultIcon, iconClass } = variantConfig[variant];
  const hasTitle = hasContent(title);
  const hasMessage = hasContent(children);
  const hasAction = hasContent(action);

  return (
    <div
      {...props}
      data-slot="notice"
      data-tone={variant}
      data-action-placement={actionPlacement}
      className={cn('relative grid min-w-0 gap-x-3 rounded-lg p-3 text-body-sm', onDismiss && 'pe-11', className)}
    >
      {(hasTitle || hasMessage || hasAction) && (
        <span
          data-slot="notice-icon"
          aria-hidden
          className={cn('flex size-5 shrink-0 items-center justify-center [&>svg]:size-icon-sm', iconClass)}
        >
          {icon ?? defaultIcon}
        </span>
      )}
      {(hasTitle || hasMessage) && (
        <div data-slot="notice-content" className="flex min-w-0 flex-col gap-1 wrap-anywhere">
          {hasTitle && <div className="text-subheading">{title}</div>}
          {hasMessage && <div className="flex min-w-0 flex-col gap-2">{children}</div>}
        </div>
      )}
      {hasAction && (
        <div data-slot="notice-action" className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-2">
          {action}
        </div>
      )}
      {onDismiss && (
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="absolute end-2 top-2 before:absolute before:-inset-2"
          tooltip="Dismiss notice"
          onClick={onDismiss}
        >
          <XIcon />
        </Button>
      )}
    </div>
  );
}
