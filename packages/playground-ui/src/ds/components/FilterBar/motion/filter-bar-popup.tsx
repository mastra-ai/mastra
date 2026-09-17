import { Combobox as ComboboxPrimitive } from '@base-ui/react/combobox';
import { AnimatePresence, useReducedMotion } from 'motion/react';
import * as m from 'motion/react-m';
import type { ReactNode, RefObject } from 'react';
import { useFilterBarContext } from '../filter-bar-context';
import styles from './filter-bar-motion.module.css';
import { comboboxStyles } from '@/ds/components/Combobox/combobox-styles';
import { FLOATING_POSITION_METHOD } from '@/ds/primitives/floating';
import { MENU_SIDE_OFFSET } from '@/ds/primitives/menu-item';
import { usePortalContainer } from '@/ds/primitives/portal-container';
import { cn } from '@/lib/utils';

export function FilterBarPopup({
  open,
  inputRef,
  buttonRef,
  children,
}: {
  open: boolean;
  inputRef: RefObject<HTMLInputElement | null>;
  buttonRef: RefObject<HTMLButtonElement | null>;
  children: ReactNode;
}) {
  const { variant } = useFilterBarContext();
  const container = usePortalContainer();
  const reduceMotion = useReducedMotion();
  const isButton = variant === 'button';
  const popup = (
    <ComboboxPrimitive.Portal container={container} keepMounted={isButton}>
      <ComboboxPrimitive.Positioner
        align="start"
        sideOffset={MENU_SIDE_OFFSET}
        positionMethod={FLOATING_POSITION_METHOD}
        className={comboboxStyles.positioner}
      >
        <ComboboxPrimitive.Popup
          className={cn(
            comboboxStyles.popup,
            'max-w-[calc(100vw-2rem)] min-w-44',
            isButton && 'data-[closed]:animate-none data-[open]:animate-none',
            isButton && styles.popup,
          )}
          data-slot="filter-bar-editor"
          initialFocus={isButton ? inputRef : undefined}
          finalFocus={isButton ? buttonRef : undefined}
          render={
            isButton ? (
              <m.div
                initial={reduceMotion ? false : { opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.1 }}
              />
            ) : undefined
          }
        >
          {children}
        </ComboboxPrimitive.Popup>
      </ComboboxPrimitive.Positioner>
    </ComboboxPrimitive.Portal>
  );

  return isButton ? <AnimatePresence>{open && popup}</AnimatePresence> : popup;
}
