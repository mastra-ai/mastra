import type { ComponentPropsWithoutRef } from 'react';
import { forwardRef } from 'react';

import { ScrollArea } from '../ScrollArea';
import { useComposerPointer } from './use-composer-pointer';
import { cn } from '@/lib/utils';

import './composer.css';
import './composer-ring.css';
import './composer-sending.css';

export type ComposerProps = ComponentPropsWithoutRef<'form'>;

export interface ComposerInputProps extends ComponentPropsWithoutRef<'textarea'> {
  variant?: 'inline' | 'textarea';
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
        'composer-box @container relative mx-auto mt-auto w-full max-w-3xl overflow-hidden rounded-[22px] border border-border2/40 transition-colors duration-normal focus-within:border-border2',
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

export interface ComposerRingProps extends ComponentPropsWithoutRef<'div'> {
  busy?: boolean;
  mode?: string;
}

export const ComposerRing = ({ busy = false, mode = 'build', className, ...props }: ComposerRingProps) => {
  const ringRef = useComposerPointer(!busy);

  return (
    <div
      ref={ringRef}
      data-slot="composer-ring"
      data-composer-mode={mode.toLowerCase()}
      data-busy={busy ? 'true' : 'false'}
      className={cn('composer-ring relative mx-auto w-full max-w-3xl rounded-[23px] p-px', className)}
      {...props}
    />
  );
};
ComposerRing.displayName = 'ComposerRing';

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
  ({ className, variant = 'inline', maxHeight, ...props }, ref) => (
    <ScrollArea maxHeight={maxHeight ?? (variant === 'textarea' ? '16rem' : '13rem')}>
      <textarea
        ref={ref}
        data-slot="composer-input"
        className={cn(
          'field-sizing-content w-full resize-none overflow-hidden bg-transparent px-3 pt-2.5 pb-2 text-ui-md leading-ui-md font-[450] text-neutral4 outline-hidden placeholder:text-neutral2 focus:outline-hidden disabled:cursor-not-allowed disabled:opacity-50',
          variant === 'textarea' ? 'min-h-28' : 'min-h-10',
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
      className={cn('flex w-full flex-wrap items-end justify-between gap-2 px-3 pb-3', className)}
      {...props}
    />
  ),
);
ComposerActions.displayName = 'ComposerActions';

const ComposerGradientColumn = ({ className }: { className?: string }) => (
  <div className={cn('flex size-full flex-col -space-y-3', className)}>
    <div className="bg-accent1 w-full flex-1 blur-xl" />
    <div className="bg-accent1Dark w-full flex-1 blur-xl" />
    <div className="bg-accent1 w-full flex-1 blur-xl" />
    <div className="bg-accent1Darker w-full flex-1 blur-xl" />
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

export interface ComposerModeLabelProps extends ComponentPropsWithoutRef<'span'> {
  mode: string;
}

export function ComposerModeLabel({ mode, className, ...props }: ComposerModeLabelProps) {
  return <span data-composer-mode={mode.toLowerCase()} className={cn('composer-mode-label', className)} {...props} />;
}
