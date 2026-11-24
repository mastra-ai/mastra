import type { ComponentProps } from 'react';
import { use, useMemo } from 'react';

import { ChatShellComposerInputContext } from '../ChatShell/chat-shell-context';
import { ScrollArea } from '../ScrollArea';
import { attachComposerEngagement, claimComposerPress } from './composer-engagement';
import { observeComposerStatus } from './composer-status-presence';
import { textFieldAutofillProps } from '@/ds/primitives/password-manager-autofill';
import { mergeRefs } from '@/lib/merge-refs';
import { cn } from '@/lib/utils';

import './composer.css';
import './composer-line.css';
import './composer-ring.css';
import './composer-sending.css';
import './composer-status.css';

export type ComposerProps = ComponentProps<'form'>;

export interface ComposerInputProps extends ComponentProps<'textarea'> {
  variant?: 'inline' | 'textarea';
  maxHeight?: string;
}

/**
 * One line until the input is focused or holds a draft, then opens a row above the actions for the
 * input. Positioned so an overlay `ComposerHeader` can anchor to its top edge.
 */
export function Composer({ ref, className, onPointerDownCapture, ...props }: ComposerProps) {
  const rootRef = useMemo(() => mergeRefs(ref, attachComposerEngagement), [ref]);
  return (
    <form
      ref={rootRef}
      data-slot="composer"
      className={cn('relative', className)}
      onPointerDownCapture={event => {
        onPointerDownCapture?.(event);
        claimComposerPress(event);
      }}
      {...props}
    />
  );
}

export interface ComposerBoxProps extends ComponentProps<'div'> {
  sendingPulseKey?: number;
}

export function ComposerBox({ children, className, sendingPulseKey = 0, ...props }: ComposerBoxProps) {
  return (
    <div
      data-slot="composer-box"
      className={cn(
        // Content sits on the bottom edge, so the action row stays put while the box grows or shrinks above it.
        'composer-box @container relative mx-auto mt-auto flex w-full max-w-3xl flex-col justify-end overflow-hidden rounded-(--composer-radius)',
        className,
      )}
      {...props}
    >
      <ComposerSendingPulse pulseKey={sendingPulseKey} />
      <div data-slot="composer-box-content" className="relative z-10">
        {children}
      </div>
    </div>
  );
}

export type ComposerTone = 'default' | 'green' | 'purple' | 'orange';

export interface ComposerRingProps extends ComponentProps<'div'> {
  busy?: boolean;
}

export function ComposerRing({ busy = false, className, children, ...props }: ComposerRingProps) {
  return (
    <div
      data-slot="composer-ring"
      data-busy={busy ? 'true' : 'false'}
      className={cn('composer-ring relative mx-auto w-full max-w-3xl rounded-(--composer-radius)', className)}
      {...props}
    >
      <span aria-hidden="true" className="composer-ring-drift">
        <span className="composer-ring-drift-haze">
          <span />
          <span />
          <span />
        </span>
        <span className="composer-ring-drift-rim">
          <span />
          <span />
          <span />
        </span>
      </span>
      {children}
    </div>
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
  placeholder,
  ...props
}: ComposerInputProps) {
  const shellInputRef = use(ChatShellComposerInputContext);
  const inputRef = useMemo(() => mergeRefs(ref, shellInputRef), [ref, shellInputRef]);
  return (
    <ScrollArea maxHeight={maxHeight ?? (variant === 'textarea' ? '16rem' : '13rem')}>
      <textarea
        ref={inputRef}
        data-slot="composer-input"
        data-variant={variant}
        className={cn(
          'field-sizing-content w-full resize-none overflow-hidden bg-transparent px-3 pt-2.5 pb-2 text-body zoom-safe-text text-muted-foreground outline-hidden placeholder:text-placeholder focus:outline-hidden disabled:cursor-not-allowed disabled:opacity-50',
          variant === 'textarea' ? 'min-h-28' : 'min-h-10',
          className,
        )}
        // A blank placeholder keeps `:placeholder-shown`, which the one-line layout reads as "no draft".
        placeholder={placeholder || ' '}
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
      className={cn(
        'flex w-full flex-wrap items-end justify-between gap-2 px-(--composer-inset) pb-(--composer-inset)',
        className,
      )}
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

/** Trailing actions: model, voice, and the primary Send action last. Right-aligned; labels truncate instead of wrapping. */
export function ComposerActionsEnd({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      data-slot="composer-actions-end"
      className={cn('flex min-w-0 flex-[1_1_0] items-center justify-end gap-1.5', className)}
      {...props}
    />
  );
}

/** Actions that only show once the composer opens, such as model settings. */
export function ComposerActionsDetail({ className, ...props }: ComponentProps<'div'>) {
  return <div data-slot="composer-actions-detail" className={cn('contents', className)} {...props} />;
}

/**
 * Session status footer below the composer, outside the input box. Holds one control's height while
 * it has something to show and gives the row back when it doesn't. Opening the composer never
 * changes it, so the composer's bottom edge stays put.
 */
export function ComposerStatus({ ref, className, ...props }: ComponentProps<'div'>) {
  const statusRef = useMemo(() => mergeRefs(ref, observeComposerStatus), [ref]);
  return (
    <div
      ref={statusRef}
      data-slot="composer-status"
      className={cn(
        'mx-auto flex min-h-control-sm w-full max-w-3xl min-w-0 items-center gap-3 px-3 text-caption text-muted-foreground',
        className,
      )}
      {...props}
    />
  );
}

/** Who and what the session is doing, such as who is steering it. Truncates before the end group. */
export function ComposerStatusStart({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      data-slot="composer-status-start"
      className={cn('flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1', className)}
      {...props}
    />
  );
}

/** Runtime readings, such as token rate and memory budgets. Stays right-aligned when alone. */
export function ComposerStatusEnd({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      data-slot="composer-status-end"
      className={cn('ml-auto flex shrink-0 items-center gap-3', className)}
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
