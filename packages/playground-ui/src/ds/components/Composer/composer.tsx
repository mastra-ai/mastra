import type { ComponentPropsWithoutRef, ReactNode } from 'react';
import { Children, forwardRef, isValidElement } from 'react';

import { ScrollArea } from '../ScrollArea';
import { cn } from '@/lib/utils';

import './composer-sending.css';

export interface ComposerProps extends ComponentPropsWithoutRef<'form'> {
  sendingPulseKey?: number;
}

export const Composer = forwardRef<HTMLFormElement, ComposerProps>(
  ({ children, className, sendingPulseKey = 0, ...props }, ref) => {
    const regions = Children.toArray(children);
    const attachmentRegions: ReactNode[] = [];
    const contentRegions: ReactNode[] = [];

    for (const child of regions) {
      if (isValidElement(child) && child.type === ComposerAttachments) {
        attachmentRegions.push(child);
      } else {
        contentRegions.push(child);
      }
    }

    return (
      <form ref={ref} data-slot="composer" className={cn('relative px-2 pb-2', className)} {...props}>
        {attachmentRegions}
        <div
          data-slot="composer-content"
          className="duration-normal @container relative mx-auto mt-auto w-full max-w-3xl overflow-hidden rounded-[22px] border border-border2/40 bg-surface3 transition-colors focus-within:border-border2"
        >
          <ComposerSendingPulse pulseKey={sendingPulseKey} />
          <div className="relative z-10">{contentRegions}</div>
        </div>
      </form>
    );
  },
);
Composer.displayName = 'Composer';

export const ComposerAttachments = forwardRef<HTMLDivElement, ComponentPropsWithoutRef<'div'>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      role="region"
      data-slot="composer-attachments"
      className={cn('mx-auto w-full max-w-3xl pb-2', className)}
      {...props}
    />
  ),
);
ComposerAttachments.displayName = 'ComposerAttachments';

export const ComposerInput = forwardRef<HTMLTextAreaElement, ComponentPropsWithoutRef<'textarea'>>(
  ({ className, ...props }, ref) => (
    <ScrollArea maxHeight="212px">
      <textarea
        ref={ref}
        data-slot="composer-input"
        className={cn(
          'min-h-17 field-sizing-content w-full resize-none bg-transparent px-3 pt-3 pb-2 text-ui-lg leading-ui-lg text-neutral6 outline-hidden placeholder:text-neutral3 focus:outline-hidden disabled:cursor-not-allowed disabled:opacity-50',
          className,
        )}
        {...props}
      />
    </ScrollArea>
  ),
);
ComposerInput.displayName = 'ComposerInput';

export const ComposerActions = forwardRef<HTMLDivElement, ComponentPropsWithoutRef<'div'>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      role="region"
      data-slot="composer-actions"
      className={cn('flex flex-wrap-reverse items-center justify-between gap-2 px-1.5 pb-1.5', className)}
      {...props}
    />
  ),
);
ComposerActions.displayName = 'ComposerActions';

const ComposerGradientColumn = ({ className }: { className?: string }) => (
  <div className={cn('flex size-full flex-col -space-y-3', className)}>
    <div className="w-full flex-1 bg-accent1 blur-xl" />
    <div className="w-full flex-1 bg-accent1Dark blur-xl" />
    <div className="w-full flex-1 bg-accent1 blur-xl" />
    <div className="w-full flex-1 bg-accent1Darker blur-xl" />
  </div>
);

const ComposerSendingPulse = ({ pulseKey }: { pulseKey: number }) => {
  if (pulseKey === 0) return null;

  return (
    <div
      key={pulseKey}
      aria-hidden="true"
      data-slot="composer-sending-pulse"
      className="composer-sending pointer-events-none absolute top-0 left-[-10%] z-0 flex h-10 w-[120%] transform-gpu"
    >
      <ComposerGradientColumn />
      <ComposerGradientColumn className="-translate-y-2" />
      <ComposerGradientColumn />
    </div>
  );
};
