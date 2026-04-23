// @vitest-environment jsdom
import { TooltipProvider } from '@mastra/playground-ui';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { FormProvider, useForm } from 'react-hook-form';
import { afterEach, describe, expect, it, vi, beforeEach } from 'vitest';
import { defaultAgentFixture } from '../../../fixtures';
import type { AgentBuilderEditFormValues } from '../../../schemas';
import { EditableAgentConfigurePanel } from '../agent-configure-panel';

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
      <EditableAgentConfigurePanel agent={defaultAgentFixture} onAgentChange={() => {}} onClose={() => {}} />
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

describe('AgentConfigurePanel save + skeleton', () => {
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
        <EditableAgentConfigurePanel
          agent={defaultAgentFixture}
          onAgentChange={() => {}}
          onClose={() => {}}
          isLoading
        />
      </FormWrapper>,
    );

    expect(screen.getByTestId('agent-configure-panel-skeleton')).toBeTruthy();
    expect(screen.queryByTestId('agent-configure-name')).toBeNull();
    expect(screen.queryByTestId('agent-preview-edit-system-prompt')).toBeNull();
  });

  it('renders the save button and invokes onSave when clicked', () => {
    const onSave = vi.fn();
    render(
      <FormWrapper>
        <EditableAgentConfigurePanel
          agent={defaultAgentFixture}
          onAgentChange={() => {}}
          onClose={() => {}}
          onSave={onSave}
        />
      </FormWrapper>,
    );

    const saveButton = screen.getByTestId('agent-builder-edit-save');
    expect(saveButton).toBeTruthy();
    fireEvent.click(saveButton);
    expect(onSave).toHaveBeenCalledTimes(1);
  });

  it('does not render the save button when onSave is omitted', () => {
    render(
      <FormWrapper>
        <EditableAgentConfigurePanel agent={defaultAgentFixture} onAgentChange={() => {}} onClose={() => {}} />
      </FormWrapper>,
    );

    expect(screen.queryByTestId('agent-builder-edit-save')).toBeNull();
  });

  it('disables the save button while saving', () => {
    render(
      <FormWrapper>
        <EditableAgentConfigurePanel
          agent={defaultAgentFixture}
          onAgentChange={() => {}}
          onClose={() => {}}
          onSave={() => {}}
          isSaving
        />
      </FormWrapper>,
    );

    const saveButton = screen.getByTestId('agent-builder-edit-save') as HTMLButtonElement;
    expect(saveButton.disabled).toBe(true);
  });
});
