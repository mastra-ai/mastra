import { Plus } from 'lucide-react';
import React, { useRef } from 'react';
import { Button } from './Button';
import type { ButtonProps } from './Button';
import { Kbd } from '@/ds/components/Kbd';
import { useKeydown } from '@/lib/keyboard';

export const CREATE_BUTTON_SHORTCUT = 'c';

export interface CreateButtonProps extends Omit<ButtonProps, 'icon' | 'tooltip'> {
  /** Tooltip text. The `C` shortcut hint is appended automatically. */
  tooltip: string;
  /** Set to `false` to unbind the `C` shortcut (the button stays clickable). Defaults to `true`. */
  shortcutEnabled?: boolean;
}

/**
 * "Create" call-to-action: always renders a `Plus` icon and binds the `C` key to
 * its click. Mount at most one per view — several instances would compete for
 * the same shortcut.
 */
export const CreateButton = React.forwardRef<HTMLButtonElement, CreateButtonProps>(
  ({ tooltip, shortcutEnabled = true, disabled, children, ...props }, forwardedRef) => {
    const buttonRef = useRef<HTMLButtonElement>(null);

    useKeydown(
      { [CREATE_BUTTON_SHORTCUT]: () => buttonRef.current?.click() },
      { enabled: shortcutEnabled && !disabled },
    );

    return (
      <Button
        ref={mergeRefs(buttonRef, forwardedRef)}
        icon={<Plus />}
        disabled={disabled}
        tooltip={
          <span className="inline-flex items-center gap-1.5">
            {tooltip}
            <Kbd size="xs">C</Kbd>
          </span>
        }
        {...props}
      >
        {children}
      </Button>
    );
  },
);
CreateButton.displayName = 'CreateButton';

const mergeRefs =
  <TElement,>(...refs: Array<React.Ref<TElement> | undefined>) =>
  (element: TElement | null) => {
    refs.forEach(ref => {
      if (!ref) return;
      if (typeof ref === 'function') {
        ref(element);
        return;
      }
      ref.current = element;
    });
  };
