import { Combobox as ComboboxPrimitive } from '@base-ui/react/combobox';
import type { ReactNode, RefObject } from 'react';
import { useFilterBarContext } from '../filter-bar-context';
import styles from './filter-bar-animation.module.css';
import { comboboxStyles } from '@/ds/components/Combobox/combobox-styles';
import { FLOATING_POSITION_METHOD } from '@/ds/primitives/floating';
import { MENU_SIDE_OFFSET } from '@/ds/primitives/menu-item';
import { usePortalContainer } from '@/ds/primitives/portal-container';
import { cn } from '@/lib/utils';

export function FilterBarPopup({
  inputRef,
  buttonRef,
  children,
}: {
  inputRef: RefObject<HTMLInputElement | null>;
  buttonRef: RefObject<HTMLButtonElement | null>;
  children: ReactNode;
}) {
  const { variant } = useFilterBarContext();
  const container = usePortalContainer();
  const isButton = variant === 'button';
  return (
    <ComboboxPrimitive.Portal container={container}>
      <ComboboxPrimitive.Positioner
        anchor={isButton ? buttonRef : inputRef}
        align="start"
        sideOffset={MENU_SIDE_OFFSET}
        positionMethod={FLOATING_POSITION_METHOD}
        className={comboboxStyles.positioner}
      >
        <ComboboxPrimitive.Popup
          className={cn(
            comboboxStyles.popup,
            'max-w-[min(var(--available-width),calc(100vw-2rem))]',
            'data-[closed]:animate-none data-[open]:animate-none',
            styles.popup,
          )}
          data-slot="filter-bar-editor"
          initialFocus={isButton ? inputRef : undefined}
          finalFocus={isButton ? buttonRef : undefined}
        >
          {children}
        </ComboboxPrimitive.Popup>
      </ComboboxPrimitive.Positioner>
    </ComboboxPrimitive.Portal>
  );
}
