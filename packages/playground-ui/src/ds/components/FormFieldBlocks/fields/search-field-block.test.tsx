// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { TooltipProvider } from '../../Tooltip';
import { SearchFieldBlock } from './search-field-block';

afterEach(() => {
  cleanup();
});

function renderField(props: Partial<React.ComponentProps<typeof SearchFieldBlock>> = {}) {
  render(
    <TooltipProvider>
      <SearchFieldBlock name="search" label="Search" labelIsHidden size="sm" {...props} />
    </TooltipProvider>,
  );
  return screen.getByRole('textbox') as HTMLInputElement;
}

describe('SearchFieldBlock match-nav padding', () => {
  it('reserves no inline padding when match navigation is not used', () => {
    const input = renderField();
    expect(input.style.paddingRight).toBe('');
  });

  it('reserves right padding sized to the rendered counter', () => {
    const narrow = renderField({ matchCount: 3, currentMatch: 1 });
    const narrowPadding = parseFloat(narrow.style.paddingRight);
    cleanup();

    // 2841/2841 renders as "999+/999+" — wider than "1/3", so more padding is reserved,
    // but bounded by the 999+ cap so it can never crowd out the whole input.
    const wide = renderField({ matchCount: 2841, currentMatch: 2841 });
    const widePadding = parseFloat(wide.style.paddingRight);

    expect(narrow.style.paddingRight).toMatch(/rem$/);
    expect(wide.style.paddingRight).toMatch(/rem$/);
    expect(widePadding).toBeGreaterThan(narrowPadding);
  });

  it('keeps the same padding for any count above the display cap', () => {
    const first = renderField({ matchCount: 1000, currentMatch: 1000 });
    const capped = first.style.paddingRight;
    cleanup();

    const second = renderField({ matchCount: 999999, currentMatch: 999999 });
    expect(second.style.paddingRight).toBe(capped);
  });
});
