import { Children } from 'react';
import type { ComponentProps, ReactNode } from 'react';
import { Button } from '../Button/Button';
import './notice.css';
import { IconCircleInfo } from '@/ds/icons/central/IconCircleInfo';
import { IconCrossMedium } from '@/ds/icons/central/IconCrossMedium';
import { IconExclamationCircle } from '@/ds/icons/central/IconExclamationCircle';
import { IconExclamationTriangle } from '@/ds/icons/central/IconExclamationTriangle';
import { IconFileText } from '@/ds/icons/central/IconFileText';
import { IconLightBulb } from '@/ds/icons/central/IconLightBulb';
import { cn } from '@/lib/utils';

export type NoticeVariant = 'warning' | 'destructive' | 'success' | 'info' | 'note';

const variantConfig: Record<NoticeVariant, { icon: ReactNode; iconClass: string }> = {
  success: { icon: <IconLightBulb />, iconClass: 'text-success-indicator' },
  destructive: { icon: <IconExclamationCircle />, iconClass: 'text-destructive-indicator' },
  warning: { icon: <IconExclamationTriangle />, iconClass: 'text-warning-foreground' },
  info: { icon: <IconCircleInfo />, iconClass: 'text-info-indicator' },
  note: { icon: <IconFileText />, iconClass: 'text-muted-foreground' },
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
          <IconCrossMedium />
        </Button>
      )}
    </div>
  );
}
