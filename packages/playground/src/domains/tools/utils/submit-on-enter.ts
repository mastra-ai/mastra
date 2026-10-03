import type { KeyboardEvent } from 'react';

/**
 * Enter submits the surrounding form, like any form. String fields render as auto-growing
 * textareas, which would otherwise take Enter as a newline; Shift+Enter still adds one.
 * Selects and buttons keep their own Enter behavior.
 */
export function submitOnEnter(event: KeyboardEvent<HTMLElement>) {
  if (event.key !== 'Enter' || event.shiftKey || event.nativeEvent.isComposing) return;
  const target = event.target;
  if (!(target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement)) return;
  event.preventDefault();
  target.form?.requestSubmit();
}
