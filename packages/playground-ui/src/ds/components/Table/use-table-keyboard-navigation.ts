import { useState, useCallback } from 'react';

export interface UseTableKeyboardNavigationOptions {
  /** Number of items in the list */
  itemCount: number;
  /** Initial active index (-1 = none) */
  initialIndex?: number;
  /** Wrap around at boundaries */
  wrap?: boolean;
  /** Callback when Enter pressed on active row */
  onSelect?: (index: number) => void;
}

export interface UseTableKeyboardNavigationReturn {
  /** Currently active index (-1 if none) */
  activeIndex: number;
  /** Set active index programmatically */
  setActiveIndex: React.Dispatch<React.SetStateAction<number>>;
  /** Returns props to spread on the Tbody element */
  getKeyboardProps: () => { onKeyDown: (e: React.KeyboardEvent) => void; tabIndex: number };
}

export function useTableKeyboardNavigation({
  itemCount,
  initialIndex = -1,
  wrap = false,
  onSelect,
}: UseTableKeyboardNavigationOptions): UseTableKeyboardNavigationReturn {
  const [activeIndex, setActiveIndex] = useState(initialIndex);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      // No-op for empty list
      if (itemCount === 0) return;

      switch (e.key) {
        case 'ArrowDown': {
          e.preventDefault();
          setActiveIndex(prev => {
            if (prev === -1) return 0;
            if (prev >= itemCount - 1) {
              return wrap ? 0 : itemCount - 1;
            }
            return prev + 1;
          });
          break;
        }
        case 'ArrowUp': {
          e.preventDefault();
          setActiveIndex(prev => {
            if (prev === -1) return itemCount - 1;
            if (prev <= 0) {
              return wrap ? itemCount - 1 : 0;
            }
            return prev - 1;
          });
          break;
        }
        case 'Home': {
          e.preventDefault();
          setActiveIndex(0);
          break;
        }
        case 'End': {
          e.preventDefault();
          setActiveIndex(itemCount - 1);
          break;
        }
        case 'Enter': {
          if (activeIndex >= 0 && onSelect) {
            e.preventDefault();
            onSelect(activeIndex);
          }
          break;
        }
      }
    },
    [itemCount, wrap, activeIndex, onSelect],
  );

  const getKeyboardProps = useCallback(() => {
    return { onKeyDown: handleKeyDown, tabIndex: 0 };
  }, [handleKeyDown]);

  return {
    activeIndex,
    setActiveIndex,
    getKeyboardProps,
  };
}
