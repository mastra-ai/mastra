// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { RuleLine, RuleLineGroup, RuleLineGroupRemove, RuleLineKeyword, RuleLineLogic, RuleLines } from './rule-lines';

// Base UI's Select synthesizes PointerEvents on interaction, which jsdom does
// not implement. Polyfill it with the available MouseEvent constructor.
beforeAll(() => {
  if (window.PointerEvent === undefined) {
    Object.defineProperty(window, 'PointerEvent', { value: window.MouseEvent, configurable: true });
  }
});

afterEach(() => {
  cleanup();
});

describe('RuleLineLogic', () => {
  it('reads the current logic as a lowercase word', () => {
    render(<RuleLineLogic value="AND" onValueChange={() => {}} />);

    const trigger = screen.getByRole('combobox', { name: 'Match all or any' });
    expect(trigger.textContent).toBe('and');
  });

  it('reports the picked logic and nothing else', async () => {
    const onValueChange = vi.fn();
    render(<RuleLineLogic value="AND" onValueChange={onValueChange} />);

    fireEvent.click(screen.getByRole('combobox', { name: 'Match all or any' }));
    const or = await screen.findByRole('option', { name: 'or' });
    fireEvent.pointerDown(or, { pointerType: 'mouse' });
    fireEvent.click(or, { detail: 1 });

    await waitFor(() => {
      expect(onValueChange).toHaveBeenCalledTimes(1);
    });
    expect(onValueChange.mock.calls[0]).toEqual(['OR']);
  });
});

describe('RuleLineKeyword', () => {
  it('hides an empty keyword from assistive tech but keeps a written one', () => {
    render(
      <RuleLines>
        <RuleLine>
          <RuleLineKeyword>Where</RuleLineKeyword>
        </RuleLine>
        <RuleLine>
          <RuleLineKeyword data-testid="spacer" />
        </RuleLine>
      </RuleLines>,
    );

    expect(screen.getByText('Where').getAttribute('aria-hidden')).toBeNull();
    expect(screen.getByTestId('spacer').getAttribute('aria-hidden')).toBe('true');
  });
});

describe('RuleLineGroup', () => {
  it('is a named group that can be removed as a whole', () => {
    const onRemove = vi.fn();
    render(
      <RuleLineGroup depth={0} aria-label="Any of these">
        <RuleLines>
          <RuleLine>
            <RuleLineGroupRemove onClick={onRemove}>Remove group</RuleLineGroupRemove>
          </RuleLine>
        </RuleLines>
      </RuleLineGroup>,
    );

    const group = screen.getByRole('group', { name: 'Any of these' });
    fireEvent.click(within(group).getByRole('button', { name: 'Remove group' }));

    expect(onRemove).toHaveBeenCalledTimes(1);
  });
});
