// @vitest-environment jsdom
import { TooltipProvider } from '@mastra/playground-ui';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { FormProvider, useForm } from 'react-hook-form';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { AgentBuilderEditFormValues } from '../../../schemas';
import type { AgentTool } from '../../../types/agent-tool';

import { ToolsDetail } from './tools-detail';
import type { ToolIntegrationServiceGroup } from './tools-detail';
import type { PickerConnection } from '@/domains/tool-integrations/components/connection-picker';

// ConnectionPicker triggers useAuthorize on Connect / Reauthorize; stub the
// hook so tests don't need to drive the popup loop.
vi.mock('@/domains/tool-integrations/hooks/use-authorize', () => ({
  useAuthorize: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

// ConnectionPicker also queries existing provider connections; stub to avoid
// requiring a QueryClientProvider in this unit harness.
vi.mock('@/domains/tool-integrations/hooks/use-existing-connections', () => ({
  useExistingConnections: () => ({ data: { items: [] }, isLoading: false }),
}));

interface HarnessProps {
  availableAgentTools?: AgentTool[];
  toolIntegrationServices?: ToolIntegrationServiceGroup[];
  onConnectionsChange?: (integrationId: string, toolService: string, next: PickerConnection[]) => void;
  onConnectionsInvalid?: (invalid: boolean) => void;
  onClose?: () => void;
  defaultValues?: Partial<AgentBuilderEditFormValues>;
}

const Harness = ({
  availableAgentTools,
  toolIntegrationServices,
  onConnectionsChange,
  onConnectionsInvalid,
  onClose,
  defaultValues,
}: HarnessProps) => {
  const methods = useForm<AgentBuilderEditFormValues>({
    defaultValues: {
      name: '',
      instructions: '',
      tools: {},
      agents: {},
      workflows: {},
      ...defaultValues,
    },
  });
  return (
    <TooltipProvider>
      <FormProvider {...methods}>
        <ToolsDetail
          onClose={onClose ?? (() => {})}
          availableAgentTools={availableAgentTools}
          toolIntegrationServices={toolIntegrationServices}
          onConnectionsChange={onConnectionsChange}
          onConnectionsInvalid={onConnectionsInvalid}
        />
      </FormProvider>
    </TooltipProvider>
  );
};

const renderPanel = (props: HarnessProps = {}) => render(<Harness {...props} />);

describe('ToolsDetail', () => {
  afterEach(() => {
    cleanup();
  });

  it('shows the empty state when nothing is available', () => {
    renderPanel();
    expect(screen.getByText(/no tools available/i)).toBeTruthy();
  });

  it('renders an integration service block with a picker per service', () => {
    renderPanel({
      toolIntegrationServices: [
        {
          integrationId: 'composio',
          integrationDisplayName: 'Composio',
          toolService: 'gmail',
          toolServiceDisplayName: 'Gmail',
          multipleAllowed: true,
          hasSelectedTools: true,
          connections: [{ connectionId: 'c1', toolService: 'gmail', label: 'Work' }],
        },
        {
          integrationId: 'composio',
          integrationDisplayName: 'Composio',
          toolService: 'github',
          toolServiceDisplayName: 'GitHub',
          multipleAllowed: false,
          hasSelectedTools: false,
          connections: [],
        },
      ],
    });

    expect(screen.getByTestId('tools-detail-service-composio-gmail')).toBeTruthy();
    expect(screen.getByTestId('tools-detail-service-composio-github')).toBeTruthy();
    expect(screen.getByTestId('connection-picker-gmail')).toBeTruthy();
    expect(screen.getByTestId('connection-picker-github')).toBeTruthy();
  });

  it('renders the empty connection state for a service with selected tools but no connection', () => {
    renderPanel({
      toolIntegrationServices: [
        {
          integrationId: 'composio',
          integrationDisplayName: 'Composio',
          toolService: 'gmail',
          toolServiceDisplayName: 'Gmail',
          multipleAllowed: true,
          hasSelectedTools: true,
          connections: [],
        },
      ],
    });

    expect(screen.getByTestId('connection-picker-gmail-empty')).toBeTruthy();
    expect(screen.getByText(/no connections yet/i)).toBeTruthy();
  });

  it('forwards picker edits through onConnectionsChange', () => {
    const onConnectionsChange = vi.fn();
    renderPanel({
      toolIntegrationServices: [
        {
          integrationId: 'composio',
          integrationDisplayName: 'Composio',
          toolService: 'gmail',
          toolServiceDisplayName: 'Gmail',
          multipleAllowed: true,
          hasSelectedTools: true,
          connections: [{ connectionId: 'c1', toolService: 'gmail', label: 'Work' }],
        },
      ],
      onConnectionsChange,
    });

    fireEvent.click(screen.getByTestId('connection-remove-gmail-0'));

    expect(onConnectionsChange).toHaveBeenCalledWith('composio', 'gmail', []);
  });

  it('fires onConnectionsInvalid(true) when a selected service has zero connections', () => {
    const onConnectionsInvalid = vi.fn();
    renderPanel({
      toolIntegrationServices: [
        {
          integrationId: 'composio',
          integrationDisplayName: 'Composio',
          toolService: 'gmail',
          toolServiceDisplayName: 'Gmail',
          multipleAllowed: true,
          hasSelectedTools: true,
          connections: [],
        },
      ],
      onConnectionsInvalid,
    });

    expect(onConnectionsInvalid).toHaveBeenCalledWith(true);
  });

  it('fires onConnectionsInvalid(false) when every selected service has at least one connection', () => {
    const onConnectionsInvalid = vi.fn();
    renderPanel({
      toolIntegrationServices: [
        {
          integrationId: 'composio',
          integrationDisplayName: 'Composio',
          toolService: 'gmail',
          toolServiceDisplayName: 'Gmail',
          multipleAllowed: true,
          hasSelectedTools: true,
          connections: [{ connectionId: 'c1', toolService: 'gmail', label: 'Work' }],
        },
      ],
      onConnectionsInvalid,
    });

    expect(onConnectionsInvalid).toHaveBeenCalledWith(false);
  });

  it('does not fire onConnectionsInvalid when no service has selected tools', () => {
    const onConnectionsInvalid = vi.fn();
    renderPanel({
      toolIntegrationServices: [
        {
          integrationId: 'composio',
          integrationDisplayName: 'Composio',
          toolService: 'gmail',
          toolServiceDisplayName: 'Gmail',
          multipleAllowed: true,
          hasSelectedTools: false,
          connections: [],
        },
      ],
      onConnectionsInvalid,
    });

    expect(onConnectionsInvalid).toHaveBeenCalledWith(false);
  });

  it('renders the active / total count when legacy agent tools are present', () => {
    renderPanel({
      availableAgentTools: [
        { id: 't1', name: 'Tool one', isChecked: true, type: 'tool' },
        { id: 't2', name: 'Tool two', isChecked: false, type: 'tool' },
      ],
    });

    expect(screen.getByText('1 / 2')).toBeTruthy();
  });

  it('invokes onClose when the close button is clicked', async () => {
    const onClose = vi.fn();
    renderPanel({ onClose, availableAgentTools: [{ id: 't', name: 't', isChecked: false, type: 'tool' }] });
    await act(async () => {
      fireEvent.click(screen.getByTestId('tools-detail-close'));
    });
    expect(onClose).toHaveBeenCalled();
  });
});
