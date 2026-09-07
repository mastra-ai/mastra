// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { DataCodeSection } from './data-code-section';

const before = JSON.stringify({ city: 'Paris', unit: 'C' }, null, 2);
const after = JSON.stringify({ city: 'Lyon', unit: 'C' }, null, 2);

afterEach(() => cleanup());

describe('DataCodeSection diff highlight', () => {
  it('marks changed lines as removed on side a and added on side b', () => {
    const a = render(<DataCodeSection title="Input" codeStr={before} diff={{ against: after, side: 'a' }} />);
    expect(a.container.querySelectorAll('.cm-diff-removed')).toHaveLength(1);
    expect(a.container.querySelector('.cm-diff-added')).toBeNull();
    cleanup();

    const b = render(<DataCodeSection title="Input" codeStr={after} diff={{ against: before, side: 'b' }} />);
    expect(b.container.querySelectorAll('.cm-diff-added')).toHaveLength(1);
  });

  it('mounts the diff theme with a selector that beats the app `.cm-activeLine { background: transparent }` rule', () => {
    render(<DataCodeSection title="Input" codeStr={before} diff={{ against: after, side: 'a' }} />);
    const mountedCss = Array.from(document.head.querySelectorAll('style'))
      .map(s => s.textContent ?? '')
      .join('\n');
    expect(mountedCss).toContain('.cm-line.cm-diff-removed');
    expect(mountedCss).toContain('.cm-line.cm-diff-added');
  });

  it('renders no highlight without a diff', () => {
    const { container } = render(<DataCodeSection title="Input" codeStr={before} />);
    expect(container.querySelector('.cm-diff-removed, .cm-diff-added')).toBeNull();
  });
});
