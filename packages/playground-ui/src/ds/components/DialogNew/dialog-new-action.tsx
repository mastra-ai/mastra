import { forwardRef, useEffect, useId, useRef, useState } from 'react';
import type { ComponentProps, KeyboardEvent, PointerEvent } from 'react';
import { useDialogNew } from './dialog-new-context';
import { Button } from '@/ds/components/Button';

export type DialogNewActionProps = Omit<ComponentProps<typeof Button>, 'onClick' | 'variant' | 'as' | 'type'> & {
  onConfirm: () => void;
  confirmation?: 'click' | 'hold';
  holdSeconds?: number;
};

const HoldAction = forwardRef<HTMLButtonElement, Omit<DialogNewActionProps, 'confirmation'>>(
  ({ onConfirm, children, disabled, holdSeconds = 1.5, ...props }, ref) => {
    const { variant, pending } = useDialogNew();
    const [holding, setHolding] = useState(false);
    const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
    const active = useRef(false);
    const hintId = useId();

    function cancel() {
      clearTimeout(timer.current);
      active.current = false;
      setHolding(false);
    }

    function start() {
      if (disabled || active.current) return;
      active.current = true;
      setHolding(true);
      timer.current = setTimeout(() => {
        setHolding(false);
        onConfirm();
      }, holdSeconds * 1000);
    }

    useEffect(() => {
      function onVisibilityChange() {
        if (document.hidden) cancel();
      }
      window.addEventListener('blur', cancel);
      document.addEventListener('visibilitychange', onVisibilityChange);
      return () => {
        clearTimeout(timer.current);
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
      <div className="dialog-new-hold contents">
        <Button
          size="md"
          data-dialog-size={props.size ?? 'md'}
          {...props}
          ref={ref}
          type="button"
          variant={variant === 'destructive' ? 'destructive-ghost' : 'ghost'}
          disabled={disabled}
          aria-describedby={[props['aria-describedby'], hintId].filter(Boolean).join(' ')}
          data-holding={holding || undefined}
          data-confirmed={pending || undefined}
          onClick={event => event.preventDefault()}
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
            className="dialog-new-hold-progress"
            style={{ animationDuration: `${holdSeconds}s` }}
          >
            {children}
          </span>
        </Button>
        <span id={hintId} className="sr-only">
          Hold Space or Enter for {holdSeconds} seconds to confirm. Release to cancel.
        </span>
      </div>
    );
  },
);
HoldAction.displayName = 'DialogNewHoldAction';

export const DialogNewAction = forwardRef<HTMLButtonElement, DialogNewActionProps>(
  ({ confirmation = 'click', holdSeconds = 1.5, onConfirm, disabled, ...props }, ref) => {
    const { variant, pending } = useDialogNew();
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
        data-dialog-size={props.size ?? 'md'}
        {...props}
        ref={ref}
        type="button"
        variant={variant === 'destructive' ? 'destructive' : 'primary'}
        disabled={isDisabled}
        onClick={onConfirm}
      />
    );
  },
);
DialogNewAction.displayName = 'DialogNewAction';
