const TABBABLE = 'a[href], button, input, select, textarea, summary, [tabindex]';

export function focusFirstIn(container: HTMLElement | null) {
  if (!container) return;
  for (const candidate of container.querySelectorAll(TABBABLE)) {
    if (!(candidate instanceof HTMLElement) || candidate.tabIndex < 0) continue;
    candidate.focus();
    if (document.activeElement === candidate) return;
  }
  container.focus();
}

export function inertOutside(root: Element) {
  const marked: Element[] = [];
  let node = root;
  while (node !== document.body && node.parentElement) {
    const parent = node.parentElement;
    for (const sibling of parent.children) {
      if (sibling === node || sibling.hasAttribute('inert')) continue;
      sibling.setAttribute('inert', '');
      marked.push(sibling);
    }
    node = parent;
  }
  return () => {
    for (const element of marked) element.removeAttribute('inert');
  };
}
