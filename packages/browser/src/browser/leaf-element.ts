import { isTextNode } from './text-node';

const leafElementDenyList = ['SVG', 'IFRAME', 'SCRIPT', 'STYLE', 'LINK'];

export function isLeafElement(element: Element) {
  if (element.textContent === '') {
    return false;
  }

  if (element.childNodes.length === 0) {
    return !leafElementDenyList.includes(element.tagName);
  }

  // This case ensures that extra context will be included for simple element nodes that contain only text
  return element.childNodes.length === 1 && isTextNode(element.childNodes[0]!);
}
