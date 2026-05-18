// @vitest-environment jsdom
import { TooltipProvider } from '@mastra/playground-ui';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ConnectionsDetail } from './connections-detail';
import type { ToolIntegrationServiceGroup } from './tools-detail';

vi.mock('@/domains/tool-integrations/hooks/use-authorize', () => ({
  useAuthorize: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

vi.mock('@/domains/tool-integrations/hooks/use-existing-connections', () => ({
  useExistingConnections: () => ({ data: { items: [] }, isLoading: false }),
}));

vi.mock('@/domains/tool-integrations/hooks/use-connection-fields', () => ({
  useConnectionFields: () => ({ data: { fields: [] }, isLoading: false }),
}));

const renderPanel = (services: ToolIntegrationServiceGroup[] = [], onConnectionsChange = vi.fn()) =>
  render(
    <TooltipProvider>
      <ConnectionsDetail
        onClose={() => {}}
        toolIntegrationServices={services}
        onConnectionsChange={onConnectionsChange}
      />
    </TooltipProvider>,
  );

describe('ConnectionsDetail', () => {
  afterEach(() => {
    cleanup();
  });

  it('shows the empty state when no services are present', () => {
    renderPanel();
    expect(screen.getByText(/no integration tools selected/i)).toBeTruthy();
  });

  it('renders one row per selected service with its picker', () => {
    renderPanel([
      {
        integrationId: 'composio',
        integrationDisplayName: 'Composio',
        toolService: 'gmail',
        toolServiceDisplayName: 'Gmail',
        multipleAllowed: true,
        hasSelectedTools: true,
        supportsRevoke: true,
        connections: [{ connectionId: 'c1', toolService: 'gmail', label: 'Work' }],
      },
    ]);

    expect(screen.getByTestId('connections-detail-service-composio-gmail')).toBeTruthy();
    expect(screen.getByTestId('connection-picker-gmail')).toBeTruthy();
  });

  it('shows a "Connect required" hint when a selected service has no connections', () => {
    renderPanel([
      {
        integrationId: 'composio',
        integrationDisplayName: 'Composio',
        toolService: 'gmail',
        toolServiceDisplayName: 'Gmail',
        multipleAllowed: true,
        hasSelectedTools: true,
        supportsRevoke: true,
        connections: [],
      },
    ]);

    expect(screen.getByTestId('connections-detail-needs-composio-gmail')).toBeTruthy();
  });

  it('forwards picker edits through onConnectionsChange', () => {
    const onConnectionsChange = vi.fn();
    renderPanel(
      [
        {
          integrationId: 'composio',
          integrationDisplayName: 'Composio',
          toolService: 'gmail',
          toolServiceDisplayName: 'Gmail',
          multipleAllowed: true,
          hasSelectedTools: true,
          supportsRevoke: true,
          connections: [{ connectionId: 'c1', toolService: 'gmail', label: 'Work' }],
        },
      ],
      onConnectionsChange,
    );

    fireEvent.click(screen.getByTestId('connection-remove-gmail-0'));
    expect(onConnectionsChange).toHaveBeenCalledWith('composio', 'gmail', []);
  });
});
