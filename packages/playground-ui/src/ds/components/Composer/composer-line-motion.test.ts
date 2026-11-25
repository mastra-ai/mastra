// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';

import { glideComposerStatus } from './composer-line-motion';

afterEach(() => {
  vi.useRealTimers();
  document.body.replaceChildren();
});

// jsdom has no Web Animations; like a browser, this one fires `cancel` a task after `cancel()`.
class TaskAnimation extends EventTarget {
  cancel() {
    setTimeout(() => this.dispatchEvent(new Event('cancel')));
  }
}

function footer() {
  const status = document.createElement('div');
  status.style.opacity = '1';
  status.getBoundingClientRect = () => DOMRect.fromRect({ height: status.style.opacity === '0' ? 0 : 28 });
  Object.defineProperty(status, 'animate', { value: () => new TaskAnimation() });
  document.body.append(status);
  return status;
}

describe('Composer status glide', () => {
  it('keeps the row clipped when a glide is interrupted, until the newer glide ends', () => {
    vi.useFakeTimers();
    const status = footer();

    const closing = glideComposerStatus(status, () => (status.style.opacity = '0'), []);
    glideComposerStatus(status, () => (status.style.opacity = '1'), closing);
    vi.runAllTimers();

    expect(status.style.overflow).toBe('hidden');
  });
});
