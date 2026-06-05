// @vitest-environment jsdom
import { TooltipProvider } from '@mastra/playground-ui';
import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AgentPlaygroundVersionBar as getAgentPlaygroundVersionBarParts } from '../agent-playground/agent-playground-version-bar';
import { emptyAgentVersions } from './fixtures/agent-playground-version-bar';
import { server } from '@/test/msw-server';

const BASE_URL = 'http://localhost:4111';

type VersionBarProps = Parameters<typeof getAgentPlaygroundVersionBarParts>[0];

function VersionBarHarness(props: Partial<VersionBarProps>) {
  const result = getAgentPlaygroundVersionBarParts({
    agentId: 'agent-1',
    onVersionSelect: vi.fn(),
    isDirty: true,
    isSavingDraft: false,
    isPublishing: false,
    hasDraft: false,
    readOnly: false,
    isCodeSourceAgent: true,
    showCodeModeActions: true,
    onSaveDraft: vi.fn(async () => undefined),
    onPublish: vi.fn(async () => undefined),
    ...props,
  });

  return (
    <>
      {result.versionSelector}
      {result.actionBar}
    </>
  );
}

function renderVersionBar(props: Partial<VersionBarProps> = {}) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  return render(
    <MastraReactProvider baseUrl={BASE_URL}>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <VersionBarHarness {...props} />
        </TooltipProvider>
      </QueryClientProvider>
    </MastraReactProvider>,
  );
}

function agentVersionHandlers() {
  return [http.get(`${BASE_URL}/api/stored/agents/:agentId/versions`, () => HttpResponse.json(emptyAgentVersions))];
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('AgentPlaygroundVersionBar source capabilities', () => {
  it('renders a provider-neutral source save action for source-provider storage', async () => {
    server.use(...agentVersionHandlers());

    renderVersionBar({ codeSourceStorage: 'source-provider', sourceProviderName: 'Example SCM' });

    expect(await screen.findByText('No filesystem saves yet')).not.toBeNull();
    expect(screen.getByRole('button', { name: /Download JSON/i })).not.toBeNull();
    expect(screen.getByRole('button', { name: /Save to source/i })).not.toBeNull();
  });

  it('disables code-source saves and shows the unavailable reason', () => {
    server.use(...agentVersionHandlers());

    renderVersionBar({
      codeSourceStorage: 'unavailable',
      sourceUnavailableReason: 'Code-source editing requires a configured source provider.',
    });

    const saveButton = screen.getByRole('button', { name: /Save to filesystem/i });
    expect(saveButton.hasAttribute('disabled')).toBe(true);
    expect(screen.getByText('Code-source editing requires a configured source provider.')).not.toBeNull();
  });

  it('proposes source changes with a custom message before enabling inspection', async () => {
    server.use(...agentVersionHandlers());
    const openChangeRequest = vi.fn(async () => ({ url: 'https://github.com/acme/repo/pull/123' }));
    const openWindow = vi.spyOn(window, 'open').mockImplementation(() => null);

    renderVersionBar({ canOpenPr: true, onOpenPr: openChangeRequest });

    expect(await screen.findByText('No filesystem saves yet')).not.toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Propose change/i }));
    fireEvent.change(screen.getByLabelText(/Commit message/i), { target: { value: 'Tune weather instructions' } });
    const proposeButtons = screen.getAllByRole('button', { name: /Propose Change/i });
    fireEvent.click(proposeButtons[proposeButtons.length - 1]);

    await waitFor(() => expect(openChangeRequest).toHaveBeenCalledWith('Tune weather instructions'));

    fireEvent.click(screen.getByRole('button', { name: /More source change options/i }));
    fireEvent.click(await screen.findByText(/Inspect change/i));

    expect(openWindow).toHaveBeenCalledWith('https://github.com/acme/repo/pull/123', '_blank', 'noopener,noreferrer');
  });

  it('discovers an existing source change before enabling inspection', async () => {
    server.use(...agentVersionHandlers());
    const inspectChangeRequest = vi.fn(async () => ({ url: 'https://github.com/acme/repo/pull/456' }));
    const openWindow = vi.spyOn(window, 'open').mockImplementation(() => null);

    renderVersionBar({ canOpenPr: true, onInspectPr: inspectChangeRequest });

    expect(await screen.findByText('No filesystem saves yet')).not.toBeNull();
    await waitFor(() => expect(inspectChangeRequest).toHaveBeenCalledTimes(1));

    fireEvent.click(screen.getByRole('button', { name: /More source change options/i }));
    fireEvent.click(await screen.findByText(/Inspect change/i));

    expect(openWindow).toHaveBeenCalledWith('https://github.com/acme/repo/pull/456', '_blank', 'noopener,noreferrer');
  });
});
