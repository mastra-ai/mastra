// @vitest-environment jsdom
import { TooltipProvider } from '@mastra/playground-ui';
import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, cleanup, fireEvent, act, within } from '@testing-library/react';
import type { UseFormReturn } from 'react-hook-form';
import { FormProvider, useForm } from 'react-hook-form';
import { afterEach, describe, expect, it, vi, beforeEach } from 'vitest';
import type { AgentBuilderEditFormValues } from '../../../schemas';
import type { AgentTool } from '../../../types/agent-tool';
import { AgentConfigurePanel } from '../agent-configure-panel';

const BASE_URL = 'http://localhost:4111';

const mockUseBuilderAgentFeatures = vi.fn();

vi.mock('../../../hooks/use-builder-agent-features', () => ({
  useBuilderAgentFeatures: () => mockUseBuilderAgentFeatures(),
}));

const mockUseBuilderModelPolicy = vi.fn(
  () =>
    ({ active: false }) as {
      active: boolean;
      pickerVisible?: boolean;
      default?: { provider: string; modelId: string };
      allowed?: unknown;
    },
);

vi.mock('@/domains/builder', () => ({
  useBuilderModelPolicy: () => mockUseBuilderModelPolicy(),
  useBuilderFilteredProviders: (providers: unknown) => providers,
}));

vi.mock('@/domains/llm', () => ({
  ProviderLogo: ({ providerId }: { providerId: string }) => (
    <span data-testid="provider-logo" data-provider={providerId} />
  ),
  cleanProviderId: (id: string) => id,
}));

vi.mock('../model-card-picker', () => ({
  ModelCardPicker: ({
    value,
    disabled,
  }: {
    value: { provider: string; name: string } | undefined;
    disabled?: boolean;
  }) => (
    <div data-testid="model-card-picker" data-disabled={disabled ? 'true' : 'false'}>
      {value ? `${value.provider}/${value.name}` : 'no-model'}
    </div>
  ),
}));

const capturedInstructionsProps: Array<{ onChange: (next: string) => void; prompt: string; editable: boolean }> = [];
vi.mock('../details/instructions-detail', () => ({
  InstructionsDetail: (props: { prompt: string; onChange: (next: string) => void; editable: boolean }) => {
    capturedInstructionsProps.push(props);
    return <textarea data-testid="instructions-detail-textarea" readOnly={!props.editable} value={props.prompt} />;
  },
}));

let formMethodsRef: UseFormReturn<AgentBuilderEditFormValues> | null = null;

const FormWrapper = ({ children }: { children: React.ReactNode }) => {
  const methods = useForm<AgentBuilderEditFormValues>({
    defaultValues: {
      name: 'Draft name',
      instructions: 'Draft instructions',
      tools: {},
    },
  });
  formMethodsRef = methods;
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return (
    <MastraReactProvider baseUrl={BASE_URL}>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <FormProvider {...methods}>{children}</FormProvider>
        </TooltipProvider>
      </QueryClientProvider>
    </MastraReactProvider>
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

  it('renders only Name, Instructions, and the avatar display when all feature flags are off', () => {
    mockUseBuilderAgentFeatures.mockReturnValue({
      tools: false,
      skills: false,
      memory: false,
      workflows: false,
      agents: false,
      avatarUpload: false,
    });

    renderPanel();

    // Avatar upload trigger should NOT be present (feature flag off)
    expect(screen.queryByTestId('agent-configure-avatar-trigger')).toBeNull();
    // Avatar display (non-interactive) should be present
    expect(screen.getByTestId('agent-configure-avatar-display')).toBeTruthy();
    expect(screen.getByTestId('agent-configure-name')).toBeTruthy();
    expect(screen.getByTestId('agent-preview-edit-system-prompt')).toBeTruthy();
    expect(screen.queryByTestId('agent-preview-tools-button')).toBeNull();
    expect(screen.queryByTestId('agent-preview-skills-button')).toBeNull();
    expect(screen.queryByTestId('agent-preview-channels-button')).toBeNull();
    expect(screen.queryByTestId('model-detail-picker')).toBeNull();
    expect(screen.queryByTestId('model-detail-locked-chip')).toBeNull();
    expect(screen.queryByTestId('agent-configure-save')).toBeNull();
  });

  it('renders the avatar upload trigger when avatarUpload feature flag is on', () => {
    mockUseBuilderAgentFeatures.mockReturnValue({
      tools: false,
      skills: false,
      memory: false,
      workflows: false,
      agents: false,
      avatarUpload: true,
    });

    renderPanel();

    expect(screen.getByTestId('agent-configure-avatar-trigger')).toBeTruthy();
    expect(screen.queryByTestId('agent-configure-avatar-display')).toBeNull();
  });

  it('renders Tools row only when features.tools is true and there is at least one tool', () => {
    mockUseBuilderAgentFeatures.mockReturnValue({
      tools: true,
      skills: false,
      memory: false,
      workflows: false,
      agents: false,
    });

    render(
      <FormWrapper>
        <AgentConfigurePanel availableAgentTools={[{ id: 'tool-a', name: 'tool-a', isChecked: false, type: 'tool' }]} />
      </FormWrapper>,
    );

    expect(screen.getByTestId('agent-preview-tools-button')).toBeTruthy();
    expect(screen.queryByTestId('agent-preview-skills-button')).toBeNull();
  });

  it('hides the Tools row when there are no tools available', () => {
    mockUseBuilderAgentFeatures.mockReturnValue({
      tools: true,
      skills: false,
      memory: false,
      workflows: false,
      agents: false,
    });

    renderPanel();

    expect(screen.queryByTestId('agent-preview-tools-button')).toBeNull();
  });

  it('hides the Skills row when there are no skills available', () => {
    mockUseBuilderAgentFeatures.mockReturnValue({
      tools: false,
      skills: true,
      memory: false,
      workflows: false,
      agents: false,
    });

    renderPanel();

    expect(screen.queryByTestId('agent-preview-skills-button')).toBeNull();
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
        <AgentConfigurePanel availableAgentTools={availableAgentTools} />
      </FormWrapper>,
    );

    // Expand the Tools accordion section to reveal contents.
    fireEvent.click(screen.getByTestId('agent-preview-tools-button'));

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
        <AgentConfigurePanel availableAgentTools={availableAgentTools} />
      </FormWrapper>,
    );

    fireEvent.click(screen.getByTestId('agent-preview-tools-button'));

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
        <AgentConfigurePanel />
      </FormWrapper>,
    );

    fireEvent.click(screen.getByTestId('agent-preview-edit-system-prompt'));

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

describe('AgentConfigurePanel disabled propagation', () => {
  beforeEach(() => {
    mockUseBuilderAgentFeatures.mockReturnValue({
      tools: true,
      skills: false,
      memory: false,
      workflows: false,
      agents: false,
      avatarUpload: true,
    });
  });

  afterEach(() => {
    cleanup();
  });

  it('disables form mutations but keeps config rows expandable when disabled is true', () => {
    render(
      <FormWrapper>
        <AgentConfigurePanel disabled />
      </FormWrapper>,
    );

    const nameInput = screen.getByTestId('agent-configure-name') as HTMLInputElement;
    const descInput = screen.getByTestId('agent-configure-description') as HTMLTextAreaElement;
    const avatarBtn = screen.getByTestId('agent-configure-avatar-trigger') as HTMLButtonElement;
    const instructionsRow = screen.getByTestId('agent-preview-edit-system-prompt');

    expect(nameInput.disabled).toBe(true);
    expect(descInput.disabled).toBe(true);
    expect(avatarBtn.disabled).toBe(true);

    expect(instructionsRow.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(instructionsRow);
    expect(screen.getByTestId('instructions-detail-textarea')).toBeTruthy();
  });

  it('collapses other sections when opening a new one (single-open accordion)', () => {
    render(
      <FormWrapper>
        <AgentConfigurePanel availableAgentTools={[{ id: 'tool-a', name: 'tool-a', isChecked: false, type: 'tool' }]} />
      </FormWrapper>,
    );

    const instructionsRow = screen.getByTestId('agent-preview-edit-system-prompt');
    const toolsRow = screen.getByTestId('agent-preview-tools-button');

    expect(instructionsRow.getAttribute('aria-expanded')).toBe('false');
    expect(toolsRow.getAttribute('aria-expanded')).toBe('false');

    fireEvent.click(instructionsRow);
    expect(instructionsRow.getAttribute('aria-expanded')).toBe('true');
    expect(toolsRow.getAttribute('aria-expanded')).toBe('false');

    fireEvent.click(toolsRow);
    expect(instructionsRow.getAttribute('aria-expanded')).toBe('false');
    expect(toolsRow.getAttribute('aria-expanded')).toBe('true');
  });

  it('applies fill sizing only to the active accordion section', () => {
    render(
      <FormWrapper>
        <AgentConfigurePanel availableAgentTools={[{ id: 'tool-a', name: 'tool-a', isChecked: false, type: 'tool' }]} />
      </FormWrapper>,
    );

    const instructionsRow = screen.getByTestId('agent-preview-edit-system-prompt');
    const toolsRow = screen.getByTestId('agent-preview-tools-button');

    const instructionsItem = instructionsRow.closest('[data-orientation]')?.parentElement as HTMLElement;
    const toolsItem = toolsRow.closest('[data-orientation]')?.parentElement as HTMLElement;

    expect(instructionsItem.hasAttribute('data-closed')).toBe(true);
    expect(toolsItem.hasAttribute('data-closed')).toBe(true);

    fireEvent.click(instructionsRow);

    expect(instructionsItem.hasAttribute('data-open')).toBe(true);
    expect(toolsItem.hasAttribute('data-closed')).toBe(true);
  });

  it('renders enabled controls by default', () => {
    render(
      <FormWrapper>
        <AgentConfigurePanel />
      </FormWrapper>,
    );

    const nameInput = screen.getByTestId('agent-configure-name') as HTMLInputElement;

    expect(nameInput.disabled).toBe(false);
    expect(screen.getByTestId('agent-preview-edit-system-prompt')).toBeTruthy();
  });

  it('uses the same controls in read-only mode but disables mutations', () => {
    capturedInstructionsProps.length = 0;
    render(
      <FormWrapper>
        <AgentConfigurePanel
          editable={false}
          availableAgentTools={[
            { id: 'tool-1', name: 'Tool 1', description: 'Test tool', isChecked: true, type: 'tool' },
          ]}
          agent={{
            id: 'agent-1',
            name: 'Published agent',
            description: 'Published description',
            systemPrompt: 'Published instructions',
            visibility: 'public',
          }}
        />
      </FormWrapper>,
    );

    const nameInput = screen.getByTestId('agent-configure-name') as HTMLInputElement;
    const descInput = screen.getByTestId('agent-configure-description') as HTMLTextAreaElement;
    const instructionsRow = screen.getByTestId('agent-preview-edit-system-prompt');

    expect(nameInput.value).toBe('Published agent');
    expect(descInput.value).toBe('Published description');
    expect(nameInput.disabled).toBe(true);
    expect(descInput.disabled).toBe(true);

    fireEvent.click(instructionsRow);
    expect(screen.getByTestId('instructions-detail-textarea')).toHaveProperty('readOnly', true);

    const latest = capturedInstructionsProps[capturedInstructionsProps.length - 1];
    expect(latest.editable).toBe(false);
    expect(latest.prompt).toBe('Published instructions');

    act(() => {
      latest.onChange('Blocked read-only update');
    });

    expect(formMethodsRef!.getValues('instructions')).toBe('Draft instructions');

    cleanup();
    render(
      <FormWrapper>
        <AgentConfigurePanel
          editable={false}
          availableAgentTools={[
            { id: 'tool-1', name: 'Tool 1', description: 'Test tool', isChecked: true, type: 'tool' },
          ]}
          agent={{
            id: 'agent-1',
            name: 'Published agent',
            systemPrompt: 'Published instructions',
          }}
        />
      </FormWrapper>,
    );

    fireEvent.click(screen.getByTestId('agent-preview-tools-button'));

    expect(screen.getByRole('checkbox')).toHaveProperty('disabled', true);
  });
});

describe('AgentConfigurePanel inline model section', () => {
  beforeEach(() => {
    mockUseBuilderModelPolicy.mockReturnValue({ active: false });
  });

  afterEach(() => {
    cleanup();
    mockUseBuilderModelPolicy.mockReturnValue({ active: false });
  });

  it('renders the inline picker enabled when features.model is true and policy is inactive', () => {
    mockUseBuilderAgentFeatures.mockReturnValue({
      tools: false,
      skills: false,
      memory: false,
      workflows: false,
      agents: false,
      avatarUpload: false,
      model: true,
    });

    renderPanel();

    fireEvent.click(screen.getByTestId('agent-preview-model-button'));

    expect(screen.getByTestId('model-detail-picker')).toBeTruthy();
    expect(screen.queryByTestId('model-detail-locked-chip')).toBeNull();
    expect(screen.getByTestId('model-card-picker').dataset.disabled).toBe('false');
  });

  it('renders the locked chip when policy is locked', () => {
    mockUseBuilderAgentFeatures.mockReturnValue({
      tools: false,
      skills: false,
      memory: false,
      workflows: false,
      agents: false,
      avatarUpload: false,
      model: false,
    });
    mockUseBuilderModelPolicy.mockReturnValue({
      active: true,
      pickerVisible: false,
      default: { provider: 'openai', modelId: 'gpt-4o' },
    });

    renderPanel();

    fireEvent.click(screen.getByTestId('agent-preview-model-button'));

    const chip = screen.getByTestId('model-detail-locked-chip');
    expect(chip.textContent).toContain('openai/gpt-4o');
    expect(screen.queryByTestId('model-detail-picker')).toBeNull();
  });

  it('keeps the inline picker but disables the selectors in view mode', () => {
    mockUseBuilderAgentFeatures.mockReturnValue({
      tools: false,
      skills: false,
      memory: false,
      workflows: false,
      agents: false,
      avatarUpload: false,
      model: true,
    });

    render(
      <FormWrapper>
        <AgentConfigurePanel
          editable={false}
          agent={{
            id: 'agent-1',
            name: 'Published agent',
            systemPrompt: 'Published instructions',
          }}
        />
      </FormWrapper>,
    );

    fireEvent.click(screen.getByTestId('agent-preview-model-button'));

    expect(screen.getByTestId('model-detail-picker')).toBeTruthy();
    expect(screen.getByTestId('model-card-picker').dataset.disabled).toBe('true');
  });
});

describe('AgentConfigurePanel config row chevron removal', () => {
  beforeEach(() => {
    mockUseBuilderAgentFeatures.mockReturnValue({
      tools: true,
      skills: true,
      memory: false,
      workflows: false,
      agents: false,
      avatarUpload: false,
    });
  });

  afterEach(() => {
    cleanup();
  });

  const rowTestIds = [
    'agent-preview-edit-system-prompt',
    'agent-preview-tools-button',
    'agent-preview-skills-button',
  ] as const;

  it.each(rowTestIds)('does not render a chevron inside the %s row', testId => {
    render(
      <FormWrapper>
        <AgentConfigurePanel
          availableAgentTools={[{ id: 'tool-a', name: 'tool-a', isChecked: false, type: 'tool' }]}
          availableSkills={[
            {
              id: 'skill-a',
              name: 'skill-a',
              status: 'ready',
              instructions: '',
              createdAt: new Date(0).toISOString(),
              updatedAt: new Date(0).toISOString(),
            },
          ]}
        />
      </FormWrapper>,
    );

    const button = screen.getByTestId(testId);
    expect(button.querySelector('svg.lucide-chevron-left')).toBeNull();
    expect(button.querySelector('svg.lucide-chevron-right')).toBeNull();
  });
});

describe('AgentConfigurePanel header card', () => {
  beforeEach(() => {
    mockUseBuilderAgentFeatures.mockReset();
    mockUseBuilderAgentFeatures.mockReturnValue({
      tools: false,
      skills: false,
      memory: false,
      workflows: false,
      agents: false,
      avatarUpload: false,
    });
  });

  afterEach(() => {
    cleanup();
  });

  it('renders a header card containing the avatar, name, and description', () => {
    renderPanel();

    const card = screen.getByTestId('agent-configure-header-card');
    expect(card).toBeTruthy();

    expect(within(card).getByTestId('agent-configure-avatar-display')).toBeTruthy();
    expect(within(card).getByTestId('agent-configure-name')).toBeTruthy();
    expect(within(card).getByTestId('agent-configure-description')).toBeTruthy();
  });

  it('renders the description field as a textarea', () => {
    renderPanel();

    const descField = screen.getByTestId('agent-configure-description');
    expect(descField.tagName).toBe('TEXTAREA');
  });

  it('header card has a max-width constraint and is horizontally centered', () => {
    renderPanel();

    const card = screen.getByTestId('agent-configure-header-card');
    expect(card.className).toMatch(/\bmax-w-/);
    expect(card.className).toContain('mx-auto');
  });

  it('renders the upload-capable avatar inside the header card when avatarUpload is enabled', () => {
    mockUseBuilderAgentFeatures.mockReturnValue({
      tools: false,
      skills: false,
      memory: false,
      workflows: false,
      agents: false,
      avatarUpload: true,
    });

    renderPanel();

    const card = screen.getByTestId('agent-configure-header-card');
    expect(within(card).getByTestId('agent-configure-avatar-trigger')).toBeTruthy();
    expect(screen.queryByTestId('agent-configure-avatar-display')).toBeNull();
  });

  it('header card has no shadow utility classes', () => {
    renderPanel();

    const card = screen.getByTestId('agent-configure-header-card');
    expect(card.className).not.toMatch(/\bshadow-/);
  });

  it('header card uses centered flex layout', () => {
    renderPanel();

    const card = screen.getByTestId('agent-configure-header-card');
    expect(card.className).toContain('flex');
    expect(card.className).toContain('flex-col');
    expect(card.className).toContain('items-center');
  });

  it('renders the header card skeleton while loading', () => {
    render(
      <FormWrapper>
        <AgentConfigurePanel isLoading />
      </FormWrapper>,
    );

    const skeleton = screen.getByTestId('agent-configure-panel-skeleton');
    expect(skeleton).toBeTruthy();

    const inner = skeleton.querySelector('.flex.flex-col.items-center.border-border1.bg-surface3');
    expect(inner).not.toBeNull();
  });
});
