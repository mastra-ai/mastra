// @vitest-environment jsdom
import { TooltipProvider } from '@mastra/playground-ui';
import { render, screen, cleanup } from '@testing-library/react';
import { FormProvider, useForm } from 'react-hook-form';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it } from 'vitest';
import { AgentColorProvider } from '../../../contexts/agent-color-context';
import type { AgentBuilderEditFormValues } from '../../../schemas';
import { AgentBuilderTitle } from '../agent-builder-title';

const FormWrapper = ({
  children,
  defaults,
}: {
  children: React.ReactNode;
  defaults?: Partial<AgentBuilderEditFormValues>;
}) => {
  const methods = useForm<AgentBuilderEditFormValues>({
    defaultValues: {
      name: 'Support agent',
      instructions: '',
      tools: {},
      skills: {},
      ...defaults,
    },
  });
  return (
    <MemoryRouter>
      <TooltipProvider>
        <FormProvider {...methods}>
          <AgentColorProvider agentId="agent_test">{children}</AgentColorProvider>
        </FormProvider>
      </TooltipProvider>
    </MemoryRouter>
  );
};

describe('AgentBuilderTitle', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders the form name when not loading', () => {
    render(
      <FormWrapper>
        <AgentBuilderTitle />
      </FormWrapper>,
    );

    expect(screen.getByTestId('agent-builder-title-name').textContent).toBe('Support agent');
    expect(screen.queryByTestId('agent-builder-title-skeleton')).toBeNull();
  });

  it('renders a skeleton in place of the name when loading', () => {
    render(
      <FormWrapper>
        <AgentBuilderTitle isLoading />
      </FormWrapper>,
    );

    expect(screen.getByTestId('agent-builder-title-skeleton')).toBeTruthy();
    expect(screen.queryByText('Support agent')).toBeNull();
  });

  it('does not render a mode badge', () => {
    render(
      <FormWrapper>
        <AgentBuilderTitle />
      </FormWrapper>,
    );

    expect(screen.queryByTestId('agent-builder-mode-badge-build')).toBeNull();
    expect(screen.queryByTestId('agent-builder-mode-badge-test')).toBeNull();
  });

  it('does not render the mode-toggle button (now rendered by the top bar)', () => {
    render(
      <FormWrapper>
        <AgentBuilderTitle />
      </FormWrapper>,
    );

    expect(screen.queryByTestId('agent-builder-mode-toggle')).toBeNull();
  });

  it('falls back to "Untitled" when the name is whitespace', () => {
    render(
      <FormWrapper defaults={{ name: '   ' }}>
        <AgentBuilderTitle />
      </FormWrapper>,
    );

    expect(screen.getByTestId('agent-builder-title-name').textContent).toBe('Untitled');
  });
});
