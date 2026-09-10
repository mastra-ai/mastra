// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MarkdownRenderer } from './markdown-renderer';
import { Toaster, toast } from '@/lib/toast';

const table = '| Name | Value |\n| :--- | ---: |\n| **東京** | a\\|b `code` |';

afterEach(() => {
  toast.dismiss();
  cleanup();
  vi.restoreAllMocks();
});

function clipboard() {
  const writeText = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
  return writeText;
}

describe('Markdown table copy', () => {
  describe('when table actions are not enabled', () => {
    it('renders a plain table without export controls or internal export attributes', () => {
      render(<MarkdownRenderer>{table}</MarkdownRenderer>);
      const rendered = screen.getByRole('table');
      expect(rendered.textContent).toContain('東京');
      expect(screen.queryByRole('button')).toBeNull();
      expect(rendered.hasAttribute('tableMarkdown')).toBe(false);
      expect(rendered.hasAttribute('tableCsv')).toBe(false);
    });
  });

  describe('when a message contains multiple tables', () => {
    it('copies only the chosen table, preserving markdown syntax', async () => {
      const writeText = clipboard();
      const other = '| Other |\n| --- |\n| data |';
      render(<MarkdownRenderer tableActions>{`Intro\n\n${table}\n\nBetween\n\n${other}\n\nOutro`}</MarkdownRenderer>);
      const buttons = screen.getAllByRole('button', { name: 'Copy table as markdown' });
      expect(buttons).toHaveLength(2);
      buttons.forEach(button => fireEvent.click(button));
      await waitFor(() => expect(writeText.mock.calls).toEqual([[table], [other]]));
      expect(screen.getAllByText('Copied!')).toHaveLength(2);
    });
  });

  describe('when copying succeeds', () => {
    it('confirms that table markdown was copied', async () => {
      clipboard();
      render(
        <>
          <Toaster />
          <MarkdownRenderer tableActions>{table}</MarkdownRenderer>
        </>,
      );
      fireEvent.click(screen.getByText('Copy table as markdown'));
      expect(await screen.findByText('Copied table markdown')).toBeTruthy();
    });
  });

  describe('when a table is nested', () => {
    it.each([
      table
        .split('\n')
        .map(line => `> ${line}`)
        .join('\n'),
      table
        .split('\n')
        .map(line => `>>${line}`)
        .join('\n'),
      table
        .split('\n')
        .map(line => ` >\t${line}`)
        .join('\n'),
      `- Item\n\n${table
        .split('\n')
        .map(line => `  ${line}`)
        .join('\n')}`,
      table.replaceAll('\n', '\r\n'),
      table.replaceAll('\n', '\r'),
      table.replace('\n', '\r'),
    ])('copies a standalone table without container prefixes', async source => {
      const writeText = clipboard();
      render(<MarkdownRenderer tableActions>{source}</MarkdownRenderer>);
      fireEvent.click(screen.getByRole('button', { name: 'Copy table as markdown' }));
      await waitFor(() => expect(writeText).toHaveBeenCalledWith(table));
    });
  });

  describe('when a table uses reference links', () => {
    it('includes only the definitions needed by the chosen table', async () => {
      const writeText = clipboard();
      const linked = '| Link |\n| --- |\n| [Docs][d] and ![Image][image] and [Docs][d] |';
      render(
        <MarkdownRenderer
          tableActions
        >{`${linked}\n\n[d]: https://example.com "Docs"\n\n[unused]: https://other.test\n\n[image]: https://example.com/image.png\n\n[d]: https://duplicate.test`}</MarkdownRenderer>,
      );
      fireEvent.click(screen.getByRole('button', { name: 'Copy table as markdown' }));
      await waitFor(() =>
        expect(writeText).toHaveBeenCalledWith(
          `${linked}\n\n[d]: https://example.com "Docs"\n\n[image]: https://example.com/image.png`,
        ),
      );
    });
  });

  describe('when definitions are nested or include footnotes', () => {
    it.each([
      [
        '> | Link |\n> | --- |\n> | [Docs][d] |\n>\n> [d]:\n>   https://example.com\n>   "Documentation"',
        '| Link |\n| --- |\n| [Docs][d] |\n\n[d]: https://example.com "Documentation"',
      ],
      [
        '| Value |\n| --- |\n| Revenue[^a] |\n\n[^a]: See [Docs][d].\n\n[d]: https://example.com\n\n[unused]: https://other.test',
        '| Value |\n| --- |\n| Revenue[^a] |\n\n[^a]: See [Docs][d].\n\n[d]: https://example.com',
      ],
    ])('copies standalone definitions that still resolve after pasting', async (source, expected) => {
      const writeText = clipboard();
      const { rerender } = render(<MarkdownRenderer tableActions>{source}</MarkdownRenderer>);
      fireEvent.click(screen.getByRole('button', { name: 'Copy table as markdown' }));
      await waitFor(() => expect(writeText).toHaveBeenCalledWith(expected));
      rerender(<MarkdownRenderer tableActions>{expected}</MarkdownRenderer>);
      expect(screen.getByRole<HTMLAnchorElement>('link', { name: 'Docs' }).href).toBe('https://example.com/');
      expect(screen.getAllByRole('table')).toHaveLength(1);
    });
  });

  describe('when a response is streaming', () => {
    it('waits for completion before copying the actual source', async () => {
      const writeText = clipboard();
      const partial = '| A |\n| --- |\n| **unfinished';
      const { rerender } = render(
        <MarkdownRenderer tableActions streaming>
          {partial}
        </MarkdownRenderer>,
      );
      const button = screen.getByRole<HTMLButtonElement>('button', { name: 'Copy table as markdown' });
      expect(button.disabled).toBe(true);
      fireEvent.click(button);
      expect(writeText).not.toHaveBeenCalled();
      rerender(<MarkdownRenderer tableActions>{partial}</MarkdownRenderer>);
      expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Copy table as markdown' }).disabled).toBe(false);
      fireEvent.click(screen.getByRole('button', { name: 'Copy table as markdown' }));
      await waitFor(() => expect(writeText).toHaveBeenCalledWith(partial));
    });
  });

  describe('when clipboard access fails', () => {
    it('does not report a successful copy', async () => {
      const writeText = clipboard().mockRejectedValue(new Error('denied'));
      render(<MarkdownRenderer tableActions>{table}</MarkdownRenderer>);
      fireEvent.click(screen.getByRole('button', { name: 'Copy table as markdown' }));
      await waitFor(() => expect(writeText).toHaveBeenCalled());
      expect(screen.queryByText('Copied!')).toBeNull();
    });
  });
});
