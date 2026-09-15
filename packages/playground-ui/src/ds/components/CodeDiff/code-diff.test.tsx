// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { CodeDiff } from './code-diff';

const codeA = JSON.stringify({ input: 'hello', removed: true }, null, 2);
const codeB = JSON.stringify({ input: 'world', added: true }, null, 2);

afterEach(() => cleanup());

describe('CodeDiff', () => {
  describe('given two documents', () => {
    it('renders a side-by-side merge view with line-number gutters', () => {
      const { container } = render(<CodeDiff codeA={codeA} codeB={codeB} />);

      expect(container.querySelector('.cm-mergeView')).not.toBeNull();
      expect(container.querySelectorAll('.cm-mergeViewEditor')).toHaveLength(2);
      expect(container.querySelectorAll('.cm-lineNumbers').length).toBeGreaterThan(0);
    });

    it('marks removed lines on the left and added lines on the right', () => {
      const { container } = render(<CodeDiff codeA={codeA} codeB={codeB} />);
      const [left, right] = Array.from(container.querySelectorAll('.cm-mergeViewEditor'));

      expect(left?.querySelector('.cm-editor.cm-merge-a')).not.toBeNull();
      expect(left?.querySelector('.cm-changedLine')).not.toBeNull();
      expect(right?.querySelector('.cm-editor.cm-merge-b')).not.toBeNull();
      expect(right?.querySelector('.cm-changedLine')).not.toBeNull();
    });
  });
});
