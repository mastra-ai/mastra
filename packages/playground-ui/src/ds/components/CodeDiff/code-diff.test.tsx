// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { CodeDiff } from './code-diff';

Object.defineProperty(CSSStyleSheet.prototype, 'replaceSync', { value: () => {} });
Object.defineProperty(globalThis, 'ResizeObserver', {
  value: class {
    observe() {}
    unobserve() {}
    disconnect() {}
  },
});

afterEach(() => cleanup());

describe('CodeDiff', () => {
  it('shows both versions of a Playground observation', async () => {
    const { container } = render(
      <CodeDiff codeA={'Remember Paris'} codeB={'Remember Lyon'} filename="observations.md" />,
    );

    await waitFor(() => {
      const content = container.querySelector('diffs-container')?.shadowRoot?.textContent;
      expect(content).toContain('Remember Paris');
      expect(content).toContain('Remember Lyon');
    });
  }, 15_000);

  it('shows a Factory Git patch', async () => {
    const patch = [
      'diff --git a/src/example.ts b/src/example.ts',
      'index 1234567..abcdef0 100644',
      '--- a/src/example.ts',
      '+++ b/src/example.ts',
      '@@ -1 +1 @@',
      '-const answer = 1;',
      '+const answer = 2;',
    ].join('\n');
    const { container } = render(<CodeDiff patch={patch} />);

    await waitFor(() => {
      const content = container.querySelector('diffs-container')?.shadowRoot?.textContent;
      expect(content).toContain('const answer = 1;');
      expect(content).toContain('const answer = 2;');
    });
  }, 15_000);

  it('keeps rename details visible when a patch has no text changes', () => {
    const patch = [
      'diff --git a/src/old.ts b/src/new.ts',
      'similarity index 100%',
      'rename from src/old.ts',
      'rename to src/new.ts',
    ].join('\n');
    const { getByText } = render(<CodeDiff patch={patch} />);

    expect(getByText('similarity index 100%')).not.toBeNull();
    expect(getByText('rename from src/old.ts')).not.toBeNull();
    expect(getByText('rename to src/new.ts')).not.toBeNull();
  });

  it('identifies a changed binary file without showing an empty diff', () => {
    const patch = [
      'diff --git a/logo.png b/logo.png',
      'index 1234567..abcdef0 100644',
      'Binary files a/logo.png and b/logo.png differ',
    ].join('\n');
    const { getByText } = render(<CodeDiff patch={patch} />);

    expect(getByText('Binary files a/logo.png and b/logo.png differ')).not.toBeNull();
  });

  it('folds a file down to its header and opens it again', async () => {
    const patch = [
      'diff --git a/src/example.ts b/src/example.ts',
      'index 1234567..abcdef0 100644',
      '--- a/src/example.ts',
      '+++ b/src/example.ts',
      '@@ -1 +1 @@',
      '-const answer = 1;',
      '+const answer = 2;',
    ].join('\n');
    const { container } = render(<CodeDiff patch={patch} header={{ path: 'src/example.ts' }} />);
    const toggle = screen.getByRole('button', { name: 'src/example.ts', expanded: true });
    await waitFor(() => {
      expect(container.querySelector('diffs-container')?.shadowRoot?.textContent).toContain('const answer = 2;');
    });

    fireEvent.click(toggle);

    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(container.querySelector('diffs-container')).toBeNull();

    fireEvent.click(toggle);

    await waitFor(() => {
      expect(container.querySelector('diffs-container')?.shadowRoot?.textContent).toContain('const answer = 2;');
    });
  }, 15_000);

  it('shows where a moved file came from when there is no diff to open', () => {
    const { container } = render(
      <CodeDiff header={{ path: 'src/agents/helper.ts', previousPath: 'src/helper.ts', meta: <span>Renamed</span> }} />,
    );

    expect(screen.queryByRole('button')).toBeNull();
    expect(container.textContent).toBe('src/agents/helper.ts from src/helper.tsRenamed');
  });
});
