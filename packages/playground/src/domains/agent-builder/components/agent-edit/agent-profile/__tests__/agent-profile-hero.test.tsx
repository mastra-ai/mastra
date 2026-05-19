// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { AgentProfileHero } from '../agent-profile-hero';

describe('AgentProfileHero', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders children below the gradient banner', () => {
    const { getByTestId, getByText } = render(
      <AgentProfileHero>
        <span>profile-content</span>
      </AgentProfileHero>,
    );

    expect(getByTestId('agent-profile-hero')).toBeTruthy();
    expect(getByText('profile-content')).toBeTruthy();
  });

  it('renders a banner with a multi-accent gradient and is hidden from assistive tech', () => {
    const { getByTestId } = render(
      <AgentProfileHero>
        <span />
      </AgentProfileHero>,
    );

    const banner = getByTestId('agent-profile-hero-banner');
    expect(banner.getAttribute('aria-hidden')).not.toBeNull();
    expect(banner.className).toContain('bg-gradient-to-br');
    expect(banner.className).toContain('from-accent3');
    expect(banner.className).toContain('via-accent5');
    expect(banner.className).toContain('to-accent6');
  });
});
