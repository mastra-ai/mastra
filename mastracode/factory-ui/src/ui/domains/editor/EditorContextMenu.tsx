import { cn } from '@mastra/playground-ui/utils/cn';
import { useEffect, useMemo, useRef, useState } from 'react';

export interface EditorContextMenuItem {
  id: string;
  label: string;
  disabled?: boolean;
  onSelect: () => void;
}

interface EditorContextMenuProps {
  x: number;
  y: number;
  items: EditorContextMenuItem[];
  onDismiss: () => void;
}

/**
 * Lightweight right-click menu for the code editor (go to definition and
 * friends). Rendered as a fixed overlay at the pointer position; dismissed on
 * outside pointer-down or Escape. Keyboard-friendly: ArrowUp/ArrowDown roam,
 * Enter invokes, Escape dismisses. Skips disabled items when roaming so the
 * keyboard flow matches what the mouse would do.
 */
export function EditorContextMenu({ x, y, items, onDismiss }: EditorContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const enabledIndexes = useMemo(
    () => items.map((item, index) => (item.disabled ? null : index)).filter((index): index is number => index !== null),
    [items],
  );
  const [active, setActive] = useState<number | null>(enabledIndexes[0] ?? null);

  useEffect(() => {
    setActive(previous => (previous !== null && !items[previous]?.disabled ? previous : enabledIndexes[0] ?? null));
  }, [items, enabledIndexes]);

  useEffect(() => {
    function onPointerDown(event: PointerEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) onDismiss();
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onDismiss();
        return;
      }
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        if (enabledIndexes.length === 0) return;
        event.preventDefault();
        setActive(previous => {
          const cursor = previous === null ? -1 : enabledIndexes.indexOf(previous);
          const step = event.key === 'ArrowDown' ? 1 : -1;
          const next = (cursor + step + enabledIndexes.length) % enabledIndexes.length;
          return enabledIndexes[next] ?? null;
        });
        return;
      }
      if (event.key === 'Enter' && active !== null) {
        const item = items[active];
        if (item && !item.disabled) {
          event.preventDefault();
          item.onSelect();
          onDismiss();
        }
      }
    }
    window.addEventListener('pointerdown', onPointerDown, true);
    window.addEventListener('keydown', onKeyDown, true);
    return () => {
      window.removeEventListener('pointerdown', onPointerDown, true);
      window.removeEventListener('keydown', onKeyDown, true);
    };
  }, [onDismiss, items, enabledIndexes, active]);

  // Keep the menu on-screen when the click lands near the viewport edge.
  const menuHeight = Math.max(items.length, 1) * 32 + 16;
  const style: React.CSSProperties = {
    left: Math.min(x, typeof window !== 'undefined' ? window.innerWidth - 240 : x),
    top: Math.min(y, typeof window !== 'undefined' ? window.innerHeight - menuHeight : y),
  };

  return (
    <div
      ref={menuRef}
      role="menu"
      style={style}
      className="border-border bg-popover ring-border/40 fixed z-50 min-w-[13rem] rounded-md border py-1 shadow-xl ring-1"
      data-testid="editor-context-menu"
    >
      {items.map((item, index) => (
        <button
          key={item.id}
          type="button"
          role="menuitem"
          disabled={item.disabled}
          onPointerEnter={() => !item.disabled && setActive(index)}
          onClick={() => {
            item.onSelect();
            onDismiss();
          }}
          className={cn(
            'text-body-sm flex w-full items-center px-3 py-1.5 text-left transition-colors',
            'disabled:text-muted-foreground disabled:hover:bg-transparent disabled:cursor-default',
            index === active && !item.disabled
              ? 'bg-accent3/15 text-foreground'
              : 'text-foreground hover:bg-fill-hover',
          )}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
