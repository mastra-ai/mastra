// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ToolCallEdit } from './tool-call-edit';
import { highlight } from '@/ds/components/CodeEditor/highlight';

vi.mock('@/ds/components/CodeEditor/highlight', async importOriginal => ({
  ...(await importOriginal<typeof import('@/ds/components/CodeEditor/highlight')>()),
  highlight: vi.fn(async () => null),
}));

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

  it('colors the lines once highlighting lands for the file type', async () => {
    vi.mocked(highlight).mockImplementation(async code =>
      code.split('\n').map(line => [{ content: line, color: '#f00', offset: 0 }]),
    );
    const { container } = render(<ToolCallEdit edit={{ path: 'a.ts', oldText: 'a', newText: 'b\nc' }} />);

    await waitFor(() => expect(container.querySelectorAll('.shiki-token')).toHaveLength(3));
    expect(highlight).toHaveBeenCalledWith('b\nc', 'typescript');
  });

  it('shows a written file as its content', () => {
    render(<ToolCallEdit edit={{ path: 'notes.md', content: '# hello' }} />);

    expect(screen.getByText('# hello')).toBeTruthy();
    expect(screen.queryByRole('group', { name: 'File change' })).toBeNull();
  });
});
