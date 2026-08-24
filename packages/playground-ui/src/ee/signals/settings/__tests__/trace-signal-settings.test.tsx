// @vitest-environment jsdom

import type {
  CreateTraceSignalDefinitionInput,
  TraceSignalDefinition,
  TraceSignalManagementListResponse,
  UpdateTraceSignalDefinitionInput,
} from '@mastra/client-js';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import type { TraceSignalManagement } from '../../trace-intelligence-context';
import { TraceIntelligenceProvider } from '../../trace-intelligence-provider';
import { TraceSignalSettingsButton, TraceSignalSettingsPanel } from '../trace-signal-settings';

const activeDefinition: TraceSignalDefinition = {
  id: '11111111-1111-4111-8111-111111111111',
  name: 'handoff_quality',
  displayLabel: 'Handoff Quality',
  description: 'Whether the agent handed work off clearly.',
  taskPrompt: 'Describe the quality of any handoff in one sentence.',
  version: 1,
  status: 'active',
  enabled: false,
  createdAt: '2026-08-18T12:00:00.000Z',
  updatedAt: '2026-08-18T12:00:00.000Z',
};
const archivedDefinition: TraceSignalDefinition = {
  ...activeDefinition,
  id: '22222222-2222-4222-8222-222222222222',
  name: 'resolution_detail',
  displayLabel: 'Resolution Detail',
  status: 'archived',
};

beforeAll(() => {
  if (typeof window.PointerEvent === 'undefined') {
    window.PointerEvent = window.MouseEvent as unknown as typeof PointerEvent;
  }
});
afterEach(() => cleanup());

function management(overrides: Partial<TraceSignalManagement> = {}): TraceSignalManagement {
  const list: TraceSignalManagementListResponse = {
    definitions: [activeDefinition, archivedDefinition],
    limits: { maxDefinitionsPerOrganization: 7 },
  };
  return {
    canManage: true,
    list: vi.fn().mockResolvedValue(list),
    create: vi.fn().mockImplementation(async (input: CreateTraceSignalDefinitionInput) => ({
      ...activeDefinition,
      ...input,
      id: '33333333-3333-4333-8333-333333333333',
      enabled: null,
    })),
    update: vi.fn().mockImplementation(async (_id: string, input: UpdateTraceSignalDefinitionInput) => ({
      ...activeDefinition,
      ...input,
      version: 2,
    })),
    archive: vi.fn().mockResolvedValue({ ...activeDefinition, status: 'archived' }),
    restore: vi.fn().mockResolvedValue({ ...archivedDefinition, status: 'active' }),
    setProjectEnabled: vi.fn().mockResolvedValue({
      projectId: 'project-1',
      signalDefinitionId: activeDefinition.id,
      enabled: true,
    }),
    ...overrides,
  };
}

function SettingsHarness() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <TraceSignalSettingsButton open={open} onClick={() => setOpen(value => !value)} />
      {open ? <TraceSignalSettingsPanel onClose={() => setOpen(false)} /> : null}
    </>
  );
}

function renderSettings(signalManagement?: TraceSignalManagement) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <TraceIntelligenceProvider cacheScope="settings-test" signalManagement={signalManagement}>
        <SettingsHarness />
      </TraceIntelligenceProvider>
    </QueryClientProvider>,
  );
}

async function openSettings() {
  fireEvent.click(screen.getByRole('button', { name: 'Signal settings' }));
  return screen.findByRole('complementary', { name: 'Trace signal settings' });
}

describe('TraceSignalSettingsButton', () => {
  it('is omitted when the host does not supply management capability', () => {
    renderSettings();
    expect(screen.queryByRole('button', { name: 'Signal settings' })).toBeNull();
  });

  it('opens an in-page right-side section with scope copy, read-only built-ins, and organization usage', async () => {
    renderSettings(management());
    const settingsButton = screen.getByRole('button', { name: 'Signal settings' });
    expect(settingsButton.getAttribute('aria-expanded')).toBe('false');
    await openSettings();

    expect(settingsButton.getAttribute('aria-expanded')).toBe('true');
    expect(await screen.findByText('Organization signal library')).toBeTruthy();
    expect(screen.getByText(/definitions, prompts, and versions are shared by every project/i)).toBeTruthy();
    expect(screen.getByText('Current project')).toBeTruthy();
    expect(screen.getByText(/enable switches apply only to this project/i)).toBeTruthy();
    expect(screen.getAllByText('Read only')).toHaveLength(4);
    expect(screen.getByText('1 of 7 active organization definitions')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Close Panel' }));
    await waitFor(() => expect(screen.queryByRole('complementary', { name: 'Trace signal settings' })).toBeNull());
  });

  it('creates and edits definitions while keeping the name immutable', async () => {
    const adapter = management();
    renderSettings(adapter);
    await openSettings();
    await screen.findByText('Handoff Quality');

    fireEvent.click(screen.getByRole('button', { name: 'Create signal' }));
    expect(screen.queryByText('Trace context')).toBeNull();
    expect(screen.getByText(/every signal receives all available bounded trace context/i)).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Signal name'), { target: { value: 'tool_usage' } });
    fireEvent.change(screen.getByLabelText('Display label'), { target: { value: 'Tool Usage' } });
    fireEvent.change(screen.getByLabelText('Description'), { target: { value: 'How the agent used tools.' } });
    expect(screen.queryByLabelText('Additional response rules')).toBeNull();
    fireEvent.change(screen.getByLabelText('Signal instructions'), {
      target: { value: 'Describe how the agent used tools in one sentence.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Create signal' }));
    await waitFor(() =>
      expect(adapter.create).toHaveBeenCalledWith({
        name: 'tool_usage',
        displayLabel: 'Tool Usage',
        description: 'How the agent used tools.',
        taskPrompt: 'Describe how the agent used tools in one sentence.',
      }),
    );

    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    expect(screen.getByLabelText('Signal name')).toHaveProperty('disabled', true);
    expect(screen.queryByLabelText('Additional response rules')).toBeNull();
    expect(screen.getByText(/instruction changes create a new version and apply only to new traces/i)).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Display label'), { target: { value: 'Handoff Clarity' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save signal' }));
    await waitFor(() =>
      expect(adapter.update).toHaveBeenCalledWith(
        activeDefinition.id,
        expect.objectContaining({
          displayLabel: 'Handoff Clarity',
        }),
      ),
    );
  });

  it('renders server validation errors accessibly', async () => {
    const adapter = management({ create: vi.fn().mockRejectedValue(new Error('Signal name is reserved')) });
    renderSettings(adapter);
    await openSettings();
    await screen.findByText('Handoff Quality');

    fireEvent.click(screen.getByRole('button', { name: 'Create signal' }));
    fireEvent.change(screen.getByLabelText('Signal name'), { target: { value: 'tool_usage' } });
    fireEvent.change(screen.getByLabelText('Display label'), { target: { value: 'Tool Usage' } });
    fireEvent.change(screen.getByLabelText('Signal instructions'), { target: { value: 'Analyze tool usage.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create signal' }));
    expect((await screen.findByRole('alert')).textContent).toContain('Signal name is reserved');
  });

  it('clears stale form errors between create and edit sessions', async () => {
    const adapter = management({ create: vi.fn().mockRejectedValue(new Error('Create failed')) });
    renderSettings(adapter);
    await openSettings();
    await screen.findByText('Handoff Quality');

    fireEvent.click(screen.getByRole('button', { name: 'Create signal' }));
    fireEvent.change(screen.getByLabelText('Signal name'), { target: { value: 'tool_usage' } });
    fireEvent.change(screen.getByLabelText('Display label'), { target: { value: 'Tool Usage' } });
    fireEvent.change(screen.getByLabelText('Signal instructions'), { target: { value: 'Analyze tool usage.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create signal' }));
    expect((await screen.findByRole('alert')).textContent).toContain('Create failed');

    const closeButton = screen.getAllByRole('button', { name: 'Close' }).at(-1);
    if (!closeButton) throw new Error('Expected the signal form close button');
    fireEvent.click(closeButton);
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Create custom signal' })).toBeNull());
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));

    expect(await screen.findByDisplayValue('Handoff Quality')).toBeTruthy();
    expect(screen.queryByText('Create failed')).toBeNull();
  });

  it('toggles, archives, and restores only the selected definition', async () => {
    const adapter = management();
    renderSettings(adapter);
    await openSettings();
    await screen.findByText('Handoff Quality');

    fireEvent.click(screen.getByRole('switch', { name: 'Enable Handoff Quality' }));
    await waitFor(() => expect(adapter.setProjectEnabled).toHaveBeenCalledWith(activeDefinition.id, true));
    await waitFor(() => expect(adapter.list).toHaveBeenCalledTimes(2));
    fireEvent.click(screen.getByRole('button', { name: 'Archive' }));
    await waitFor(() => expect(adapter.archive).toHaveBeenCalledWith(activeDefinition.id));
    fireEvent.click(screen.getByText('Archived definitions (1)'));
    fireEvent.click(screen.getByRole('button', { name: 'Restore' }));
    await waitFor(() => expect(adapter.restore).toHaveBeenCalledWith(archivedDefinition.id));
  });

  it('shows read-only configuration without enabled mutation controls for non-admins', async () => {
    renderSettings(management({ canManage: false }));
    await openSettings();
    await screen.findByText('Handoff Quality');

    expect(screen.getByText(/read-only access/i)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Create signal' })).toHaveProperty('disabled', true);
    expect(screen.getByRole('button', { name: 'Edit' })).toHaveProperty('disabled', true);
    expect(screen.getByRole('button', { name: 'Archive' })).toHaveProperty('disabled', true);
    expect(screen.getByRole('switch', { name: 'Enable Handoff Quality' })).toHaveProperty('disabled', true);
  });

  it('uses the server-provided cap and renders management errors in the pane', async () => {
    const atLimit = management({
      list: vi.fn().mockResolvedValue({
        definitions: [activeDefinition],
        limits: { maxDefinitionsPerOrganization: 1 },
      }),
      archive: vi.fn().mockRejectedValue(new Error('Registry conflict')),
    });
    renderSettings(atLimit);
    await openSettings();
    await screen.findByText('1 of 1 active organization definitions');

    expect(screen.getByRole('button', { name: 'Create signal' })).toHaveProperty('disabled', true);
    fireEvent.click(screen.getByRole('button', { name: 'Archive' }));
    expect(await screen.findByText('Registry conflict')).toBeTruthy();
  });
});
