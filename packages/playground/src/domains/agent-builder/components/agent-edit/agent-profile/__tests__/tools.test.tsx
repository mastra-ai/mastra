// @vitest-environment jsdom
import { cleanup, fireEvent, render } from '@testing-library/react';
import type { ReactNode } from 'react';
import { FormProvider, useForm, useWatch } from 'react-hook-form';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AgentColorProvider } from '../../../../contexts/agent-color-context';
import type { AgentBuilderEditFormValues } from '../../../../schemas';
import type { AgentTool } from '../../../../types/agent-tool';
import { Tools } from '../tools';

const FormHarness = ({
  agentName = '',
  defaultValues,
  children,
}: {
  agentName?: string;
  defaultValues?: Partial<AgentBuilderEditFormValues>;
  children: ReactNode;
}) => {
  const methods = useForm<AgentBuilderEditFormValues>({
    defaultValues: {
      name: agentName,
      tools: {},
      agents: {},
      workflows: {},
      ...defaultValues,
    } as AgentBuilderEditFormValues,
  });
  return (
    <FormProvider {...methods}>
      <AgentColorProvider>{children}</AgentColorProvider>
    </FormProvider>
  );
};

const ToolProvidersProbe = ({ onChange }: { onChange: (value: unknown) => void }) => {
  const value = useWatch<AgentBuilderEditFormValues>({ name: 'toolProviders' });
  onChange(value);
  return null;
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
    expect(container.className).toContain('focus-visible:!border-[var(--agent-color-fg)]');
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
    expect(container.style.getPropertyValue('--agent-color-fg')).toMatch(/^hsl\(/);
    expect(container.style.borderColor).toBe('');
    expect(container.className).toContain('border-border1');
    expect(container.className).toContain('focus-visible:!border-[var(--agent-color-fg)]');
    expect(container.className).not.toContain('focus-visible:ring');
  });

  describe('integration rows', () => {
    const integrationTool: AgentTool = {
      id: 'composio:GMAIL_FETCH_EMAILS',
      name: 'GMAIL_FETCH_EMAILS',
      description: 'Fetch Gmail emails',
      isChecked: true,
      type: 'integration',
      providerId: 'composio',
      toolkit: 'gmail',
    };

    it('renders the Set up connection button when checked and toolkit has no pinned connections', () => {
      const onOpen = vi.fn();
      const { getByTestId } = render(
        <FormHarness defaultValues={{ toolProviders: { composio: { tools: {}, connections: {} } } }}>
          <Tools availableAgentTools={[integrationTool]} onOpenConnections={onOpen} />
        </FormHarness>,
      );

      const setupBtn = getByTestId('tool-card-setup-composio-GMAIL_FETCH_EMAILS') as HTMLButtonElement;
      expect(setupBtn.textContent).toBe('Set up connection');
    });

    it('clicking Set up connection calls onOpenConnections and does not toggle the row', () => {
      const onOpen = vi.fn();
      const formStates: unknown[] = [];

      const { getByTestId } = render(
        <FormHarness defaultValues={{ toolProviders: { composio: { tools: {}, connections: {} } } }}>
          <ToolProvidersProbe onChange={v => formStates.push(v)} />
          <Tools availableAgentTools={[integrationTool]} onOpenConnections={onOpen} />
        </FormHarness>,
      );

      const before = formStates.length;
      fireEvent.click(getByTestId('tool-card-setup-composio-GMAIL_FETCH_EMAILS'));

      expect(onOpen).toHaveBeenCalledTimes(1);
      // No form mutation occurred, so the watch probe did not re-emit.
      expect(formStates.length).toBe(before);
    });

    it('hides the Set up button when the toolkit already has a pinned connection', () => {
      const { queryByTestId } = render(
        <FormHarness
          defaultValues={{
            toolProviders: {
              composio: {
                tools: {},
                connections: {
                  gmail: [
                    {
                      connectionId: 'ca_1',
                      toolkit: 'gmail',
                      kind: 'author',
                      scope: 'per-author',
                      label: 'work',
                    },
                  ],
                },
              },
            },
          }}
        >
          <Tools availableAgentTools={[integrationTool]} onOpenConnections={vi.fn()} />
        </FormHarness>,
      );

      expect(queryByTestId('tool-card-setup-composio-GMAIL_FETCH_EMAILS')).toBeNull();
    });

    it('toggling an integration row writes only to toolProviders, never to the native tools allowlist', () => {
      const formStates: AgentBuilderEditFormValues['toolProviders'][] = [];
      const onChange = (v: unknown) => formStates.push(v as AgentBuilderEditFormValues['toolProviders']);

      const uncheckedItem: AgentTool = { ...integrationTool, isChecked: false };
      const { getByTestId } = render(
        <FormHarness defaultValues={{ toolProviders: {} }}>
          <ToolProvidersProbe onChange={onChange} />
          <Tools availableAgentTools={[uncheckedItem]} onOpenConnections={vi.fn()} />
        </FormHarness>,
      );

      fireEvent.click(getByTestId('tool-card-integration-composio:GMAIL_FETCH_EMAILS'));

      const last = formStates[formStates.length - 1];
      expect(last?.composio?.tools?.GMAIL_FETCH_EMAILS).toEqual({
        toolkit: 'gmail',
        description: 'Fetch Gmail emails',
      });
    });
  });
});
