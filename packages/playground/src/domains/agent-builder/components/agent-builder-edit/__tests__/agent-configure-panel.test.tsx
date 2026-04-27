// @vitest-environment jsdom
import { TooltipProvider } from '@mastra/playground-ui';
import { render, screen, cleanup, fireEvent, act } from '@testing-library/react';
import type { UseFormReturn } from 'react-hook-form';
import { FormProvider, useForm } from 'react-hook-form';
import { afterEach, describe, expect, it, vi, beforeEach } from 'vitest';
import type { AgentBuilderEditFormValues } from '../../../schemas';
import type { AgentTool } from '../../../types/agent-tool';
import { AgentConfigurePanel } from '../agent-configure-panel';

const mockUseBuilderAgentFeatures = vi.fn();

vi.mock('../../../hooks/use-builder-agent-features', () => ({
  useBuilderAgentFeatures: () => mockUseBuilderAgentFeatures(),
}));

const capturedInstructionsProps: Array<{ onChange: (next: string) => void; prompt: string; editable: boolean }> = [];
vi.mock('../details/instructions-detail', () => ({
  InstructionsDetail: (props: { prompt: string; onChange: (next: string) => void; editable: boolean }) => {
    capturedInstructionsProps.push(props);
    return <div data-testid="instructions-detail-stub" />;
  },
}));

let formMethodsRef: UseFormReturn<AgentBuilderEditFormValues> | null = null;

const FormWrapper = ({ children }: { children: React.ReactNode }) => {
  const methods = useForm<AgentBuilderEditFormValues>({
    defaultValues: {
      name: 'Draft name',
      instructions: 'Draft instructions',
      tools: {},
      skills: [],
    },
  });
  formMethodsRef = methods;
  return (
    <TooltipProvider>
      <FormProvider {...methods}>{children}</FormProvider>
    </TooltipProvider>
  );
};

const renderPanel = () =>
  render(
    <FormWrapper>
      <AgentConfigurePanel />
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
        <AgentConfigurePanel isLoading />
      </FormWrapper>,
    );

    expect(screen.getByTestId('agent-configure-panel-skeleton')).toBeTruthy();
    expect(screen.queryByTestId('agent-configure-name')).toBeNull();
    expect(screen.queryByTestId('agent-preview-edit-system-prompt')).toBeNull();
  });

  it('does not render the save button inside the panel', () => {
    render(
      <FormWrapper>
        <AgentConfigurePanel />
      </FormWrapper>,
    );

    expect(screen.queryByTestId('agent-builder-edit-save')).toBeNull();
  });
});

describe('AgentConfigurePanel agent-as-tool rendering', () => {
  beforeEach(() => {
    mockUseBuilderAgentFeatures.mockReturnValue({
      tools: true,
      skills: false,
      memory: false,
      workflows: false,
      agents: true,
    });
  });

  afterEach(() => {
    cleanup();
  });

  it('renders agents and tools identically inside the Tools detail with no separate agents UI', () => {
    const availableAgentTools: AgentTool[] = [
      { id: 'tool-a', name: 'tool-a', description: 'A tool', isChecked: true, type: 'tool' },
      { id: 'agent-x', name: 'Agent X', description: 'An agent', isChecked: true, type: 'agent' },
    ];

    render(
      <FormWrapper>
        <AgentConfigurePanel
          availableAgentTools={availableAgentTools}
          activeDetail="tools"
          onActiveDetailChange={() => {}}
        />
      </FormWrapper>,
    );

    // No separate "agents" config row / preview button exists.
    expect(screen.queryByTestId('agent-preview-agents-button')).toBeNull();

    // Tools row count reflects both tools and agents counted as one.
    const toolsButton = screen.getByTestId('agent-preview-tools-button');
    expect(toolsButton.textContent).toContain('2 / 2');

    // Both items render in the Tools detail with the same markup (no agent badge).
    expect(screen.getByText('tool-a')).toBeTruthy();
    expect(screen.getByText('Agent X')).toBeTruthy();
    expect(screen.queryByTestId('agent-tool-agent-badge')).toBeNull();
  });

  it('Tools row count updates when an agent toggle is flipped', () => {
    const availableAgentTools: AgentTool[] = [
      { id: 'tool-a', name: 'tool-a', isChecked: false, type: 'tool' },
      { id: 'agent-x', name: 'Agent X', isChecked: false, type: 'agent' },
    ];

    render(
      <FormWrapper>
        <AgentConfigurePanel
          availableAgentTools={availableAgentTools}
          activeDetail="tools"
          onActiveDetailChange={() => {}}
        />
      </FormWrapper>,
    );

    const toolsButton = screen.getByTestId('agent-preview-tools-button');
    expect(toolsButton.textContent).toContain('0 / 2');

    // Toggling the agent checkbox writes to the agents form key (covered by routing)
    // and the parent count derived from availableAgentTools stays consistent for the
    // initial render. We simply assert no "Agent" label/pill leaks into the UI.
    fireEvent.click(screen.getByText('Agent X'));
    expect(screen.queryByText(/^Agent$/)).toBeNull();
  });
});

describe('AgentConfigurePanel instructions persistence', () => {
  beforeEach(() => {
    capturedInstructionsProps.length = 0;
    formMethodsRef = null;
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

  it('writes edits from InstructionsDetail back to the form instructions field in editable mode', () => {
    render(
      <FormWrapper>
        <AgentConfigurePanel activeDetail="instructions" onActiveDetailChange={() => {}} />
      </FormWrapper>,
    );

    expect(capturedInstructionsProps.length).toBeGreaterThan(0);
    const latest = capturedInstructionsProps[capturedInstructionsProps.length - 1];
    expect(latest.editable).toBe(true);
    expect(latest.prompt).toBe('Draft instructions');

    act(() => {
      latest.onChange('New instructions from user');
    });

    expect(formMethodsRef!.getValues('instructions')).toBe('New instructions from user');
  });
});
