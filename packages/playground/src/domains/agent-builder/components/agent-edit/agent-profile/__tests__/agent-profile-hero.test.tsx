// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { AgentProfileHero } from '../agent-profile-hero';

describe('AgentProfileHero', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders the avatar and details slots below the gradient banner', () => {
    const { getByTestId, getByText } = render(
      <AgentProfileHero avatar={<span>avatar-slot</span>} details={<span>details-slot</span>} />,
    );

    expect(getByTestId('agent-profile-hero')).toBeTruthy();
    expect(getByText('avatar-slot')).toBeTruthy();
    expect(getByText('details-slot')).toBeTruthy();
  });

  it('renders a banner with a multi-accent gradient and is hidden from assistive tech', () => {
    const { getByTestId } = render(
      <AgentProfileHero avatar={<span />} details={<span />} />,
    );

    const banner = getByTestId('agent-profile-hero-banner');
    expect(banner.getAttribute('aria-hidden')).not.toBeNull();
    expect(banner.className).toContain('bg-gradient-to-br');
    expect(banner.className).toContain('from-accent3');
    expect(banner.className).toContain('via-accent5');
    expect(banner.className).toContain('to-accent6');
  });

  it('renders the actions slot when provided', () => {
    const { getByTestId, getByText } = render(
      <AgentProfileHero
        avatar={<span>avatar-slot</span>}
        details={<span>details-slot</span>}
        actions={<button type="button">action-button</button>}
      />,
    );

    expect(getByTestId('agent-profile-hero-actions')).toBeTruthy();
    expect(getByText('action-button')).toBeTruthy();
  });

  it('omits the actions container when no actions slot is provided', () => {
    const { queryByTestId } = render(
      <AgentProfileHero avatar={<span />} details={<span />} />,
    );

    expect(queryByTestId('agent-profile-hero-actions')).toBeNull();
  });
});
