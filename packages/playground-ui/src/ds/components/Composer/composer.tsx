import type { ComponentProps } from 'react';
import { use } from 'react';

import { ChatShellComposerInputContext } from '../ChatShell/chat-shell-context';
import { ScrollArea } from '../ScrollArea';
import { useComposerPointer } from './use-composer-pointer';
import { textFieldAutofillProps } from '@/ds/primitives/password-manager-autofill';
import { mergeRefs } from '@/lib/merge-refs';
import { cn } from '@/lib/utils';

import './composer.css';
import './composer-ring.css';
import './composer-sending.css';

export type ComposerProps = ComponentProps<'form'>;

export interface ComposerInputProps extends ComponentProps<'textarea'> {
  variant?: 'inline' | 'textarea';
  maxHeight?: string;
}

/** Positioned so an overlay `ComposerHeader` can anchor to its top edge. */
export function Composer({ className, ...props }: ComposerProps) {
  return <form data-slot="composer" className={cn('relative', className)} {...props} />;
}

export interface ComposerBoxProps extends ComponentProps<'div'> {
  sendingPulseKey?: number;
}

export function ComposerBox({ children, className, sendingPulseKey = 0, ...props }: ComposerBoxProps) {
  return (
    <div
      data-slot="composer-box"
      className={cn(
        // The suggestions list and the input scroll flush with the top corners, so their scrollbars
        // take the inset for this radius.
        'composer-box @container relative mx-auto mt-auto w-full max-w-3xl overflow-hidden rounded-[22px] border border-border transition-colors duration-normal scrollbar-inset-[22px] focus-within:border-border-strong',
        className,
      )}
      {...props}
    >
      <ComposerSendingPulse pulseKey={sendingPulseKey} />
      <div className="relative z-10">{children}</div>
    </div>
  );
}

export type ComposerTone = 'default' | 'green' | 'purple' | 'orange';

export interface ComposerRingProps extends ComponentProps<'div'> {
  busy?: boolean;
  tone?: ComposerTone;
}

export function ComposerRing({
  busy = false,
  tone = 'green',
  className,
  style,
  onPointerEnter,
  onPointerMove,
  ...props
}: ComposerRingProps) {
  const { trackPointer, pointerStyle } = useComposerPointer(!busy);

  return (
    <div
      data-slot="composer-ring"
      data-composer-tone={tone}
      data-busy={busy ? 'true' : 'false'}
      className={cn('composer-ring relative mx-auto w-full max-w-3xl rounded-[23px] p-px', className)}
      style={{ ...pointerStyle, ...style }}
      onPointerEnter={event => {
        onPointerEnter?.(event);
        trackPointer(event);
      }}
      onPointerMove={event => {
        onPointerMove?.(event);
        trackPointer(event);
      }}
      {...props}
    />
  );
}

export function ComposerAttachments({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      role="region"
      data-slot="composer-attachments"
      className={cn('mx-auto w-full max-w-3xl pb-2', className)}
      {...props}
    />
  );
}

export function ComposerInput({
  ref,
  className,
  variant = 'inline',
  maxHeight,
  autoComplete,
  ...props
}: ComposerInputProps) {
  const shellInputRef = use(ChatShellComposerInputContext);
  return (
    <ScrollArea maxHeight={maxHeight ?? (variant === 'textarea' ? '16rem' : '13rem')}>
      <textarea
        ref={mergeRefs(ref, shellInputRef)}
        data-slot="composer-input"
        className={cn(
          'field-sizing-content w-full resize-none overflow-hidden bg-transparent px-3 pt-2.5 pb-2 text-body zoom-safe-text text-muted-foreground outline-hidden placeholder:text-placeholder focus:outline-hidden disabled:cursor-not-allowed disabled:opacity-50',
          variant === 'textarea' ? 'min-h-28' : 'min-h-10',
          className,
        )}
        {...props}
        {...textFieldAutofillProps(autoComplete)}
      />
    </ScrollArea>
  );
}

export function ComposerActions({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      role="region"
      data-slot="composer-actions"
      className={cn('flex w-full flex-wrap items-end justify-between gap-2 px-3 pb-3', className)}
      {...props}
    />
  );
}

/** Leading actions, such as attaching files. */
export function ComposerActionsStart({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      data-slot="composer-actions-start"
      className={cn('flex min-w-0 shrink-0 items-center gap-1.5', className)}
      {...props}
    />
  );
}

/** Trailing actions: model, voice, and the primary Send action last. Stays right-aligned when alone. */
export function ComposerActionsEnd({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      data-slot="composer-actions-end"
      className={cn('ml-auto flex max-w-full min-w-0 items-center justify-end gap-1.5', className)}
      {...props}
    />
  );
}

/**
 * Session status above the composer, outside the input box: right-aligned, wraps on narrow screens,
 * and takes no space when nothing renders inside it.
 */
export function ComposerStatus({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      data-slot="composer-status"
      className={cn(
        'mx-auto flex w-full max-w-3xl min-w-0 flex-wrap items-center justify-end gap-x-3 gap-y-1 px-3 text-caption text-muted-foreground empty:hidden',
        className,
      )}
      {...props}
    />
  );
}

const ComposerGradientColumn = ({ className }: { className?: string }) => (
  <div className={cn('flex size-full flex-col -space-y-3', className)}>
    <div className="w-full flex-1 bg-brand-green blur-xl" />
    <div className="w-full flex-1 bg-product-observability blur-xl" />
    <div className="w-full flex-1 bg-brand-green blur-xl" />
    <div className="w-full flex-1 bg-product-observability blur-xl" />
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

export interface ComposerToneLabelProps extends ComponentProps<'span'> {
  tone: ComposerTone;
}

export function ComposerToneLabel({ tone, className, ...props }: ComposerToneLabelProps) {
  return <span data-composer-tone={tone} className={cn('composer-tone-label', className)} {...props} />;
}
