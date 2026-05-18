// @vitest-environment jsdom
import { TooltipProvider } from '@mastra/playground-ui';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { UseFormReturn } from 'react-hook-form';
import { FormProvider, useForm } from 'react-hook-form';
import { afterEach, describe, expect, it } from 'vitest';
import type { AgentBuilderEditFormValues } from '../../../../schemas';
import type { AgentTool } from '../../../../types/agent-tool';
import { ToolsDetail } from '../tools-detail';

let formMethodsRef: UseFormReturn<AgentBuilderEditFormValues> | null = null;

const FormWrapper = ({ children }: { children: React.ReactNode }) => {
  const methods = useForm<AgentBuilderEditFormValues>({
    defaultValues: {
      name: '',
      instructions: '',
      tools: {},
      agents: {},
      workflows: {},
      skills: {},
    },
  });
  formMethodsRef = methods;
  return (
    <TooltipProvider>
      <FormProvider {...methods}>{children}</FormProvider>
    </TooltipProvider>
  );
};

const renderTools = (availableAgentTools: AgentTool[]) =>
  render(
    <FormWrapper>
      <ToolsDetail availableAgentTools={availableAgentTools} />
    </FormWrapper>,
  );

describe('ToolsDetail toggle routing', () => {
  afterEach(() => {
    cleanup();
    formMethodsRef = null;
  });

  it('routes a tool toggle to form.tools', () => {
    renderTools([{ id: 'tool-a', name: 'Tool A', isChecked: false, type: 'tool' }]);
    fireEvent.click(screen.getByLabelText(/Tool A/i));
    expect(formMethodsRef!.getValues('tools')).toEqual({ 'tool-a': true });
    expect(formMethodsRef!.getValues('agents')).toEqual({});
    expect(formMethodsRef!.getValues('workflows')).toEqual({});
  });

  it('routes an agent toggle to form.agents', () => {
    renderTools([{ id: 'agent-x', name: 'Agent X', isChecked: false, type: 'agent' }]);
    fireEvent.click(screen.getByLabelText(/Agent X/i));
    expect(formMethodsRef!.getValues('agents')).toEqual({ 'agent-x': true });
    expect(formMethodsRef!.getValues('tools')).toEqual({});
    expect(formMethodsRef!.getValues('workflows')).toEqual({});
  });

  it('routes a workflow toggle to form.workflows', () => {
    renderTools([{ id: 'wf-1', name: 'Workflow One', isChecked: false, type: 'workflow' }]);
    fireEvent.click(screen.getByLabelText(/Workflow One/i));
    expect(formMethodsRef!.getValues('workflows')).toEqual({ 'wf-1': true });
    expect(formMethodsRef!.getValues('tools')).toEqual({});
    expect(formMethodsRef!.getValues('agents')).toEqual({});
  });
});

describe('ToolsDetail card UI', () => {
  afterEach(() => {
    cleanup();
    formMethodsRef = null;
  });

  it('renders the card grid and searchbar containers', () => {
    renderTools([{ id: 'tool-a', name: 'Tool A', isChecked: false, type: 'tool' }]);
    expect(screen.getByTestId('tools-card-picker')).toBeTruthy();
    expect(screen.getByTestId('tools-card-picker-search')).toBeTruthy();
  });

  it('renders one card per tool with type-prefixed test ids', () => {
    renderTools([
      { id: 'tool-a', name: 'Tool A', isChecked: false, type: 'tool' },
      { id: 'agent-x', name: 'Agent X', isChecked: false, type: 'agent' },
      { id: 'wf-1', name: 'Workflow One', isChecked: false, type: 'workflow' },
    ]);
    expect(screen.getByTestId('tool-card-tool-tool-a')).toBeTruthy();
    expect(screen.getByTestId('tool-card-agent-agent-x')).toBeTruthy();
    expect(screen.getByTestId('tool-card-workflow-wf-1')).toBeTruthy();
  });

  it('renders the description when present and omits it otherwise', () => {
    renderTools([
      { id: 'tool-a', name: 'Tool A', description: 'Does A things', isChecked: false, type: 'tool' },
      { id: 'tool-b', name: 'Tool B', isChecked: false, type: 'tool' },
    ]);
    expect(screen.getByText('Does A things')).toBeTruthy();
    const cardB = screen.getByTestId('tool-card-tool-tool-b');
    expect(cardB.textContent).toContain('Tool B');
    expect(cardB.textContent).not.toContain('Does A things');
  });

  it('reflects isChecked via aria-pressed and renders the check indicator only when selected', () => {
    renderTools([
      { id: 'tool-a', name: 'Tool A', isChecked: true, type: 'tool' },
      { id: 'tool-b', name: 'Tool B', isChecked: false, type: 'tool' },
    ]);
    const cardA = screen.getByTestId('tool-card-tool-tool-a');
    const cardB = screen.getByTestId('tool-card-tool-tool-b');
    expect(cardA.getAttribute('aria-pressed')).toBe('true');
    expect(cardB.getAttribute('aria-pressed')).toBe('false');
    expect(screen.getByTestId('tool-card-check-tool-tool-a').querySelector('svg')).toBeTruthy();
    expect(screen.getByTestId('tool-card-check-tool-tool-b').querySelector('svg')).toBeFalsy();
  });

  it('toggles the form value when a card is clicked', () => {
    renderTools([{ id: 'tool-a', name: 'Tool A', isChecked: false, type: 'tool' }]);
    fireEvent.click(screen.getByTestId('tool-card-tool-tool-a'));
    expect(formMethodsRef!.getValues('tools')).toEqual({ 'tool-a': true });
  });

  it('filters cards by name and shows a no-match message', async () => {
    renderTools([
      { id: 'tool-a', name: 'Alpha', isChecked: false, type: 'tool' },
      { id: 'tool-b', name: 'Bravo', isChecked: false, type: 'tool' },
      { id: 'tool-c', name: 'Charlie', isChecked: false, type: 'tool' },
    ]);

    const input = screen.getByPlaceholderText('Search tools...');
    fireEvent.change(input, { target: { value: 'bra' } });
    await waitFor(() => {
      expect(screen.queryByTestId('tool-card-tool-tool-a')).toBeNull();
    });
    expect(screen.getByTestId('tool-card-tool-tool-b')).toBeTruthy();
    expect(screen.queryByTestId('tool-card-tool-tool-c')).toBeNull();

    fireEvent.change(input, { target: { value: 'zzzzz' } });
    await waitFor(() => {
      expect(screen.queryByTestId('tool-card-tool-tool-b')).toBeNull();
    });
    expect(screen.queryByTestId('tool-card-tool-tool-a')).toBeNull();
    expect(screen.queryByTestId('tool-card-tool-tool-c')).toBeNull();
    expect(screen.getByText('No tools match "zzzzz"')).toBeTruthy();
  });

  it('also filters by description text', async () => {
    renderTools([
      { id: 'tool-a', name: 'Alpha', description: 'Reads files', isChecked: false, type: 'tool' },
      { id: 'tool-b', name: 'Bravo', description: 'Writes data', isChecked: false, type: 'tool' },
    ]);
    const input = screen.getByPlaceholderText('Search tools...');
    fireEvent.change(input, { target: { value: 'files' } });
    await waitFor(() => {
      expect(screen.queryByTestId('tool-card-tool-tool-b')).toBeNull();
    });
    expect(screen.getByTestId('tool-card-tool-tool-a')).toBeTruthy();
  });

  it('disables every card when editable is false', () => {
    render(
      <FormWrapper>
        <ToolsDetail
          editable={false}
          availableAgentTools={[
            { id: 'tool-a', name: 'Tool A', isChecked: false, type: 'tool' },
            { id: 'tool-b', name: 'Tool B', isChecked: true, type: 'tool' },
          ]}
        />
      </FormWrapper>,
    );
    const cardA = screen.getByTestId('tool-card-tool-tool-a') as HTMLButtonElement;
    const cardB = screen.getByTestId('tool-card-tool-tool-b') as HTMLButtonElement;
    expect(cardA.disabled).toBe(true);
    expect(cardB.disabled).toBe(true);
    expect(cardA.className).toContain('opacity-60');
  });

  it('shows the empty-project message when there are no tools at all', () => {
    renderTools([]);
    expect(screen.getByText('No tools available in this project.')).toBeTruthy();
    expect(screen.queryByTestId('tools-card-picker')).toBeNull();
  });
});
