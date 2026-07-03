export function buildFocusedTextInsertionScript(text: string) {
  return `
(() => {
  const text = ${JSON.stringify(text)};
  const element = document.activeElement;

  if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
    if (element.disabled || element.readOnly) return false;

    const start = element.selectionStart ?? element.value.length;
    const end = element.selectionEnd ?? element.value.length;
    const nextValue = element.value.slice(0, start) + text + element.value.slice(end);
    const prototype = element instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const descriptor = Object.getOwnPropertyDescriptor(prototype, 'value');

    descriptor?.set?.call(element, nextValue);
    element.dispatchEvent(new InputEvent('input', { bubbles: true, data: text, inputType: 'insertFromPaste' }));
    element.dispatchEvent(new Event('change', { bubbles: true }));

    const cursor = start + text.length;
    element.setSelectionRange?.(cursor, cursor);
    return true;
  }

  if (element instanceof HTMLElement && element.isContentEditable) {
    element.focus();
    return document.execCommand('insertText', false, text);
  }

  return false;
})()
`;
}
