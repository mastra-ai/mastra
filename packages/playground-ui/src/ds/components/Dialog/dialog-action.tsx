import { forwardRef, useEffect, useId, useRef, useState } from 'react';
import type { ComponentProps, KeyboardEvent, MouseEvent, PointerEvent } from 'react';
import { dialogActionLayoutClasses, dialogActionSizeClasses, useDialogContext } from './dialog-context';
import { Button } from '@/ds/components/Button';
import type { TextButtonSize } from '@/ds/components/Button';
import { cn } from '@/lib/utils';

export type DialogActionProps = Omit<ComponentProps<typeof Button>, 'onClick' | 'variant' | 'as' | 'type' | 'size'> & {
  size?: TextButtonSize;
  onConfirm: () => void;
  confirmation?: 'click' | 'hold';
  holdSeconds?: number;
};

const ARM_WINDOW_MS = 4000;

const HoldAction = forwardRef<HTMLButtonElement, Omit<DialogActionProps, 'confirmation'>>(
  ({ onConfirm, children, disabled, holdSeconds = 1.5, ...props }, ref) => {
    const { intent, pending } = useDialogContext();
    const [holding, setHolding] = useState(false);
    const [completed, setCompleted] = useState(false);
    const [armed, setArmed] = useState(false);
    const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
    const armTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
    const active = useRef(false);
    const hintId = useId();

    function cancel() {
      clearTimeout(timer.current);
      active.current = false;
      setHolding(false);
    }

    function disarm() {
      clearTimeout(armTimer.current);
      setArmed(false);
    }

    function complete() {
      setHolding(false);
      setCompleted(true);
      disarm();
      onConfirm();
    }

    function start() {
      if (disabled || active.current) return;
      active.current = true;
      setHolding(true);
      timer.current = setTimeout(complete, holdSeconds * 1000);
    }

    function onClick(event: MouseEvent<HTMLButtonElement>) {
      event.preventDefault();
      if (event.detail !== 0 || disabled) return;
      if (armed) {
        complete();
        return;
      }
      setArmed(true);
      armTimer.current = setTimeout(() => setArmed(false), ARM_WINDOW_MS);
    }

    useEffect(() => {
      function onVisibilityChange() {
        if (document.hidden) cancel();
      }
      window.addEventListener('blur', cancel);
      document.addEventListener('visibilitychange', onVisibilityChange);
      return () => {
        clearTimeout(timer.current);
        clearTimeout(armTimer.current);
        window.removeEventListener('blur', cancel);
        document.removeEventListener('visibilitychange', onVisibilityChange);
      };
    }, []);

    function onPointerDown(event: PointerEvent<HTMLButtonElement>) {
      props.onPointerDown?.(event);
      if (event.defaultPrevented || event.button !== 0 || !event.isPrimary) return;
      start();
    }

    function onKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
      props.onKeyDown?.(event);
      if (event.defaultPrevented || (event.key !== ' ' && event.key !== 'Enter')) return;
      event.preventDefault();
      if (!event.repeat) start();
    }

    return (
      <>
        <Button
          size="md"
          {...props}
          className={cn(
            'group/hold relative isolate touch-none overflow-hidden select-none',
            dialogActionLayoutClasses,
            dialogActionSizeClasses[props.size ?? 'md'],
            props.className,
          )}
          ref={ref}
          type="button"
          variant={intent === 'destructive' ? 'destructive-ghost' : 'ghost'}
          disabled={disabled}
          aria-describedby={[props['aria-describedby'], hintId].filter(Boolean).join(' ')}
          data-holding={holding || undefined}
          data-completed={completed || pending || undefined}
          onClick={onClick}
          onPointerDown={onPointerDown}
          onPointerUp={event => {
            cancel();
            props.onPointerUp?.(event);
          }}
          onPointerLeave={event => {
            cancel();
            props.onPointerLeave?.(event);
          }}
          onPointerCancel={event => {
            cancel();
            props.onPointerCancel?.(event);
          }}
          onKeyDown={onKeyDown}
          onKeyUp={event => {
            if (event.key === ' ' || event.key === 'Enter') {
              event.preventDefault();
              cancel();
            }
            props.onKeyUp?.(event);
          }}
          onBlur={event => {
            cancel();
            props.onBlur?.(event);
          }}
        >
          <span>{children}</span>
          <span
            aria-hidden="true"
            className={cn(
              'pointer-events-none absolute inset-0 flex items-center justify-center px-[inherit] [clip-path:inset(0_100%_0_0)]',
              'transition-[clip-path] ease-linear motion-reduce:transition-none',
              'group-data-[holding]/hold:[clip-path:inset(0)] motion-reduce:group-data-[holding]/hold:[clip-path:inset(0_50%_0_0)]',
              'group-data-[completed]/hold:[clip-path:inset(0)]',
              intent === 'destructive' ? 'bg-accent2 text-white' : 'bg-neutral6 text-surface1',
            )}
            style={{ transitionDuration: holding ? `${holdSeconds}s` : '0s' }}
          >
            {children}
          </span>
        </Button>
        <span id={hintId} className="sr-only">
          Hold Space or Enter for {holdSeconds} seconds to confirm. Release to cancel. Screen reader users can activate
          twice.
        </span>
        <span role="status" className="sr-only">
          {armed ? 'Activate again to confirm.' : ''}
        </span>
      </>
    );
  },
);
HoldAction.displayName = 'DialogHoldAction';

export const DialogAction = forwardRef<HTMLButtonElement, DialogActionProps>(
  ({ confirmation = 'click', holdSeconds = 1.5, onConfirm, disabled, ...props }, ref) => {
    const { intent, pending } = useDialogContext();
    const isDisabled = disabled || pending;
    if (confirmation === 'hold') {
      return (
        <HoldAction
          key={`${isDisabled}-${holdSeconds}`}
          holdSeconds={holdSeconds}
          {...props}
          ref={ref}
          disabled={isDisabled}
          onConfirm={onConfirm}
        />
      );
    }
    return (
      <Button
        size="md"
        {...props}
        className={cn(dialogActionLayoutClasses, dialogActionSizeClasses[props.size ?? 'md'], props.className)}
        ref={ref}
        type="button"
        variant={intent === 'destructive' ? 'destructive' : 'primary'}
        disabled={isDisabled}
        onClick={onConfirm}
      />
    );
  },
);
DialogAction.displayName = 'DialogAction';
