import { useEffect, useRef } from 'react';

export const useAutoScroll = <T>(dep: T) => {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, [dep]);

  return ref;
};
