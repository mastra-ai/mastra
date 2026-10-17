import type { RefObject } from 'react';
import { useEffect } from 'react';

interface UseComposerAutofocusOptions {
  threadId?: string;
  disabled?: boolean;
}

export const useComposerAutofocus = (
  ref: RefObject<HTMLTextAreaElement | null>,
  { threadId, disabled = false }: UseComposerAutofocusOptions,
) => {
  useEffect(() => {
    if (disabled) return;
    const el = ref.current;
    if (!el) return;
    el.focus({ preventScroll: true });
    el.setSelectionRange(el.value.length, el.value.length);
  }, [ref, threadId, disabled]);
};
