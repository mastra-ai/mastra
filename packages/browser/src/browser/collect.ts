import getXPath from 'get-xpath';
import { isElementNode } from './element-node';
import { isInteractiveElement } from './interactive-element';
import { isLeafElement } from './leaf-element';
import { isTextNode } from './text-node';
import { isActive, isVisible } from './utils';

const xpathCache = new Map<HTMLElement, string[]>();
export function collect(rootEl: HTMLElement, indexOffset = 0) {
  const DOMCrawlQueue = [...rootEl.childNodes];

  let shouldAdd = false;
  const candidateElements: HTMLElement[] = [];

  while (DOMCrawlQueue.length > 0) {
    const node = DOMCrawlQueue.pop();

    if (node && isElementNode(node)) {
      for (let i = node.childNodes.length - 1; i >= 0; i--) {
        DOMCrawlQueue.push(node.childNodes[i]);
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

    if (shouldAdd) {
      candidateElements.push(node);
    }
  }

  const selectorMap = {};
  let outputString = '';
  const xpathLists = candidateElements.map(elem => {
    if (xpathCache.has(elem)) {
      return xpathCache.get(elem);
    }

    return getXPath(elem);
  });

  candidateElements.forEach((elem, idx) => {
    const xpaths = xpathLists[idx];
    let elemOutput = '';

    if (isTextNode(elem)) {
      const textContent = elem.textContent?.trim();
      if (textContent) {
        elemOutput += `${idx + indexOffset}:${textContent}\n`;
      }
    } else if (isElementNode(elem)) {
      const tagName = elem.tagName.toLowerCase();
      const attributes = collectEssentialAttributes(elem);
      const opening = `<${tagName}${attributes ? ' ' + attributes : ''}>`;
      const closing = `</${tagName}>`;
      const textContent = elem.textContent?.trim() || '';
      elemOutput += `${idx + indexOffset}:${opening}${textContent}${closing}\n`;
    }

    outputString += elemOutput;
    selectorMap[idx + indexOffset] = xpaths;
  });

  return { outputString, selectorMap };
}
