import type { Ref } from 'react';

export const mergeRefs =
  <TElement>(...refs: Array<Ref<TElement> | undefined>) =>
  (element: TElement | null) => {
    const cleanups = refs.map(ref => {
      if (typeof ref === 'function') return ref(element);
      if (ref) ref.current = element;
      return undefined;
    });

    return () => {
      refs.forEach((ref, index) => {
        const cleanup = cleanups[index];
        if (typeof cleanup === 'function') cleanup();
        else if (typeof ref === 'function') ref(null);
        else if (ref) ref.current = null;
      });
    };
  };
