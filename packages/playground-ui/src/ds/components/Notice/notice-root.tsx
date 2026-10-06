import { FileTextIcon, InfoIcon, LightbulbIcon, OctagonAlertIcon, TriangleAlertIcon } from 'lucide-react';
import { Children, type ReactNode } from 'react';
import { GrainFill } from '@/ds/components/GrainFill/grain-fill';
import { textStyle } from '@/ds/primitives/text';
import { cn } from '@/lib/utils';

export type NoticeVariant = 'warning' | 'destructive' | 'success' | 'info' | 'note';

const variantConfig: Record<NoticeVariant, { icon: ReactNode; iconClass: string }> = {
  success: { icon: <LightbulbIcon />, iconClass: 'text-success-indicator' },
  destructive: { icon: <OctagonAlertIcon />, iconClass: 'text-destructive-indicator' },
  warning: { icon: <TriangleAlertIcon />, iconClass: 'text-warning-foreground' },
  info: { icon: <InfoIcon />, iconClass: 'text-info-indicator' },
  note: { icon: <FileTextIcon />, iconClass: 'text-muted-foreground' },
};

const titledMessage = { variant: 'caption', tone: 'muted' } as const;
const plainMessage = { variant: 'body-sm', tone: 'ink' } as const;

function hasContent(content: ReactNode) {
  return Children.toArray(content).some(child => child !== '');
}

function lastRowOf(hasAction: boolean, hasMessage: boolean) {
  if (hasAction) return 'action';
  if (hasMessage) return 'message';
  return 'title';
}

export interface NoticeRootProps {
  variant: NoticeVariant;
  title?: ReactNode;
  icon?: ReactNode;
  action?: ReactNode;
  children?: ReactNode;
  className?: string;
}

export function NoticeRoot({ variant, title, icon, action, children, className }: NoticeRootProps) {
  const { icon: defaultIcon, iconClass } = variantConfig[variant];
  const glyph = (
    <span className={cn('flex h-lh shrink-0 items-center [&>svg]:size-icon-sm', iconClass)}>{icon ?? defaultIcon}</span>
  );

  const hasTitle = hasContent(title);
  const hasMessage = hasContent(children);
  const hasAction = hasContent(action);
  const lastRow = lastRowOf(hasAction, hasMessage);
  const messageText = hasTitle ? titledMessage : plainMessage;

  return (
    <div
      className={cn(
        'relative isolate flex flex-col gap-2 overflow-hidden rounded-2xl bg-card p-3 shadow-raised',
        'motion-safe:animate-in motion-safe:duration-200 motion-safe:fade-in-0 motion-safe:slide-in-from-top-2',
        className,
      )}
    >
      {variant !== 'note' && (
        <GrainFill
          tone={variant}
          width={464}
          height={200}
          className="absolute inset-px -z-10 max-w-116 rounded-[inherit] mask-r-from-34%"
        />
      )}
      {hasTitle && (
        <div className={cn(textStyle({ variant: 'subheading', tone: 'ink' }), 'flex min-w-0 items-start gap-2')}>
          <span className="min-w-0 flex-1 truncate">{title}</span>
          {lastRow === 'title' && glyph}
        </div>
      )}
      {hasMessage && (
        <div className={cn(textStyle(messageText), 'flex min-w-0 items-end gap-2')}>
          {/* wrap-anywhere — messages carry URLs and tokens with no break opportunity */}
          <div className="flex min-w-0 flex-1 flex-col gap-2 wrap-anywhere">{children}</div>
          {lastRow === 'message' && glyph}
        </div>
      )}
      {hasAction && (
        <div className={cn(textStyle({ variant: 'label' }), 'flex min-w-0 items-center justify-between gap-2')}>
          <div className="flex min-w-0">{action}</div>
          {glyph}
        </div>
      )}
    </div>
  );
}
