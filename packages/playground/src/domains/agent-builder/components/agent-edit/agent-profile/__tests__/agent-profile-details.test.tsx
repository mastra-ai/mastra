import { TooltipProvider } from '@mastra/playground-ui/components/Tooltip';
import { cleanup, fireEvent, render } from '@testing-library/react';
import { FormProvider, useForm } from 'react-hook-form';
import { afterEach, describe, expect, it } from 'vitest';
import type { AgentBuilderEditFormValues } from '../../../../schemas';
import { AgentProfileDetails } from '../agent-profile-details';

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
      ...defaultValues,
    } as AgentBuilderEditFormValues,
  });
  return (
    <TooltipProvider>
      <FormProvider {...methods}>{children}</FormProvider>
    </TooltipProvider>
  );
};

describe('AgentProfileDetails', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders the draft name and description from form context', () => {
    const { getByTestId } = render(
      <Wrapper defaultValues={{ name: 'Support agent', description: 'Helps customers' }}>
        <AgentProfileDetails />
      </Wrapper>,
    );

    expect((getByTestId('agent-configure-name') as HTMLInputElement).value).toBe('Support agent');
    expect((getByTestId('agent-configure-description') as HTMLTextAreaElement).value).toBe('Helps customers');
  });

  it('updates the form when typing into the name and description inputs', () => {
    const { getByTestId } = render(
      <Wrapper>
        <AgentProfileDetails />
      </Wrapper>,
    );

    const nameInput = getByTestId('agent-configure-name') as HTMLInputElement;
    fireEvent.change(nameInput, { target: { value: 'New name' } });
    expect(nameInput.value).toBe('New name');

    const descriptionInput = getByTestId('agent-configure-description') as HTMLTextAreaElement;
    fireEvent.change(descriptionInput, { target: { value: 'New description' } });
    expect(descriptionInput.value).toBe('New description');
  });

  it('disables inputs when disabled prop is set', () => {
    const { getByTestId } = render(
      <Wrapper>
        <AgentProfileDetails disabled />
      </Wrapper>,
    );

    expect((getByTestId('agent-configure-name') as HTMLInputElement).disabled).toBe(true);
    expect((getByTestId('agent-configure-description') as HTMLTextAreaElement).disabled).toBe(true);
  });

  it('does not render visible "Name" or "Description" labels', () => {
    const { queryByText } = render(
      <Wrapper>
        <AgentProfileDetails />
      </Wrapper>,
    );

    expect(queryByText('Name')).toBeNull();
    expect(queryByText('Description')).toBeNull();
  });

  it('renders the name input left-aligned (no text-center)', () => {
    const { getByTestId } = render(
      <Wrapper>
        <AgentProfileDetails />
      </Wrapper>,
    );

    expect(getByTestId('agent-configure-name').className).not.toContain('text-center');
    expect(getByTestId('agent-configure-description').className).not.toContain('text-center');
  });
});
