import { stringToColor } from '@mastra/playground-ui';
import { TooltipProvider } from '@mastra/playground-ui/components/Tooltip';
import { cleanup, fireEvent, render } from '@testing-library/react';
import { FormProvider, useForm } from 'react-hook-form';
import { afterEach, describe, expect, it } from 'vitest';
import { AgentColorProvider } from '../../../../contexts/agent-color-context';
import type { AgentBuilderEditFormValues } from '../../../../schemas';
import { Browser } from '../browser';

const Wrapper = ({
  children,
  defaultValues,
  agentId = 'agent_test',
}: {
  children: React.ReactNode;
  defaultValues?: Partial<AgentBuilderEditFormValues>;
  agentId?: string;
}) => {
  const methods = useForm<AgentBuilderEditFormValues>({
    defaultValues: {
      name: '',
      description: '',
      instructions: '',
      tools: {},
      skills: {},
      browserEnabled: false,
      ...defaultValues,
    } as AgentBuilderEditFormValues,
  });
  return (
    <TooltipProvider>
      <FormProvider {...methods}>
        <AgentColorProvider agentId={agentId}>{children}</AgentColorProvider>
      </FormProvider>
    </TooltipProvider>
  );
};

describe('Browser', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders the switch in the unchecked state and shows a Disabled status when browserEnabled is false', () => {
    const { getByTestId, getByText } = render(
      <Wrapper>
        <Browser />
      </Wrapper>,
    );

    expect(getByTestId('agent-browser-toggle').getAttribute('aria-checked')).toBe('false');
    expect(getByText('Disabled')).toBeTruthy();
  });

  it('flips the switch and status when toggled', () => {
    const { getByTestId, getByText } = render(
      <Wrapper>
        <Browser />
      </Wrapper>,
    );

    fireEvent.click(getByTestId('agent-browser-toggle'));

    expect(getByTestId('agent-browser-toggle').getAttribute('aria-checked')).toBe('true');
    expect(getByText('Enabled')).toBeTruthy();
  });

  it('reflects an initial browserEnabled=true form value', () => {
    const { getByTestId, getByText } = render(
      <Wrapper defaultValues={{ browserEnabled: true }}>
        <Browser />
      </Wrapper>,
    );

    expect(getByTestId('agent-browser-toggle').getAttribute('aria-checked')).toBe('true');
    expect(getByText('Enabled')).toBeTruthy();
  });

  it('disables the switch when editable is false', () => {
    const { getByTestId } = render(
      <Wrapper>
        <Browser editable={false} />
      </Wrapper>,
    );

    expect((getByTestId('agent-browser-toggle') as HTMLButtonElement).disabled).toBe(true);
  });

  it('paints the enabled switch with the agent tint color (lightness 50) derived from the agentId', () => {
    const agentId = 'agent_support';
    const { getByTestId } = render(
      <Wrapper agentId={agentId} defaultValues={{ browserEnabled: true }}>
        <Browser />
      </Wrapper>,
    );

    // jsdom normalizes inline colors to rgb(...); compare via a probe element fed the same hsl().
    const probe = document.createElement('div');
    probe.style.backgroundColor = stringToColor(agentId, 50);
    const expected = probe.style.backgroundColor;
    expect(expected).not.toBe('');

    const toggle = getByTestId('agent-browser-toggle') as HTMLButtonElement;
    expect(toggle.style.backgroundColor).toBe(expected);
    // It must NOT match the foreground (lightness 20) value that the switch previously used.
    const fgProbe = document.createElement('div');
    fgProbe.style.backgroundColor = stringToColor(agentId, 20);
    expect(toggle.style.backgroundColor).not.toBe(fgProbe.style.backgroundColor);
  });

  it('does not apply an inline background color to the switch when browserEnabled is false', () => {
    const { getByTestId } = render(
      <Wrapper defaultValues={{ browserEnabled: false }}>
        <Browser />
      </Wrapper>,
    );

    const toggle = getByTestId('agent-browser-toggle') as HTMLButtonElement;
    expect(toggle.style.backgroundColor).toBe('');
  });
});
