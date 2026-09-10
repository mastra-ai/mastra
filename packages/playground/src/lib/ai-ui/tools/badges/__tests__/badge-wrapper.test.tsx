import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { BadgeWrapper } from '../badge-wrapper';

afterEach(() => cleanup());

describe('BadgeWrapper', () => {
  it('reveals the body when the trigger is clicked', () => {
    render(
      <BadgeWrapper title="Ran tool">
        <span>tool output</span>
      </BadgeWrapper>,
    );

    fireEvent.click(screen.getByRole('button', { name: /ran tool/i }));
    expect(screen.getByText('tool output')).toBeTruthy();
  });

  it('keeps the body of a badge that cannot be collapsed visible', () => {
    render(
      <BadgeWrapper title="Working" collapsible={false}>
        <span>live output</span>
      </BadgeWrapper>,
    );

    expect(screen.getByText('live output')).toBeTruthy();
  });

  it('hides the body of a collapsible badge until it is opened', () => {
    render(
      <BadgeWrapper title="Ran tool">
        <span>tool output</span>
      </BadgeWrapper>,
    );

    expect(screen.queryByText('tool output')).toBeNull();
  });
});
