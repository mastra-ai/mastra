// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';

import { glideContent } from './message-scroller-glide';

afterEach(() => {
  document.body.innerHTML = '';
});

function glidingElement(): HTMLElement {
  const element = document.createElement('div');
  document.body.appendChild(element);
  glideContent(element, 40);
  return element;
}

describe('glideContent', () => {
  it('ignores a descendant transition ending mid-travel', () => {
    const element = glidingElement();
    const child = element.appendChild(document.createElement('span'));

    child.dispatchEvent(new Event('transitionend', { bubbles: true }));
    expect(element.style.transform).toBe('translateY(0)');

    element.dispatchEvent(new Event('transitionend'));
    expect(element.style.transform).toBe('');
    expect(element.style.transition).toBe('');
  });

  it('releases a travel that is cancelled instead of ending', () => {
    const element = glidingElement();

    element.dispatchEvent(new Event('transitioncancel'));
    expect(element.style.transform).toBe('');
    expect(element.style.transition).toBe('');
  });
});
