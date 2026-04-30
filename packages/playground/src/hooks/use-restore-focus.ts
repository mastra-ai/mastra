import { useRef, useEffect } from 'react';

export const useRestoreFocus = <T extends HTMLElement>(isOpened: boolean, el: React.RefObject<T | null>) => {
  const previousFocusRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (isOpened) {
      // Store the previously focused element
      previousFocusRef.current = document.activeElement as HTMLElement | null;
      // Focus the dialog
      el?.current?.focus();
    } else if (previousFocusRef.current) {
      // Restore focus when closing
      previousFocusRef.current.focus();
      previousFocusRef.current = null;
    }
  }, [isOpened]);
};
