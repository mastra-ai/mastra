import { fireEvent, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '../../../../../../e2e/ui/render';
import { ToolCard } from '../tool/ToolCard';
import { commandTool, editTool, longResultTool } from './fixtures/tool-bodies';

describe('Factory tool body', () => {
  describe('when a command streams shell output', () => {
    it('keeps shell output visible and excludes the partial structured result', async () => {
      renderWithProviders(<ToolCard tool={commandTool} />);
      await userEvent.click(screen.getByRole('button', { name: /Run/ }));

      expect(screen.getByText('Live shell output')).toBeVisible();
      expect(screen.queryByText('Partial structured output')).not.toBeInTheDocument();
      expect(screen.getByRole('group', { name: 'Tool: execute_command' })).toHaveAttribute('aria-busy', 'true');
    });
  });

  describe('when an edit succeeds', () => {
    it('shows the change without the redundant success result', async () => {
      renderWithProviders(<ToolCard tool={editTool} />);
      await userEvent.click(screen.getByRole('button', { name: /Edit/ }));

      expect(screen.getByRole('group', { name: 'File change' })).toBeVisible();
      expect(screen.queryByText('File updated')).not.toBeInTheDocument();
    });
  });

  describe('when an edit fails', () => {
    it('shows the error beside the proposed change', async () => {
      renderWithProviders(<ToolCard tool={{ ...editTool, status: 'error', result: 'Permission denied' }} />);
      await userEvent.click(screen.getByRole('button', { name: /Edit/ }));

      expect(screen.getByRole('group', { name: 'File change' })).toBeVisible();
      expect(screen.getByText('Permission denied')).toBeVisible();
    });
  });

  describe('when a tool takes no arguments and returns nothing', () => {
    it.each([null, ''])('offers nothing to open when the result is %j', result => {
      renderWithProviders(
        <ToolCard
          tool={{
            toolCallId: 'list',
            toolName: 'list_agents',
            args: {},
            argsText: '',
            status: 'done',
            output: '',
            result,
          }}
        />,
      );

      expect(screen.getByRole('group', { name: 'Tool: list_agents' })).toBeVisible();
      expect(screen.queryByRole('button')).not.toBeInTheDocument();
    });
  });

  describe('when the agent takes a browser screenshot', () => {
    // A complete 1x1 PNG, so the fixture is an image a browser can actually decode.
    const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR4nGNgAAIAAAUAAXpeqz8AAAAASUVORK5CYII=';
    const screenshotTool = {
      toolCallId: 'shot',
      toolName: 'browser_screenshot',
      args: {},
      argsText: '{}',
      status: 'done' as const,
      output: '',
      result: { base64: PNG, url: 'https://3000-sbx.e2b.app', title: 'Vite App' },
    };

    it('shows the screenshot instead of its base64', async () => {
      renderWithProviders(<ToolCard tool={screenshotTool} />);
      await userEvent.click(screen.getByRole('button', { name: /screenshot/i }));

      expect(screen.getByRole('img', { name: "Screenshot of the agent's browser" })).toHaveAttribute(
        'src',
        `data:image/png;base64,${PNG}`,
      );
      expect(screen.queryByText(/iVBORw0KGgo/)).not.toBeInTheDocument();
    });

    // jsdom has no layout, so give the loaded image the sizes a browser would.
    afterEach(() => {
      vi.unstubAllGlobals();
    });

    type Sizes = { offsetWidth: number; offsetHeight: number; naturalWidth: number; naturalHeight: number };

    function setSizes(image: HTMLElement, sizes: Partial<Sizes>) {
      for (const [name, value] of Object.entries(sizes)) {
        Object.defineProperty(image, name, { configurable: true, value });
      }
    }

    function loadImage(image: HTMLElement, sizes: Sizes) {
      setSizes(image, sizes);
      fireEvent.load(image);
    }

    it('opens a tall screenshot to full size and back', async () => {
      renderWithProviders(<ToolCard tool={screenshotTool} />);
      await userEvent.click(screen.getByRole('button', { name: /screenshot/i }));
      const image = screen.getByRole('img', { name: "Screenshot of the agent's browser" });
      loadImage(image, { offsetWidth: 27, offsetHeight: 480, naturalWidth: 450, naturalHeight: 8000 });
      expect(image).toHaveClass('max-h-[480px]');

      await userEvent.click(screen.getByRole('button', { name: 'Show full size' }));
      expect(image).not.toHaveClass('max-h-[480px]');
      expect(image).not.toHaveClass('max-w-full');

      await userEvent.click(screen.getByRole('button', { name: 'Show smaller' }));
      expect(image).toHaveClass('max-h-[480px]');
    });

    it('opens a wide screenshot that was shrunk to the transcript width', async () => {
      renderWithProviders(<ToolCard tool={screenshotTool} />);
      await userEvent.click(screen.getByRole('button', { name: /screenshot/i }));
      const image = screen.getByRole('img', { name: "Screenshot of the agent's browser" });
      loadImage(image, { offsetWidth: 600, offsetHeight: 169, naturalWidth: 2560, naturalHeight: 720 });

      await userEvent.click(screen.getByRole('button', { name: 'Show full size' }));

      expect(image).not.toHaveClass('max-w-full');
    });

    it("doesn't offer full size for a screenshot shown at its own size", async () => {
      renderWithProviders(<ToolCard tool={screenshotTool} />);
      await userEvent.click(screen.getByRole('button', { name: /screenshot/i }));
      loadImage(screen.getByRole('img', { name: "Screenshot of the agent's browser" }), {
        offsetWidth: 400,
        offsetHeight: 300,
        naturalWidth: 400,
        naturalHeight: 300,
      });

      expect(screen.queryByRole('button', { name: 'Show full size' })).not.toBeInTheDocument();
    });

    it('offers full size once a narrower transcript shrinks the screenshot', async () => {
      const observers: { callback: ResizeObserverCallback; targets: Element[] }[] = [];
      vi.stubGlobal(
        'ResizeObserver',
        class {
          targets: Element[] = [];
          constructor(callback: ResizeObserverCallback) {
            observers.push({ callback, targets: this.targets });
          }
          observe(target: Element) {
            this.targets.push(target);
          }
          disconnect() {}
        },
      );
      renderWithProviders(<ToolCard tool={screenshotTool} />);
      await userEvent.click(screen.getByRole('button', { name: /screenshot/i }));
      const image = screen.getByRole('img', { name: "Screenshot of the agent's browser" });
      loadImage(image, { offsetWidth: 800, offsetHeight: 300, naturalWidth: 800, naturalHeight: 300 });
      expect(screen.queryByRole('button', { name: 'Show full size' })).not.toBeInTheDocument();
      const observer = observers.at(-1)!;
      expect(observer.targets).toContain(image);

      setSizes(image, { offsetWidth: 600, offsetHeight: 225 });
      act(() => observer.callback([], {} as ResizeObserver));

      expect(screen.getByRole('button', { name: 'Show full size' })).toBeVisible();
    });

    it('shows the failure message when no image came back', async () => {
      renderWithProviders(<ToolCard tool={{ ...screenshotTool, result: { message: 'Browser is not open' } }} />);
      await userEvent.click(screen.getByRole('button', { name: /screenshot/i }));

      expect(screen.queryByRole('img')).not.toBeInTheDocument();
      expect(screen.getByText(/Browser is not open/)).toBeVisible();
    });
  });

  describe('when a result exceeds the preview limit', () => {
    it('copies the whole result', async () => {
      const user = userEvent.setup();
      renderWithProviders(<ToolCard tool={longResultTool} />);
      await user.click(screen.getByRole('button', { name: /Read/ }));
      await user.click(screen.getByRole('button', { name: 'Copy to clipboard' }));

      expect(await navigator.clipboard.readText()).toBe(longResultTool.result);
    });
  });
});
