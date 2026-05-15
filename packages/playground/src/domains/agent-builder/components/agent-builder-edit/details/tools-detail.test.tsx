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

  it('renders an inline picker under each checked integration tool row', () => {
    renderPanel({
      availableAgentTools: [
        {
          id: 'integration:composio:GMAIL_FETCH_EMAILS',
          name: 'GMAIL_FETCH_EMAILS',
          isChecked: true,
          type: 'integration',
          providerId: 'composio',
          toolService: 'gmail',
        },
        {
          id: 'integration:composio:GITHUB_CREATE_ISSUE',
          name: 'GITHUB_CREATE_ISSUE',
          isChecked: true,
          type: 'integration',
          providerId: 'composio',
          toolService: 'github',
        },
      ],
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
          hasSelectedTools: true,
          connections: [],
        },
      ],
    });

    expect(screen.getByTestId('tools-detail-service-composio-gmail')).toBeTruthy();
    expect(screen.getByTestId('tools-detail-service-composio-github')).toBeTruthy();
    expect(screen.getByTestId('connection-picker-gmail')).toBeTruthy();
    expect(screen.getByTestId('connection-picker-github-empty')).toBeTruthy();
  });

  it('does not render an inline picker when the integration tool is unchecked', () => {
    renderPanel({
      availableAgentTools: [
        {
          id: 'integration:composio:GMAIL_FETCH_EMAILS',
          name: 'GMAIL_FETCH_EMAILS',
          isChecked: false,
          type: 'integration',
          providerId: 'composio',
          toolService: 'gmail',
        },
      ],
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
    });

    expect(screen.queryByTestId('tools-detail-service-composio-gmail')).toBeNull();
  });

  it('renders the inline picker only once even when multiple tools share a service', () => {
    renderPanel({
      availableAgentTools: [
        {
          id: 'integration:composio:GMAIL_FETCH_EMAILS',
          name: 'GMAIL_FETCH_EMAILS',
          isChecked: true,
          type: 'integration',
          providerId: 'composio',
          toolService: 'gmail',
        },
        {
          id: 'integration:composio:GMAIL_SEND_EMAIL',
          name: 'GMAIL_SEND_EMAIL',
          isChecked: true,
          type: 'integration',
          providerId: 'composio',
          toolService: 'gmail',
        },
      ],
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
    });

    expect(screen.getAllByTestId('tools-detail-service-composio-gmail').length).toBe(1);
  });

  it('forwards picker edits through onConnectionsChange', () => {
    const onConnectionsChange = vi.fn();
    renderPanel({
      availableAgentTools: [
        {
          id: 'integration:composio:GMAIL_FETCH_EMAILS',
          name: 'GMAIL_FETCH_EMAILS',
          isChecked: true,
          type: 'integration',
          providerId: 'composio',
          toolService: 'gmail',
        },
      ],
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

  it('renders all available tools with their checked state and shows active/total in the header', () => {
    renderPanel({
      availableAgentTools: [
        { id: 't1', name: 'Tool one', isChecked: true, type: 'tool' },
        { id: 't2', name: 'Tool two', isChecked: false, type: 'tool' },
      ],
    });

    expect(screen.getByText('Tool one')).toBeTruthy();
    expect(screen.getByText('Tool two')).toBeTruthy();
    expect(screen.getByText('1 / 2')).toBeTruthy();
  });

  it('shows the empty connection prompt inline when an integration tool is checked but its service has no connection', () => {
    renderPanel({
      availableAgentTools: [
        {
          id: 'integration:composio:GMAIL_FETCH_EMAILS',
          name: 'GMAIL_FETCH_EMAILS',
          isChecked: true,
          type: 'integration',
          providerId: 'composio',
          toolService: 'gmail',
        },
      ],
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

  it('invokes onClose when the close button is clicked', async () => {
    const onClose = vi.fn();
    renderPanel({ onClose, availableAgentTools: [{ id: 't', name: 't', isChecked: false, type: 'tool' }] });
    await act(async () => {
      fireEvent.click(screen.getByTestId('tools-detail-close'));
    });
    expect(onClose).toHaveBeenCalled();
  });
});
