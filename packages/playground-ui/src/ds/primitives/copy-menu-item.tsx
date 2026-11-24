import { Menu as MenuPrimitive } from '@base-ui/react/menu';
import * as React from 'react';
import { CopyIcon, CopyLabel } from '@/ds/components/CopyButton/copy-feedback';
import { MenuActionsContext } from '@/ds/primitives/menu-actions-context';
import { menuItemClass } from '@/ds/primitives/menu-item';
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard';
import { cn } from '@/lib/utils';

const CLOSE_AFTER_COPY_MS = 1000;

export type CopyMenuItemProps = Omit<
  MenuPrimitive.Item.Props,
  'children' | 'closeOnClick' | 'onClick' | 'ref' | 'render'
> & {
  /** What it copies. */
  value: string;
  /** The item's label. It reads "Copied" once copied. */
  children: string;
};

/**
 * A menu item that copies. The menu stays open long enough to show the checkmark and "Copied" on the item, then closes.
 * It stays if the copy failed, or if another item is highlighted by then, so it never closes under a second choice.
 */
export function CopyMenuItem({ value, children, className, ...props }: CopyMenuItemProps) {
  const { status, copyToClipboard } = useCopyToClipboard();
  const menuActions = React.useContext(MenuActionsContext);
  const itemRef = React.useRef<HTMLDivElement>(null);
  const closeTimer = React.useRef<ReturnType<typeof setTimeout>>(undefined);

  function closeMenu() {
    const item = itemRef.current;
    const highlighted = item?.closest('[role=menu]')?.querySelector('[data-highlighted]');
    // No item: the menu closed on its own, and may be open again.
    if (item && (!highlighted || highlighted === item)) menuActions?.current?.close();
  }

  async function copy() {
    clearTimeout(closeTimer.current);
    if (await copyToClipboard(value)) closeTimer.current = setTimeout(closeMenu, CLOSE_AFTER_COPY_MS);
  }

  return (
    <MenuPrimitive.Item
      ref={itemRef}
      closeOnClick={false}
      onClick={() => void copy()}
      className={cn(menuItemClass, className)}
      {...props}
    >
      <CopyIcon status={status} />
      <CopyLabel status={status}>{children}</CopyLabel>
    </MenuPrimitive.Item>
  );
}
