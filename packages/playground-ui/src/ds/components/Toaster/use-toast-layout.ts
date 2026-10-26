import { useEffect, useRef } from 'react';
import { measureScrollableToastContent } from './scrollable-toast-content';
import { createToastStackLayout } from './toast-stack-layout';

export function useToastLayout() {
  const rootRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
    const stackLayout = createToastStackLayout(reduceMotion);
    reduceMotion.addEventListener('change', stackLayout.cancelAnimations);
    const measure = () => {
      const writeScrollableContent = measureScrollableToastContent(root);
      const writeStackLayout = stackLayout.measure(root);
      writeScrollableContent();
      writeStackLayout();
    };
    const resize = new ResizeObserver(measure);
    const sync = () => {
      resize.disconnect();
      for (const child of root.querySelectorAll('[data-sonner-toast] > *')) resize.observe(child);
      measure();
    };
    const mutations = new MutationObserver(sync);
    mutations.observe(root, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ['data-removed'],
    });
    sync();
    return () => {
      mutations.disconnect();
      resize.disconnect();
      reduceMotion.removeEventListener('change', stackLayout.cancelAnimations);
      stackLayout.cancelAnimations();
    };
  }, []);

  return rootRef;
}
