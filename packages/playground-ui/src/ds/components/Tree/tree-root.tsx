import * as React from 'react';
import { TreeProvider, TreeDepthProvider } from './tree-context';
import { useIsomorphicLayoutEffect } from '@/hooks/use-isomorphic-layout-effect';
import { cn } from '@/lib/utils';

const TREE_FOCUSABLE_ITEM_SELECTOR = '[data-tree-item-kind="folder"], [data-tree-item-kind="file"]';
const TREE_FOLDER_TRIGGER_SELECTOR = '[data-tree-folder-trigger="true"]';

export interface TreeRootProps {
  selectedId?: string;
  onSelect?: (id: string) => void;
  className?: string;
  children: React.ReactNode;
}

function assignRef<T>(ref: React.ForwardedRef<T>, value: T | null) {
  if (typeof ref === 'function') {
    ref(value);
  } else if (ref) {
    ref.current = value;
  }
}

function getTreeItems(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(TREE_FOCUSABLE_ITEM_SELECTOR)).filter(
    item => item.getAttribute('role') === 'treeitem',
  );
}

function setTabStops(items: HTMLElement[], focusableItem: HTMLElement) {
  for (const item of items) {
    item.tabIndex = item === focusableItem ? 0 : -1;
  }
}

function syncTreeItemSetMetadata(root: HTMLElement) {
  const groups = [root, ...Array.from(root.querySelectorAll<HTMLElement>('[role="group"]'))];

  for (const group of groups) {
    const items = Array.from(group.children).filter(
      (child): child is HTMLElement =>
        child instanceof HTMLElement &&
        child.getAttribute('role') === 'treeitem' &&
        child.hasAttribute('data-tree-item-kind'),
    );

    items.forEach((item, index) => {
      item.setAttribute('aria-posinset', String(index + 1));
      item.setAttribute('aria-setsize', String(items.length));
    });
  }
}

function findSelectedItem(items: HTMLElement[], selectedId: string | undefined): HTMLElement | null {
  if (!selectedId) return null;
  return items.find(item => item.dataset.treeItemId === selectedId) ?? null;
}

function getActiveTreeItem(root: HTMLElement, items: HTMLElement[]): HTMLElement | null {
  const activeElement = root.ownerDocument.activeElement;
  if (!(activeElement instanceof HTMLElement) || !root.contains(activeElement)) return null;

  const activeItem = activeElement.closest<HTMLElement>(TREE_FOCUSABLE_ITEM_SELECTOR);
  return activeItem && items.includes(activeItem) ? activeItem : null;
}

function getClosestTreeItem(root: HTMLElement, target: EventTarget | null): HTMLElement | null {
  if (!(target instanceof HTMLElement) || !root.contains(target)) return null;
  const item = target.closest<HTMLElement>(TREE_FOCUSABLE_ITEM_SELECTOR);
  return item?.getAttribute('role') === 'treeitem' ? item : null;
}

function focusTreeItem(root: HTMLElement, item: HTMLElement, options: { focus?: boolean } = {}) {
  const items = getTreeItems(root);
  if (!items.includes(item)) return;

  setTabStops(items, item);
  if (options.focus !== false) {
    item.focus();
  }
}

function syncTreeTabStops(root: HTMLElement, selectedId: string | undefined) {
  const items = getTreeItems(root);
  syncTreeItemSetMetadata(root);

  const firstItem = items[0];
  if (!firstItem) return;

  const activeItem = getActiveTreeItem(root, items);
  const selectedItem = findSelectedItem(items, selectedId);
  setTabStops(items, activeItem ?? selectedItem ?? firstItem);
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.dataset.treeFolderTrigger === 'true') return false;
  if (target.isContentEditable) return true;

  return !!target.closest('input, textarea, select, button, [contenteditable="true"]');
}

function getFolderTrigger(item: HTMLElement): HTMLButtonElement | null {
  return item.querySelector<HTMLButtonElement>(TREE_FOLDER_TRIGGER_SELECTOR);
}

function getParentTreeItem(item: HTMLElement): HTMLElement | null {
  const parentGroup = item.parentElement?.closest('[role="group"]');
  return parentGroup?.closest<HTMLElement>(TREE_FOCUSABLE_ITEM_SELECTOR) ?? null;
}

function activateTreeItem(item: HTMLElement) {
  const trigger = getFolderTrigger(item);
  if (trigger) {
    trigger.click();
  } else {
    item.click();
  }
}

export const TreeRoot = React.forwardRef<HTMLUListElement, TreeRootProps>(
  ({ selectedId, onSelect, className, children }, ref) => {
    const rootRef = React.useRef<HTMLUListElement | null>(null);

    const handleRootRef = React.useCallback(
      (node: HTMLUListElement | null) => {
        rootRef.current = node;
        assignRef(ref, node);
      },
      [ref],
    );

    const focusItem = React.useCallback((item: HTMLElement, options?: { focus?: boolean }) => {
      const root = rootRef.current;
      if (!root) return;
      focusTreeItem(root, item, options);
    }, []);

    const handleKeyDown = React.useCallback((event: React.KeyboardEvent<HTMLUListElement>) => {
      if (event.defaultPrevented || isEditableTarget(event.target)) return;

      const root = rootRef.current;
      if (!root) return;

      const items = getTreeItems(root);
      const currentItem =
        getClosestTreeItem(root, event.target) ??
        getActiveTreeItem(root, items) ??
        items.find(item => item.tabIndex === 0);
      if (!currentItem) return;

      const currentIndex = items.indexOf(currentItem);
      if (currentIndex < 0) return;

      let nextItem: HTMLElement | null = null;
      let handled = true;

      switch (event.key) {
        case 'ArrowDown':
          nextItem = items[Math.min(currentIndex + 1, items.length - 1)] ?? null;
          break;
        case 'ArrowUp':
          nextItem = items[Math.max(currentIndex - 1, 0)] ?? null;
          break;
        case 'Home':
          nextItem = items[0] ?? null;
          break;
        case 'End':
          nextItem = items[items.length - 1] ?? null;
          break;
        case 'ArrowRight': {
          const trigger = getFolderTrigger(currentItem);
          if (trigger && currentItem.getAttribute('aria-expanded') !== 'true') {
            trigger.click();
            nextItem = currentItem;
          } else {
            nextItem = items[Math.min(currentIndex + 1, items.length - 1)] ?? null;
          }
          break;
        }
        case 'ArrowLeft': {
          const trigger = getFolderTrigger(currentItem);
          if (trigger && currentItem.getAttribute('aria-expanded') === 'true') {
            trigger.click();
            nextItem = currentItem;
          } else {
            nextItem = getParentTreeItem(currentItem);
          }
          break;
        }
        case 'Enter':
        case ' ':
        case 'Spacebar':
          activateTreeItem(currentItem);
          nextItem = currentItem;
          break;
        default:
          handled = false;
      }

      if (!handled) return;

      event.preventDefault();
      event.stopPropagation();

      if (nextItem) {
        focusTreeItem(root, nextItem);
      }
    }, []);

    useIsomorphicLayoutEffect(() => {
      const root = rootRef.current;
      if (!root) return;
      syncTreeTabStops(root, selectedId);
    }, [children, selectedId]);

    React.useEffect(() => {
      const root = rootRef.current;
      if (!root || typeof MutationObserver === 'undefined') return;

      const observer = new MutationObserver(() => {
        syncTreeTabStops(root, selectedId);
      });
      observer.observe(root, { childList: true, subtree: true });

      return () => {
        observer.disconnect();
      };
    }, [selectedId]);

    const contextValue = React.useMemo(() => ({ selectedId, onSelect, focusItem }), [selectedId, onSelect, focusItem]);

    return (
      <TreeProvider value={contextValue}>
        <TreeDepthProvider depth={0}>
          <ul
            ref={handleRootRef}
            role="tree"
            className={cn('flex flex-col text-xs', className)}
            onKeyDown={handleKeyDown}
          >
            {children}
          </ul>
        </TreeDepthProvider>
      </TreeProvider>
    );
  },
);
TreeRoot.displayName = 'Tree';
