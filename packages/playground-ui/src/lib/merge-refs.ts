import type { Ref } from 'react';

export const mergeRefs =
  <TElement>(...refs: Array<Ref<TElement> | undefined>) =>
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
