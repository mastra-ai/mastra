import { fireEvent, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
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
    function loadImage(image: HTMLElement, sizes: { offsetHeight: number; naturalHeight: number }) {
      Object.defineProperty(image, 'offsetHeight', { configurable: true, value: sizes.offsetHeight });
      Object.defineProperty(image, 'naturalHeight', { configurable: true, value: sizes.naturalHeight });
      fireEvent.load(image);
    }

    it('opens a capped screenshot to full size and back', async () => {
      renderWithProviders(<ToolCard tool={screenshotTool} />);
      await userEvent.click(screen.getByRole('button', { name: /screenshot/i }));
      const image = screen.getByRole('img', { name: "Screenshot of the agent's browser" });
      loadImage(image, { offsetHeight: 480, naturalHeight: 8000 });
      expect(image).toHaveClass('max-h-[480px]');

      await userEvent.click(screen.getByRole('button', { name: 'Show full size' }));
      expect(image).not.toHaveClass('max-h-[480px]');

      await userEvent.click(screen.getByRole('button', { name: 'Show smaller' }));
      expect(image).toHaveClass('max-h-[480px]');
    });

    it("doesn't offer full size for a screenshot that already fits", async () => {
      renderWithProviders(<ToolCard tool={screenshotTool} />);
      await userEvent.click(screen.getByRole('button', { name: /screenshot/i }));
      loadImage(screen.getByRole('img', { name: "Screenshot of the agent's browser" }), {
        offsetHeight: 300,
        naturalHeight: 300,
      });

      expect(screen.queryByRole('button', { name: 'Show full size' })).not.toBeInTheDocument();
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
