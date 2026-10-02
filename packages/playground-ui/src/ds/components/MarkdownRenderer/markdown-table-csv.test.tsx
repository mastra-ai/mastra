// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MarkdownRenderer } from './markdown-renderer';

function blobText(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () =>
      typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('Expected text'));
    reader.onerror = reject;
    reader.readAsText(blob);
  });
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('Table export menu', () => {
  describe('when Download CSV is selected for one table', () => {
    it('downloads just that table as plain cell values', async () => {
      const blobs: Blob[] = [];
      const createObjectURL = vi.fn((blob: Blob) => {
        blobs.push(blob);
        return 'blob:table-test';
      });
      const revokeObjectURL = vi.fn();
      vi.stubGlobal(
        'URL',
        class extends URL {
          static createObjectURL = createObjectURL;
          static revokeObjectURL = revokeObjectURL;
        },
      );
      const downloads: { name: string; href: string; attached: boolean }[] = [];
      vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
        downloads.push({ name: this.download, href: this.href, attached: this.isConnected });
      });
      render(
        <MarkdownRenderer tableActions>
          {
            'Intro\n\n| Name | Value |\n| --- | --- |\n| **東京** | [Docs][d] and `code` |\n| ![Alt](https://example.com/image.png) | a\\|b |\n| short |\n| first | second | ignored |\n| Revenue[^note] | ![Reference image][image] |\n\nOther\n\n| Another |\n| --- |\n| not exported |\n\n[d]: https://example.com\n\n[^note]: Provisional estimate\n\n[image]: https://example.com/image.png'
          }
        </MarkdownRenderer>,
      );
      expect(screen.queryByRole('menuitem', { name: 'Download CSV' })).toBeNull();
      const [trigger] = screen.getAllByRole('button', { name: 'More table options' });
      if (!trigger) throw new Error('Missing table menu');
      fireEvent.click(trigger);
      fireEvent.click(await screen.findByRole('menuitem', { name: 'Download CSV' }));
      expect(createObjectURL).toHaveBeenCalledTimes(1);
      const [blob] = blobs;
      if (!blob) throw new Error('Missing download');
      expect(blob.type).toBe('text/csv;charset=utf-8');
      const downloaded = await blobText(blob);
      expect(blob.size).toBe(new TextEncoder().encode(downloaded).length + 3);
      expect(downloaded).toBe(
        '"Name","Value"\r\n"東京","Docs and code"\r\n"Alt","a|b"\r\n"short",""\r\n"first","second"\r\n"Revenue[^note]","Reference image"',
      );
      expect(downloads).toEqual([{ name: 'table.csv', href: 'blob:table-test', attached: true }]);
      expect(revokeObjectURL).toHaveBeenCalledWith('blob:table-test');
      expect(document.querySelector('a[download]')).toBeNull();
      await waitFor(() => expect(screen.queryByRole('menuitem', { name: 'Download CSV' })).toBeNull());
    });
  });

  describe('when a table is still streaming', () => {
    it('disables both actions until the original table is complete', () => {
      const text = '| Name |\n| --- |\n| unfinished';
      const { rerender } = render(
        <MarkdownRenderer tableActions streaming>
          {text}
        </MarkdownRenderer>,
      );
      expect(screen.getByRole<HTMLButtonElement>('button', { name: 'More table options' }).disabled).toBe(true);
      expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Copy table as markdown' }).disabled).toBe(true);
      rerender(<MarkdownRenderer tableActions>{text}</MarkdownRenderer>);
      expect(screen.getByRole<HTMLButtonElement>('button', { name: 'More table options' }).disabled).toBe(false);
    });
  });
});
