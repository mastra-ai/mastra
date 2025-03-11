import getXPath from 'get-xpath';
import type { CollectedElement } from '../types';
import { isElementNode } from './element-node';
import { isInteractiveElement } from './interactive-element';
import { isLeafElement } from './leaf-element';
import { isTextNode } from './text-node';
import { isActive, isVisible } from './utils';

/**
 * Collects essential attributes from an element.
 * @param element The DOM element.
 * @returns A string of formatted attributes.
 */
function collectEssentialAttributes(element: Element): string {
  const essentialAttributes = [
    'id',
    'class',
    'href',
    'src',
    'aria-label',
    'aria-name',
    'aria-role',
    'aria-description',
    'aria-expanded',
    'aria-haspopup',
    'type',
    'value',
  ];

  const attrs: string[] = essentialAttributes
    .map(attr => {
      const value = element.getAttribute(attr);
      return value ? `${attr}="${value}"` : '';
    })
    .filter(attr => attr !== '');

  Array.from(element.attributes).forEach(attr => {
    if (attr.name.startsWith('data-')) {
      attrs.push(`${attr.name}="${attr.value}"`);
    }
  });

  return attrs.join(' ');
}

export function collect(rootEl: Element): CollectedElement[] {
  const DOMCrawlQueue = [...rootEl.childNodes];

  let shouldAdd = false;
  const candidateElements: Element[] = [];

  while (DOMCrawlQueue.length > 0) {
    const node = DOMCrawlQueue.pop();

    if (node && isElementNode(node)) {
      for (let i = node.childNodes.length - 1; i >= 0; i--) {
        DOMCrawlQueue.push(node.childNodes[i]!);
      }

      if (isInteractiveElement(node)) {
        if (isActive(node) && isVisible(node)) {
          shouldAdd = true;
        }
      }
      if (isLeafElement(node)) {
        if (isActive(node) && isVisible(node)) {
          shouldAdd = true;
        }
      }
    }

    if (shouldAdd && node) {
      candidateElements.push(node as Element);
    }
  }

  const elements: { xpaths: string; output: string }[] = [];

  candidateElements.forEach(elem => {
    let elemOutput = '';

    if (isTextNode(elem)) {
      const textContent = elem.textContent?.trim();
      if (textContent) {
        elemOutput += `${textContent}\n`;
      }
    } else if (isElementNode(elem)) {
      const tagName = elem.tagName.toLowerCase();
      const attributes = collectEssentialAttributes(elem);
      const opening = `<${tagName}${attributes ? ' ' + attributes : ''}>`;
      const closing = `</${tagName}>`;
      const textContent = elem.textContent?.trim() || '';
      elemOutput += `${opening}${textContent}${closing}\n`;
    }

    elements.push({
      xpaths: getXPath(elem)!,
      output: elemOutput,
    });
  });

  return elements;
}
