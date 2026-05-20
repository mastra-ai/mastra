// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import type { ReactNode } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { afterEach, describe, expect, it } from 'vitest';
import { AgentColorProvider } from '../../../../contexts/agent-color-context';
import type { AgentBuilderEditFormValues } from '../../../../schemas';
import { AgentProfileHero } from '../agent-profile-hero';

const FormHarness = ({ agentName = '', children }: { agentName?: string; children: ReactNode }) => {
  const methods = useForm<AgentBuilderEditFormValues>({
    defaultValues: { name: agentName } as AgentBuilderEditFormValues,
  });
  return (
    <FormProvider {...methods}>
      <AgentColorProvider>{children}</AgentColorProvider>
    </FormProvider>
  );
};

const renderHero = (ui: ReactNode, { agentName = '' }: { agentName?: string } = {}) =>
  render(<FormHarness agentName={agentName}>{ui}</FormHarness>);

describe('AgentProfileHero', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders the avatar and details slots below the gradient banner', () => {
    const { getByTestId, getByText } = renderHero(
      <AgentProfileHero avatar={<span>avatar-slot</span>} details={<span>details-slot</span>} />,
    );

    expect(getByTestId('agent-profile-hero')).toBeTruthy();
    expect(getByText('avatar-slot')).toBeTruthy();
    expect(getByText('details-slot')).toBeTruthy();
  });

  it('uses the static accent gradient when no agent name is set', () => {
    const { getByTestId } = renderHero(<AgentProfileHero avatar={<span />} details={<span />} />);

    const banner = getByTestId('agent-profile-hero-banner');
    expect(banner.getAttribute('aria-hidden')).not.toBeNull();
    expect(banner.className).toContain('bg-gradient-to-br');
    expect(banner.className).toContain('from-accent3');
    expect(banner.className).toContain('via-accent5');
    expect(banner.className).toContain('to-accent6');
    expect(banner.style.backgroundImage).toBe('');
  });

  it('uses an HSL gradient derived from the agent name when set', () => {
    const { getByTestId } = renderHero(<AgentProfileHero avatar={<span />} details={<span />} />, {
      agentName: 'Support agent',
    });

    const banner = getByTestId('agent-profile-hero-banner');
    expect(banner.style.backgroundImage).toContain('linear-gradient');
    const hslMatches = banner.style.backgroundImage.match(/hsl\(/g);
    expect(hslMatches).not.toBeNull();
    expect(hslMatches!.length).toBe(2);
    expect(banner.className).not.toContain('from-accent3');
    expect(banner.className).not.toContain('via-accent5');
    expect(banner.className).not.toContain('to-accent6');
  });

  it('renders the actions slot when provided', () => {
    const { getByTestId, getByText } = renderHero(
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
    const { queryByTestId } = renderHero(<AgentProfileHero avatar={<span />} details={<span />} />);

    expect(queryByTestId('agent-profile-hero-actions')).toBeNull();
  });
});
