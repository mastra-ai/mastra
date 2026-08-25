import { useRef } from 'react';
import type { RefObject } from 'react';
import { useTableKeydown } from '@/lib/keyboard';
import type { UseTableKeydownArgs } from '@/lib/keyboard';

export type UseDataListKeyboardArgs<T extends HTMLElement = HTMLDivElement> = Omit<
  UseTableKeydownArgs,
  'containerRef'
> & {
  /** Reuse an existing container/scroll ref instead of the internally created one. */
  containerRef?: RefObject<T | null>;
};

/**
 * Thin DataList-flavored wrapper around `useTableKeydown` that owns the
 * container ref, so callsites only need to attach `containerRef` to the element
 * wrapping the `<DataList>` (or pass an existing scroll ref) and spread
 * `getRowProps(index)` on each interactive row (RowButton / RowLink).
 */
export const useDataListKeyboard = <T extends HTMLElement = HTMLDivElement>({
  containerRef: externalRef,
  ...args
}: UseDataListKeyboardArgs<T>) => {
  const internalRef = useRef<T | null>(null);
  const containerRef = externalRef ?? internalRef;
  // useTableKeydown only reads from the ref, so widening to HTMLElement is safe.
  const table = useTableKeydown({ ...args, containerRef: containerRef as RefObject<HTMLElement | null> });

  return { containerRef, ...table };
};
