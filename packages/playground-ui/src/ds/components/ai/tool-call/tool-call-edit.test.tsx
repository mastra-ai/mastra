// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { ToolCallEdit } from './tool-call-edit';

afterEach(cleanup);

describe('ToolCallEdit', () => {
  it('shows a replacement as its removed lines then its added lines, bounded', () => {
    const newText = Array.from({ length: 201 }, (_, index) => `line ${index}`).join('\n');
    const { container } = render(<ToolCallEdit edit={{ path: 'a.ts', oldText: 'old', newText }} />);

    const rows = container.querySelectorAll('[role="group"] > div');
    expect(rows[0]?.textContent).toBe('-old');
    expect(rows[1]?.textContent).toBe('+line 0');
    expect(screen.getByText('… 1 more lines')).toBeTruthy();
  });

  it('colors both sides for the file type once highlighting lands', async () => {
    const { container } = render(
      <ToolCallEdit edit={{ path: 'a.ts', oldText: 'const a = 1', newText: 'const a = 2\nconst b = 3' }} />,
    );

    const rows = () => container.querySelectorAll('[role="group"] > div');
    await waitFor(
      () => {
        expect(rows()[0]?.querySelectorAll('.shiki-token').length).toBeGreaterThan(1);
        expect(rows()[2]?.querySelectorAll('.shiki-token').length).toBeGreaterThan(1);
      },
      { timeout: 5000 },
    );
    expect(rows()[0]?.textContent).toBe('-const a = 1');
    expect(rows()[2]?.textContent).toBe('+const b = 3');
  });

  it('shows a written file as its content', () => {
    render(<ToolCallEdit edit={{ path: 'notes.md', content: '# hello' }} />);

    expect(screen.getByText('# hello')).toBeTruthy();
    expect(screen.queryByRole('group', { name: 'File change' })).toBeNull();
  });
});
