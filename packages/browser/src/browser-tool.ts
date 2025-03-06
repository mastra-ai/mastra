import { collect } from './browser/collect';

// @ts-ignore
window.collectDomNodes = function collectDomNodes(rootEl: HTMLElement) {
  const elements = collect(rootEl);
  return elements;
};
