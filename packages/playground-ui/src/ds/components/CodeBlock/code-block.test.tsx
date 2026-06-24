// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { TooltipProvider } from '../Tooltip';
import { CodeBlock } from './code-block';

vi.mock('../CodeEditor/highlight', () => ({
  highlight: vi.fn(async () => [
    [
      {
        content: 'const',
        htmlStyle: {
          '--shiki-light': '#24292f',
          '--shiki-dark': '#c9d1d9',
        },
      },
    ],
  ]),
}));

vi.mock('@/lib/toast', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

afterEach(() => {
  cleanup();
});

describe('CodeBlock', () => {
  it('renders plain code text', () => {
    render(
      <TooltipProvider>
        <CodeBlock code="pnpm dlx mastra init" />
      </TooltipProvider>,
    );

    expect(screen.getByText('pnpm dlx mastra init')).toBeDefined();
  });

  it('renders highlighted tokens with theme CSS variables', async () => {
    render(
      <TooltipProvider>
        <CodeBlock code="const ok = true;" lang="typescript" />
      </TooltipProvider>,
    );

    const token = await screen.findByText('const');

    expect(token.classList.contains('shiki-token')).toBe(true);
    expect(token.style.getPropertyValue('--shiki-light')).toBe('#24292f');
    expect(token.style.getPropertyValue('--shiki-dark')).toBe('#c9d1d9');
  });

  it('wraps long lines by default', () => {
    render(
      <TooltipProvider>
        <CodeBlock code="pnpm dlx mastra init" />
      </TooltipProvider>,
    );

    const pre = screen.getByText('pnpm dlx mastra init');

    expect(pre.classList.contains('whitespace-pre-wrap')).toBe(true);
    expect(pre.classList.contains('break-all')).toBe(true);
  });

  it('preserves columns behind a horizontal scroll with overflow="scroll"', () => {
    render(
      <TooltipProvider>
        <CodeBlock code="pnpm dlx mastra init" overflow="scroll" />
      </TooltipProvider>,
    );

    const pre = screen.getByText('pnpm dlx mastra init');

    expect(pre.classList.contains('overflow-x-auto')).toBe(true);
    expect(pre.classList.contains('whitespace-pre')).toBe(true);
    expect(pre.classList.contains('whitespace-pre-wrap')).toBe(false);
  });

  it('copies the code of the active option', async () => {
    const writeText = vi.fn(async () => {});
    Object.assign(navigator, { clipboard: { writeText } });

    render(
      <TooltipProvider>
        <CodeBlock
          code="npm install @mastra/core"
          selector="tabs"
          options={[
            { label: 'pnpm', value: 'pnpm' },
            { label: 'npm', value: 'npm' },
          ]}
          value="npm"
        />
      </TooltipProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Copy to clipboard' }));

    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith('npm install @mastra/core');
    });
  });
});
