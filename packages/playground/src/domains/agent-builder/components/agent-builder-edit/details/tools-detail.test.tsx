// @vitest-environment jsdom
import { TooltipProvider } from '@mastra/playground-ui';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { FormProvider, useForm } from 'react-hook-form';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { AgentBuilderEditFormValues } from '../../../schemas';
import type { AgentTool } from '../../../types/agent-tool';

import { ToolsDetail } from './tools-detail';
import type { ToolIntegrationServiceGroup } from './tools-detail';

interface HarnessProps {
  availableAgentTools?: AgentTool[];
  toolIntegrationServices?: ToolIntegrationServiceGroup[];
  onConnectionsInvalid?: (invalid: boolean) => void;
  onOpenConnections?: () => void;
  onClose?: () => void;
  defaultValues?: Partial<AgentBuilderEditFormValues>;
}

const Harness = ({
  availableAgentTools,
  toolIntegrationServices,
  onConnectionsInvalid,
  onOpenConnections,
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
          onConnectionsInvalid={onConnectionsInvalid}
          onOpenConnections={onOpenConnections}
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

  it('shows a "Set up connection" affordance on a checked integration tool with no connection', () => {
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

    expect(screen.getByTestId('tools-detail-setup-integration:composio:GMAIL_FETCH_EMAILS')).toBeTruthy();
  });

  it('does not show "Set up" when the integration tool has an active connection', () => {
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
    });

    expect(screen.queryByTestId('tools-detail-setup-integration:composio:GMAIL_FETCH_EMAILS')).toBeNull();
  });

  it('does not show "Set up" when the integration tool is unchecked', () => {
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

    expect(screen.queryByTestId('tools-detail-setup-integration:composio:GMAIL_FETCH_EMAILS')).toBeNull();
  });

  it('invokes onOpenConnections when the "Set up" affordance is clicked', () => {
    const onOpenConnections = vi.fn();
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
      onOpenConnections,
    });

    fireEvent.click(screen.getByTestId('tools-detail-setup-integration:composio:GMAIL_FETCH_EMAILS'));
    expect(onOpenConnections).toHaveBeenCalledTimes(1);
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

  it('invokes onClose when the close button is clicked', async () => {
    const onClose = vi.fn();
    renderPanel({ onClose, availableAgentTools: [{ id: 't', name: 't', isChecked: false, type: 'tool' }] });
    await act(async () => {
      fireEvent.click(screen.getByTestId('tools-detail-close'));
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
