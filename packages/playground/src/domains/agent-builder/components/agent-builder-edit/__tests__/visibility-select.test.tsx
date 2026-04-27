// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { VisibilitySelect } from '../visibility-select';

describe('VisibilitySelect', () => {
  beforeAll(() => {
    if (!Element.prototype.scrollIntoView) {
      Element.prototype.scrollIntoView = () => {};
    }
    if (!Element.prototype.hasPointerCapture) {
      Element.prototype.hasPointerCapture = () => false;
    }
    if (!Element.prototype.releasePointerCapture) {
      Element.prototype.releasePointerCapture = () => {};
    }
  });

  afterEach(() => {
    cleanup();
  });

  it('defaults to Private', () => {
    render(<VisibilitySelect />);

    const trigger = screen.getByTestId('agent-builder-visibility-trigger');
    expect(trigger.textContent).toContain('Private');
  });

  it('switches to Shared in Library when selected and calls onChange', async () => {
    const onChange = vi.fn();
    render(<VisibilitySelect onChange={onChange} />);

    const trigger = screen.getByTestId('agent-builder-visibility-trigger');
    fireEvent.click(trigger);
    fireEvent.keyDown(trigger, { key: 'Enter' });

    const sharedOption = await screen.findByRole('option', { name: 'Shared in Library' });
    fireEvent.click(sharedOption);

    expect(screen.getByTestId('agent-builder-visibility-trigger').textContent).toContain('Shared in Library');
    expect(onChange).toHaveBeenCalledWith('shared');
    expect(onChange).toHaveBeenCalledTimes(1);
  });
});
