import type { ComponentPropsWithoutRef } from 'react';
import { forwardRef } from 'react';

import { ScrollArea } from '../ScrollArea';
import { cn } from '@/lib/utils';

import './composer-sending.css';

export type ComposerProps = ComponentPropsWithoutRef<'form'>;

export interface ComposerInputProps extends ComponentPropsWithoutRef<'textarea'> {
  /** Maximum height of the scrolling input viewport. */
  maxHeight?: string;
}

export const Composer = forwardRef<HTMLFormElement, ComposerProps>(({ children, ...props }, ref) => (
  <form ref={ref} data-slot="composer" {...props}>
    {children}
  </form>
));
Composer.displayName = 'Composer';

export interface ComposerBoxProps extends ComponentPropsWithoutRef<'div'> {
  sendingPulseKey?: number;
}

export const ComposerBox = forwardRef<HTMLDivElement, ComposerBoxProps>(
  ({ children, className, sendingPulseKey = 0, ...props }, ref) => (
    <div
      ref={ref}
      data-slot="composer-box"
      className={cn(
        'duration-normal @container relative mx-auto mt-auto w-full max-w-3xl overflow-hidden rounded-[22px] border border-border2/40 bg-surface3 transition-colors focus-within:border-border2',
        className,
      )}
      {...props}
    >
      <ComposerSendingPulse pulseKey={sendingPulseKey} />
      <div className="relative z-10">{children}</div>
    </div>
  ),
);
ComposerBox.displayName = 'ComposerBox';

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

export const ComposerInput = forwardRef<HTMLTextAreaElement, ComposerInputProps>(
  ({ className, maxHeight = '212px', ...props }, ref) => (
    <ScrollArea maxHeight={maxHeight}>
      <textarea
        ref={ref}
        data-slot="composer-input"
        className={cn(
          'min-h-17 field-sizing-content w-full resize-none overflow-hidden bg-transparent px-3 pt-3 pb-2 text-ui-lg leading-ui-lg text-neutral6 outline-hidden placeholder:text-neutral3 focus:outline-hidden disabled:cursor-not-allowed disabled:opacity-50',
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
