const interactiveElementTypes = [
  'A',
  'BUTTON',
  'DETAILS',
  'EMBED',
  'INPUT',
  'LABEL',
  'MENU',
  'MENUITEM',
  'OBJECT',
  'SELECT',
  'TEXTAREA',
  'SUMMARY',
] as const;

const interactiveRoles = [
  'button',
  'menu',
  'menuitem',
  'link',
  'checkbox',
  'radio',
  'slider',
  'tab',
  'tabpanel',
  'textbox',
  'combobox',
  'grid',
  'listbox',
  'option',
  'progressbar',
  'scrollbar',
  'searchbox',
  'switch',
  'tree',
  'treeitem',
  'spinbutton',
  'tooltip',
] as const;

const interactiveAriaRoles = ['menu', 'menuitem', 'button'] as const;

export function isInteractiveElement(element: Element): boolean {
  const elementType = element.tagName;
  const elementRole = element.getAttribute('role');
  const elementAriaRole = element.getAttribute('aria-role');

  return !!(
    (elementType && (interactiveElementTypes as unknown as string[]).includes(elementType)) ||
    (elementRole && (interactiveRoles as unknown as string[]).includes(elementRole)) ||
    (elementAriaRole && (interactiveAriaRoles as unknown as string[]).includes(elementAriaRole))
  );
}
