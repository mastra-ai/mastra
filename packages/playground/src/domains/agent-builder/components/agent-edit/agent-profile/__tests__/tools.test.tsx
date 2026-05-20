// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import type { ReactNode } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { afterEach, describe, expect, it } from 'vitest';
import { AgentColorProvider } from '../../../../contexts/agent-color-context';
import type { AgentBuilderEditFormValues } from '../../../../schemas';
import type { AgentTool } from '../../../../types/agent-tool';
import { Tools } from '../tools';

const FormHarness = ({ agentName = '', children }: { agentName?: string; children: ReactNode }) => {
  const methods = useForm<AgentBuilderEditFormValues>({
    defaultValues: {
      name: agentName,
      tools: {},
      agents: {},
      workflows: {},
    } as AgentBuilderEditFormValues,
  });
  return (
    <FormProvider {...methods}>
      <AgentColorProvider>{children}</AgentColorProvider>
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

  it('paints the selected tool container and check cell with border-based HSL when a name is set', () => {
    const { getByTestId } = render(
      <FormHarness agentName="Support agent">
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

  it('falls back to accent classes for selected tiles when no agent name is set', () => {
    const { getByTestId } = render(
      <FormHarness>
        <Tools availableAgentTools={availableTools} />
      </FormHarness>,
    );

    const container = getByTestId('tool-card-tool-checked-tool') as HTMLButtonElement;
    const check = getByTestId('tool-card-check-tool-checked-tool') as HTMLSpanElement;

    expect(container.getAttribute('style')).toBeNull();
    expect(container.className).toContain('border-accent1');
    expect(container.className).toContain('ring-accent1');

    expect(check.getAttribute('style')).toBeNull();
    expect(check.className).toContain('border-accent1');
    expect(check.className).toContain('bg-accent1');
  });

  it('leaves unselected tile borders untouched while using agent color for focus when a name is set', () => {
    const { getByTestId } = render(
      <FormHarness agentName="Support agent">
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
});
