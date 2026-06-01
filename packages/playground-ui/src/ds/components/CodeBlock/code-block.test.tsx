// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { TooltipProvider } from '../Tooltip';
import { CodeBlock } from './code-block';

vi.mock('../CodeEditor', () => ({
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
});
