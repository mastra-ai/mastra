// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { ViewTabs } from './view-tabs';

afterEach(cleanup);

describe('ViewTabs', () => {
  // A table or KPI card stacks its tabs in a column: growing there would stretch them down into a
  // blank gap whenever the card is taller than its body, e.g. beside a taller card in its row.
  it('grows along a toolbar row, but no taller than its tabs', () => {
    const { container } = render(<ViewTabs labels={['Models', 'Providers']} index={0} onChoose={() => {}} />);
    const tabs = container.querySelector('[data-slot="tabs"]');
    expect(tabs?.classList.contains('grow')).toBe(true);
    expect(tabs?.classList.contains('max-h-fit')).toBe(true);
  });
});
