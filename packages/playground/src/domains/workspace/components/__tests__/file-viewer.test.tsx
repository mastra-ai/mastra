// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { FileViewer } from '../file-browser';

afterEach(() => cleanup());

const markdown = '# Hello Heading\n\nSome body copy.';

describe('FileViewer markdown rendering', () => {
  it('renders markdown formatted by default with the Rendered toggle active', async () => {
    render(<FileViewer path="docs/README.md" content={markdown} isLoading={false} mimeType="text/markdown" />);

    // The markdown is rendered (heading becomes real text), not shown as raw source.
    expect(await screen.findByText('Hello Heading')).not.toBeNull();

    const renderedToggle = screen.getByRole('button', { name: /rendered/i });
    expect(renderedToggle.getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: /source/i }).getAttribute('aria-pressed')).toBe('false');
  });

  it('switches to raw source when the Source toggle is clicked', async () => {
    render(<FileViewer path="docs/README.md" content={markdown} isLoading={false} mimeType="text/markdown" />);

    fireEvent.click(screen.getByRole('button', { name: /source/i }));

    expect(screen.getByRole('button', { name: /source/i }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: /rendered/i }).getAttribute('aria-pressed')).toBe('false');
  });

  it('does not show a markdown toggle for non-markdown files', () => {
    render(<FileViewer path="src/index.ts" content={'const x = 1;'} isLoading={false} />);

    expect(screen.queryByRole('button', { name: /rendered/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /source/i })).toBeNull();
  });

  it('strips YAML frontmatter from the rendered markdown', async () => {
    const withFrontmatter = '---\nname: find-skills\ndescription: A test skill\n---\n\n# Find Skills\n\nBody text.';
    render(<FileViewer path="docs/SKILL.md" content={withFrontmatter} isLoading={false} mimeType="text/markdown" />);

    // The document body renders…
    expect(await screen.findByText('Find Skills')).not.toBeNull();
    // …but the raw frontmatter keys are not dumped into the rendered output.
    expect(screen.queryByText(/description: A test skill/)).toBeNull();
    expect(screen.queryByText(/name: find-skills/)).toBeNull();
  });
});
