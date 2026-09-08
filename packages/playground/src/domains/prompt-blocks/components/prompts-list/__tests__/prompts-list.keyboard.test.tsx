import type { StoredPromptBlockResponse } from '@mastra/client-js';
import { describe, expect, it } from 'vitest';

import { PromptsList } from '../prompts-list';
import { expectArrowNavigation, expectRovingTabindex, interactiveRows } from '@/test/keyboard';
import { TestLinkProvider } from '@/test/link-provider';
import { renderWithProviders } from '@/test/render';

const promptBlocks = [
  { id: 'block-a', name: 'Greeting', description: 'Says hello' },
  { id: 'block-b', name: 'Summary', description: 'Summarizes text' },
  { id: 'block-c', name: 'Refusal', description: 'Politely declines' },
] as unknown as StoredPromptBlockResponse[];

const renderList = () =>
  renderWithProviders(
    <TestLinkProvider>
      <PromptsList promptBlocks={promptBlocks} isLoading={false} />
    </TestLinkProvider>,
  );

describe('PromptsList keyboard navigation', () => {
  it('applies a roving tabindex to prompt-block rows', () => {
    renderList();

    const rows = interactiveRows();
    expect(rows).toHaveLength(3);
    expect(rows.every(row => row.tagName === 'A')).toBe(true);
    expectRovingTabindex(rows);
  });

  it('moves focus with ArrowDown/ArrowUp and jumps with Home/End', () => {
    renderList();

    expectArrowNavigation(interactiveRows());
  });

  it('keeps row links navigable (href preserved on the focus target)', () => {
    renderList();

    expect(interactiveRows().map(row => row.getAttribute('href'))).toEqual([
      '/cms/prompt-blocks/block-a',
      '/cms/prompt-blocks/block-b',
      '/cms/prompt-blocks/block-c',
    ]);
  });
});
