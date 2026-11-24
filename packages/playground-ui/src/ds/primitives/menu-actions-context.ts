import type { Menu as MenuPrimitive } from '@base-ui/react/menu';
import * as React from 'react';

/** Lets an item close the menu it's in. Set by `DropdownMenu` and `ContextMenu`. */
export const MenuActionsContext = React.createContext<React.RefObject<MenuPrimitive.Root.Actions | null> | null>(null);
