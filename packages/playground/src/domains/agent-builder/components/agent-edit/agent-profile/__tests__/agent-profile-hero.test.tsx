// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import type { ReactNode } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { afterEach, describe, expect, it } from 'vitest';
import { AgentColorProvider } from '../../../../contexts/agent-color-context';
import type { AgentBuilderEditFormValues } from '../../../../schemas';
import { AgentProfileHero } from '../agent-profile-hero';

const FormHarness = ({ children }: { children: ReactNode }) => {
  const methods = useForm<AgentBuilderEditFormValues>({
    defaultValues: {} as AgentBuilderEditFormValues,
  });
  return (
    <FormProvider {...methods}>
      <AgentColorProvider agentId="agent_test">{children}</AgentColorProvider>
    </FormProvider>
  );
};

const renderHero = (ui: ReactNode) => render(<FormHarness>{ui}</FormHarness>);

describe('AgentProfileHero', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders the avatar and details slots', () => {
    const { getByTestId, getByText } = renderHero(
      <AgentProfileHero avatar={<span>avatar-slot</span>} details={<span>details-slot</span>} />,
    );

    expect(getByTestId('agent-profile-hero')).toBeTruthy();
    expect(getByText('avatar-slot')).toBeTruthy();
    expect(getByText('details-slot')).toBeTruthy();
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
