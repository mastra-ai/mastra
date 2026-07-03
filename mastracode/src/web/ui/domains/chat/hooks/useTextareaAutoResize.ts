import { useEffect } from 'react';
import type { RefObject } from 'react';

export function useTextareaAutoResize(ref: RefObject<HTMLTextAreaElement | null>, value: string, maxHeight = 200) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, maxHeight)}px`;
  }, [maxHeight, ref, value]);
}
