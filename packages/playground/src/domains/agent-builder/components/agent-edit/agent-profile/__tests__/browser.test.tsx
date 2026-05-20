// @vitest-environment jsdom
import { TooltipProvider } from '@mastra/playground-ui';
import { cleanup, fireEvent, render } from '@testing-library/react';
import { FormProvider, useForm } from 'react-hook-form';
import { afterEach, describe, expect, it } from 'vitest';
import type { AgentBuilderEditFormValues } from '../../../../schemas';
import { Browser } from '../browser';

const Wrapper = ({
  children,
  defaultValues,
}: {
  children: React.ReactNode;
  defaultValues?: Partial<AgentBuilderEditFormValues>;
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
      <FormProvider {...methods}>{children}</FormProvider>
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
});
