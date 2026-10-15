import { useRef, useState } from 'react';

/**
 * Open state of the Advanced section. Its toggle sits in the footer while closed and heads the section
 * once open, so toggling remounts it in the other place; the new toggle takes over keyboard focus.
 */
export function useAdvancedToggle(initialOpen: boolean) {
  const [open, setOpen] = useState(initialOpen);
  const focusNextToggle = useRef(false);

  const onOpenChange = (nextOpen: boolean) => {
    focusNextToggle.current = true;
    setOpen(nextOpen);
  };

  const toggleRef = (toggle: HTMLButtonElement | null) => {
    if (!toggle || !focusNextToggle.current) return;
    focusNextToggle.current = false;
    toggle.focus();
  };

  return { open, onOpenChange, toggleRef };
}
