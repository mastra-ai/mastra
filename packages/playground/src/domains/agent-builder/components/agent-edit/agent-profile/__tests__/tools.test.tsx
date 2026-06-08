// @vitest-environment jsdom
import { cleanup, fireEvent, render } from '@testing-library/react';
import type { ReactNode } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { afterEach, describe, expect, it } from 'vitest';
import { AgentColorProvider } from '../../../../contexts/agent-color-context';
import type { AgentBuilderEditFormValues } from '../../../../schemas';
import type { AgentTool } from '../../../../types/agent-tool';
import { Tools } from '../tools';

const FormHarness = ({ agentId = 'agent_test', children }: { agentId?: string; children: ReactNode }) => {
  const methods = useForm<AgentBuilderEditFormValues>({
    defaultValues: {
      tools: {},
      agents: {},
      workflows: {},
    } as AgentBuilderEditFormValues,
  });
  return (
    <FormProvider {...methods}>
      <AgentColorProvider agentId={agentId}>{children}</AgentColorProvider>
    </FormProvider>
  );
};

const availableTools: AgentTool[] = [
  { id: 'checked-tool', name: 'checked-tool', isChecked: true, type: 'tool' },
  { id: 'unchecked-tool', name: 'unchecked-tool', isChecked: false, type: 'tool' },
];

describe('Tools', () => {
  afterEach(() => {
    cleanup();
  });

  it('paints the selected tool container and check cell with border-based HSL when an agentId is provided', () => {
    const { getByTestId } = render(
      <FormHarness>
        <Tools availableAgentTools={availableTools} />
      </FormHarness>,
    );

    const container = getByTestId('tool-card-tool-checked-tool') as HTMLButtonElement;
    const check = getByTestId('tool-card-check-tool-checked-tool') as HTMLSpanElement;

    // jsdom normalizes inline color values from hsl() to rgb() for color properties.
    expect(container.style.borderColor).toMatch(/^(rgb|hsl)\(/);
    expect(container.style.boxShadow).toBe('');
    expect(container.className).toContain('focus-visible:!border-[var(--agent-color-bg)]');
    expect(container.className).not.toContain('border-accent1');
    expect(container.className).not.toContain('ring-1 ring-accent1');
    expect(container.className).not.toContain('focus-visible:ring');

    expect(check.style.backgroundColor).toMatch(/^(rgb|hsl)\(/);
    expect(check.style.borderColor).toMatch(/^(rgb|hsl)\(/);
    expect(check.className).not.toContain('bg-accent1');
  });

  it('leaves unselected tile borders untouched while using agent color for focus when an agentId is provided', () => {
    const { getByTestId } = render(
      <FormHarness>
        <Tools availableAgentTools={availableTools} />
      </FormHarness>,
    );

    const container = getByTestId('tool-card-tool-unchecked-tool') as HTMLButtonElement;
    expect(container.style.getPropertyValue('--agent-color-bg')).toMatch(/^hsl\(/);
    expect(container.style.borderColor).toBe('');
    expect(container.className).toContain('border-border1');
    expect(container.className).toContain('focus-visible:!border-[var(--agent-color-bg)]');
    expect(container.className).not.toContain('focus-visible:ring');
  });

  it('renders the "Show only selected" filter checkbox unchecked by default with both tool cards visible', () => {
    const { getByTestId } = render(
      <FormHarness>
        <Tools availableAgentTools={availableTools} />
      </FormHarness>,
    );

    const checkbox = getByTestId('tools-only-selected-filter-checkbox');
    expect(checkbox.getAttribute('aria-checked')).toBe('false');
    expect(getByTestId('tool-card-tool-checked-tool')).toBeTruthy();
    expect(getByTestId('tool-card-tool-unchecked-tool')).toBeTruthy();
  });

  it('checking the filter hides unselected tools and keeps selected ones', () => {
    const { getByTestId, queryByTestId } = render(
      <FormHarness>
        <Tools availableAgentTools={availableTools} />
      </FormHarness>,
    );

    fireEvent.click(getByTestId('tools-only-selected-filter-checkbox'));

    expect(queryByTestId('tool-card-tool-checked-tool')).toBeTruthy();
    expect(queryByTestId('tool-card-tool-unchecked-tool')).toBeNull();
  });

  it('unchecking the filter restores hidden tools', () => {
    const { getByTestId, queryByTestId } = render(
      <FormHarness>
        <Tools availableAgentTools={availableTools} />
      </FormHarness>,
    );

    const checkbox = getByTestId('tools-only-selected-filter-checkbox');
    fireEvent.click(checkbox);
    expect(queryByTestId('tool-card-tool-unchecked-tool')).toBeNull();

    fireEvent.click(checkbox);
    expect(queryByTestId('tool-card-tool-checked-tool')).toBeTruthy();
    expect(queryByTestId('tool-card-tool-unchecked-tool')).toBeTruthy();
  });

  it('shows the empty-state copy when the filter is on and nothing is selected', () => {
    const noneSelected = [
      { id: 'a', name: 'a', isChecked: false, type: 'tool' as const },
      { id: 'b', name: 'b', isChecked: false, type: 'tool' as const },
    ];
    const { getByTestId, getByText } = render(
      <FormHarness>
        <Tools availableAgentTools={noneSelected} />
      </FormHarness>,
    );

    fireEvent.click(getByTestId('tools-only-selected-filter-checkbox'));

    expect(getByText('No tools selected yet')).toBeTruthy();
  });

  it('combines the filter with search to show the dedicated empty-state copy', async () => {
    const { getByTestId, findByText } = render(
      <FormHarness>
        <Tools availableAgentTools={availableTools} />
      </FormHarness>,
    );

    const searchInput = getByTestId('tools-card-picker-search').querySelector('input');
    expect(searchInput).toBeTruthy();
    fireEvent.change(searchInput!, { target: { value: 'unchecked' } });

    fireEvent.click(getByTestId('tools-only-selected-filter-checkbox'));

    await findByText('No selected tools match "unchecked"');
  });

  it('uses the small-size classes matching the provider-filter checkbox in models.tsx', () => {
    const { getByTestId } = render(
      <FormHarness>
        <Tools availableAgentTools={availableTools} />
      </FormHarness>,
    );

    const checkbox = getByTestId('tools-only-selected-filter-checkbox');
    expect(checkbox.className).toContain('h-3');
    expect(checkbox.className).toContain('w-3');
    expect(checkbox.className).toContain('[&_svg]:h-2.5');
  });

  it('paints the filter checkbox with the agent color only when the filter is checked', () => {
    const { getByTestId } = render(
      <FormHarness>
        <Tools availableAgentTools={availableTools} />
      </FormHarness>,
    );

    const checkbox = getByTestId('tools-only-selected-filter-checkbox') as HTMLButtonElement;
    expect(checkbox.getAttribute('style')).toBeNull();

    fireEvent.click(checkbox);

    expect(checkbox.style.backgroundColor).toMatch(/^(rgb|hsl)\(/);
    expect(checkbox.style.borderColor).toMatch(/^(rgb|hsl)\(/);
  });

  it('renders the search input and the filter checkbox in the same flex row', () => {
    const { getByTestId } = render(
      <FormHarness>
        <Tools availableAgentTools={availableTools} />
      </FormHarness>,
    );

    const searchWrapper = getByTestId('tools-card-picker-search');
    const filterLabel = getByTestId('tools-only-selected-filter');

    expect(searchWrapper.parentElement).toBe(filterLabel.parentElement);
    expect(filterLabel.parentElement?.className).toContain('flex');
    expect(filterLabel.parentElement?.className).toContain('justify-between');
  });
});
