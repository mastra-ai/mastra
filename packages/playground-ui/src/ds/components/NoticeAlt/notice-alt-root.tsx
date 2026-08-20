import './notice-alt.css';
import { CircleCheckIcon, FileTextIcon, InfoIcon, OctagonAlertIcon, TriangleAlertIcon } from 'lucide-react';
import type { ComponentPropsWithoutRef, ReactNode } from 'react';
import { cn } from '@/lib/utils';

export type NoticeAltVariant = 'warning' | 'destructive' | 'success' | 'info' | 'note';
export type NoticeAltSurface = 'neutral' | 'tinted' | 'grainy-fade';

const variantConfig: Record<NoticeAltVariant, { icon: ReactNode; accentClassName: string; iconClassName: string }> = {
  success: {
    icon: <CircleCheckIcon />,
    accentClassName: 'before:bg-notice-success',
    iconClassName: 'text-notice-success',
  },
  destructive: {
    icon: <OctagonAlertIcon />,
    accentClassName: 'before:bg-notice-destructive',
    iconClassName: 'text-notice-destructive',
  },
  warning: {
    icon: <TriangleAlertIcon />,
    accentClassName: 'before:bg-notice-warning',
    iconClassName: 'text-notice-warning',
  },
  info: {
    icon: <InfoIcon />,
    accentClassName: 'before:bg-notice-info',
    iconClassName: 'text-notice-info',
  },
  note: {
    icon: <FileTextIcon />,
    accentClassName: 'before:bg-neutral2',
    iconClassName: 'text-neutral2',
  },
};

export type NoticeAltRootProps = Omit<ComponentPropsWithoutRef<'div'>, 'title'> & {
  variant: NoticeAltVariant;
  surface?: NoticeAltSurface;
  title?: ReactNode;
  icon?: ReactNode;
  action?: ReactNode;
};

export function NoticeAltRoot({
  variant,
  surface = 'neutral',
  title,
  icon,
  action,
  children,
  className,
  ...props
}: NoticeAltRootProps) {
  const config = variantConfig[variant];

  return (
    <div
      data-slot="notice-alt"
      data-variant={variant}
      data-surface={surface}
      className={cn(
        'notice-alt @container relative isolate overflow-hidden rounded-xl p-4',
        'before:absolute before:inset-y-0 before:left-0 before:z-10 before:w-0.5',
        'motion-safe:animate-in motion-safe:duration-200 motion-safe:fade-in-0 motion-safe:slide-in-from-top-1',
        config.accentClassName,
        surface === 'neutral' && 'bg-surface-overlay-soft',
        className,
      )}
      {...props}
    >
      <div className="relative z-10 flex flex-col gap-4 @md:flex-row @md:items-center">
        <div className="flex min-w-0 flex-1 items-start gap-3 @md:items-center">
          <div
            className={cn('flex size-5 shrink-0 items-center justify-center [&>svg]:size-4', config.iconClassName)}
            aria-hidden="true"
          >
            {icon ?? config.icon}
          </div>
          <div className="max-w-[65ch] min-w-0 flex-1 wrap-anywhere">
            {title ? (
              <div className="text-ui-md leading-ui-md text-neutral5 font-medium text-balance">{title}</div>
            ) : null}
            {children ? <div className={cn(title && 'mt-1')}>{children}</div> : null}
          </div>
        </div>
        {action ? <div className="shrink-0 [&>button]:w-full @md:[&>button]:w-auto">{action}</div> : null}
      </div>
    </div>
  );
}
