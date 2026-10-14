import { createContext, use, useCallback, useRef } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { UseFluidHoverReturn } from '@/hooks/use-fluid-hover';

export type PaginationContextValue = {
  registerItem: UseFluidHoverReturn['registerItem'];
  allocateIndex: () => number;
  releaseIndex: (index: number) => void;
  setCurrentIndex: Dispatch<SetStateAction<number | null>>;
};

export const PaginationContext = createContext<PaginationContextValue | undefined>(undefined);

const isCurrent = (element: HTMLElement) => element.getAttribute('aria-current') === 'page';

const clearCurrent = (index: number) => (current: number | null) => {
  if (current === index) return null;
  return current;
};

export function usePaginationItemRef() {
  const ctx = use(PaginationContext);
  const indexRef = useRef<number | undefined>(undefined);
  const unsubscribeRef = useRef<(() => void) | undefined>(undefined);

  return useCallback(
    (element: HTMLElement | null) => {
      unsubscribeRef.current?.();
      unsubscribeRef.current = undefined;
      if (!ctx) return;
      const { registerItem, allocateIndex, releaseIndex, setCurrentIndex } = ctx;

      if (!element) {
        const index = indexRef.current;
        if (index === undefined) return;
        registerItem(index, null);
        releaseIndex(index);
        setCurrentIndex(clearCurrent(index));
        indexRef.current = undefined;
        return;
      }

      indexRef.current ??= allocateIndex();
      const index = indexRef.current;
      registerItem(index, element);

      const sync = () => {
        if (isCurrent(element)) {
          setCurrentIndex(index);
          return;
        }
        setCurrentIndex(clearCurrent(index));
      };
      sync();
      const observer = typeof MutationObserver === 'undefined' ? undefined : new MutationObserver(sync);
      observer?.observe(element, { attributes: true, attributeFilter: ['aria-current'] });
      unsubscribeRef.current = () => observer?.disconnect();
    },
    [ctx],
  );
}
