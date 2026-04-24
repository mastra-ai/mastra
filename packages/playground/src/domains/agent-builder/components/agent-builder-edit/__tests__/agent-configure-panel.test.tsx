// @vitest-environment jsdom
import { TooltipProvider } from '@mastra/playground-ui';
import { render, screen, cleanup } from '@testing-library/react';
import { FormProvider, useForm } from 'react-hook-form';
import { afterEach, describe, expect, it, vi, beforeEach } from 'vitest';
import type { AgentBuilderEditFormValues } from '../../../schemas';
import { EditableAgentConfigurePanel } from '../agent-configure-panel';
import type { AgentConfig } from '../agent-configure-panel';

const testAgent: AgentConfig = {
  id: 'test',
  name: 'Test agent',
  systemPrompt: 'Test prompt',
};

const mockUseBuilderAgentFeatures = vi.fn();

vi.mock('../../../hooks/use-builder-agent-features', () => ({
  useBuilderAgentFeatures: () => mockUseBuilderAgentFeatures(),
}));

const FormWrapper = ({ children }: { children: React.ReactNode }) => {
  const methods = useForm<AgentBuilderEditFormValues>({
    defaultValues: {
      name: 'Draft name',
      instructions: 'Draft instructions',
      tools: {},
      skills: [],
    },
  });
  return (
    <TooltipProvider>
      <FormProvider {...methods}>{children}</FormProvider>
    </TooltipProvider>
  );
};

const renderPanel = () =>
  render(
    <FormWrapper>
      <EditableAgentConfigurePanel agent={testAgent} onAgentChange={() => {}} />
    </FormWrapper>,
  );

describe('AgentConfigurePanel feature gating', () => {
  beforeEach(() => {
    mockUseBuilderAgentFeatures.mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders only Name, Instructions, and the avatar when both feature flags are off', () => {
    mockUseBuilderAgentFeatures.mockReturnValue({
      tools: false,
      skills: false,
      memory: false,
      workflows: false,
      agents: false,
    });

    renderPanel();

    expect(screen.getByTestId('agent-configure-avatar-trigger')).toBeTruthy();
    expect(screen.getByTestId('agent-configure-name')).toBeTruthy();
    expect(screen.getByTestId('agent-preview-edit-system-prompt')).toBeTruthy();
    expect(screen.queryByTestId('agent-preview-tools-button')).toBeNull();
    expect(screen.queryByTestId('agent-preview-skills-button')).toBeNull();
    expect(screen.queryByTestId('agent-preview-channels-button')).toBeNull();
    expect(screen.queryByTestId('agent-preview-model-trigger')).toBeNull();
    expect(screen.queryByTestId('agent-configure-save')).toBeNull();
  });

  it('renders Tools row only when features.tools is true', () => {
    mockUseBuilderAgentFeatures.mockReturnValue({
      tools: true,
      skills: false,
      memory: false,
      workflows: false,
      agents: false,
    });

    renderPanel();

    expect(screen.getByTestId('agent-preview-tools-button')).toBeTruthy();
    expect(screen.queryByTestId('agent-preview-skills-button')).toBeNull();
  });

  it('renders Skills row only when features.skills is true', () => {
    mockUseBuilderAgentFeatures.mockReturnValue({
      tools: false,
      skills: true,
      memory: false,
      workflows: false,
      agents: false,
    });

    renderPanel();

    expect(screen.getByTestId('agent-preview-skills-button')).toBeTruthy();
    expect(screen.queryByTestId('agent-preview-tools-button')).toBeNull();
  });

  it('renders both Tools and Skills rows when both flags are true', () => {
    mockUseBuilderAgentFeatures.mockReturnValue({
      tools: true,
      skills: true,
      memory: false,
      workflows: false,
      agents: false,
    });

    renderPanel();

    expect(screen.getByTestId('agent-preview-tools-button')).toBeTruthy();
    expect(screen.getByTestId('agent-preview-skills-button')).toBeTruthy();
  });
});

describe('AgentConfigurePanel skeleton', () => {
  beforeEach(() => {
    mockUseBuilderAgentFeatures.mockReturnValue({
      tools: false,
      skills: false,
      memory: false,
      workflows: false,
      agents: false,
    });
  });

  afterEach(() => {
    cleanup();
  });

  it('renders the skeleton and hides form fields while loading', () => {
    render(
      <FormWrapper>
        <EditableAgentConfigurePanel agent={testAgent} onAgentChange={() => {}} isLoading />
      </FormWrapper>,
    );

    expect(screen.getByTestId('agent-configure-panel-skeleton')).toBeTruthy();
    expect(screen.queryByTestId('agent-configure-name')).toBeNull();
    expect(screen.queryByTestId('agent-preview-edit-system-prompt')).toBeNull();
  });

  it('does not render the save button inside the panel', () => {
    render(
      <FormWrapper>
        <EditableAgentConfigurePanel agent={testAgent} onAgentChange={() => {}} />
      </FormWrapper>,
    );

    expect(screen.queryByTestId('agent-builder-edit-save')).toBeNull();
  });
});
