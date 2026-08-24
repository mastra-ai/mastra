// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactElement } from 'react';
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

const renderBlock = (element: ReactElement) => render(<TooltipProvider>{element}</TooltipProvider>);

const OPTIONS = [
  { label: 'npm', value: 'npm' },
  { label: 'pnpm', value: 'pnpm' },
];

describe('CodeBlock — its header', () => {
  it('names the file it is showing', () => {
    renderBlock(<CodeBlock code="const a = 1" fileName="index.ts" />);

    const caption = screen.getByText('index.ts');
    expect(caption.tagName).toBe('FIGCAPTION');
  });

  it('shows no header at all with nothing to put in it', () => {
    const { container } = renderBlock(<CodeBlock code="const a = 1" />);

    expect(container.querySelector('figcaption')).toBeNull();
    expect(container.querySelector('[role="tab"], [role="combobox"]')).toBeNull();
  });

  it('gives lone actions a header of their own', () => {
    renderBlock(<CodeBlock code="const a = 1" actions={<button type="button">Run</button>} />);

    expect(screen.getByRole('button', { name: 'Run' })).toBeTruthy();
  });

  it('puts actions beside the file name', () => {
    renderBlock(<CodeBlock code="const a = 1" fileName="index.ts" actions={<button type="button">Run</button>} />);

    expect(screen.getByText('index.ts')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Run' })).toBeTruthy();
    expect(screen.getByText('index.ts').parentElement?.childElementCount).toBe(2);
  });

  it('leaves no empty slot beside the file name when there are no actions', () => {
    renderBlock(<CodeBlock code="const a = 1" fileName="index.ts" />);

    expect(screen.getByText('index.ts').parentElement?.childElementCount).toBe(1);
  });
});

/** The row holding the tab list, and anything the caller put beside it. */
const tabHeaderRow = () => screen.getByRole('tablist').parentElement?.parentElement?.parentElement;

/**
 * The row holding the select, and anything the caller put beside it. The select
 * itself contributes two children: the trigger and a hidden field behind it.
 */
const selectHeaderRow = () => screen.getByRole('combobox').parentElement;

describe('CodeBlock — choosing between variants', () => {
  it('offers a select by default', () => {
    renderBlock(<CodeBlock code="npm i" options={OPTIONS} />);

    expect(screen.getByRole('combobox')).toBeTruthy();
    expect(screen.queryByRole('tab')).toBeNull();
  });

  it('offers tabs when the caller asks for them', () => {
    renderBlock(<CodeBlock code="npm i" options={OPTIONS} selector="tabs" />);

    expect(screen.getAllByRole('tab').map(tab => tab.textContent)).toEqual(['npm', 'pnpm']);
    expect(screen.queryByRole('combobox')).toBeNull();
  });

  it('opens on the first option when the caller names none', () => {
    renderBlock(<CodeBlock code="npm i" options={OPTIONS} selector="tabs" />);

    expect(screen.getByRole('tab', { name: 'npm' }).getAttribute('aria-selected')).toBe('true');
  });

  it('opens on the option the caller named', () => {
    renderBlock(<CodeBlock code="pnpm i" options={OPTIONS} selector="tabs" value="pnpm" />);

    expect(screen.getByRole('tab', { name: 'pnpm' }).getAttribute('aria-selected')).toBe('true');
  });

  it('reports the tab the reader picked', () => {
    const onValueChange = vi.fn();
    renderBlock(<CodeBlock code="npm i" options={OPTIONS} selector="tabs" onValueChange={onValueChange} />);

    fireEvent.click(screen.getByRole('tab', { name: 'pnpm' }));

    expect(onValueChange).toHaveBeenCalledWith('pnpm');
  });

  it('lets a tab be picked even with nowhere to report it', () => {
    renderBlock(<CodeBlock code="npm i" options={OPTIONS} selector="tabs" />);

    expect(() => fireEvent.click(screen.getByRole('tab', { name: 'pnpm' }))).not.toThrow();
  });

  it('falls back to the file name when the options list is empty', () => {
    renderBlock(<CodeBlock code="const a = 1" options={[]} fileName="index.ts" />);

    expect(screen.getByText('index.ts')).toBeTruthy();
    expect(screen.queryByRole('combobox')).toBeNull();
  });

  it('puts actions beside the tabs', () => {
    renderBlock(
      <CodeBlock code="npm i" options={OPTIONS} selector="tabs" actions={<button type="button">Run</button>} />,
    );

    expect(screen.getByRole('button', { name: 'Run' })).toBeTruthy();
    expect(screen.getAllByRole('tab')).toHaveLength(2);
    expect(tabHeaderRow()?.childElementCount).toBe(2);
  });

  it('leaves no empty slot beside the tabs when there are no actions', () => {
    renderBlock(<CodeBlock code="npm i" options={OPTIONS} selector="tabs" />);

    expect(tabHeaderRow()?.childElementCount).toBe(1);
  });

  it('puts actions beside the select', () => {
    renderBlock(<CodeBlock code="npm i" options={OPTIONS} actions={<button type="button">Run</button>} />);

    expect(screen.getByRole('button', { name: 'Run' })).toBeTruthy();
    expect(screen.getByRole('combobox')).toBeTruthy();
    expect(selectHeaderRow()?.childElementCount).toBe(3);
  });

  it('leaves no empty slot beside the select when there are no actions', () => {
    renderBlock(<CodeBlock code="npm i" options={OPTIONS} />);

    expect(selectHeaderRow()?.childElementCount).toBe(2);
  });

  it('lists every option in the select', async () => {
    renderBlock(<CodeBlock code="npm i" options={OPTIONS} />);

    fireEvent.click(screen.getByRole('combobox'));

    const items = await screen.findAllByRole('option');
    expect(items.map(item => item.textContent)).toEqual(OPTIONS.map(option => option.label));
  });
});

describe('CodeBlock — copying', () => {
  it('names the copy action the way the caller asked', async () => {
    renderBlock(<CodeBlock code="npm i" copyTooltip="Copy the install command" />);

    // The tooltip is the button's accessible name, so it has to be the exact one.
    await waitFor(() => expect(screen.getByRole('button', { name: 'Copy the install command' })).toBeTruthy());
  });

  it('falls back to its own name for the copy action', async () => {
    renderBlock(<CodeBlock code="npm i" />);

    await waitFor(() => expect(screen.getByRole('button', { name: 'Copy to clipboard' })).toBeTruthy());
  });

  it('keeps a caller class alongside its own', () => {
    const { container } = renderBlock(<CodeBlock code="npm i" className="my-own-class" />);

    const figure = container.querySelector('figure');
    expect(figure?.classList.contains('my-own-class')).toBe(true);
    expect(figure?.classList.contains('rounded-2xl')).toBe(true);
  });
});
