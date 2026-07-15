import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { afterEach, describe, expect, it } from 'vitest';

import { AgentPlaygroundVersionBar } from '../agent-playground/agent-playground-version-bar';
import { emptyAgentVersions } from './fixtures/agent-versions';
import { server } from '@/test/msw-server';

const BASE_URL = 'http://localhost:4111';
const AGENT_ID = 'chef-agent';

function VersionSelectorHarness() {
  const { versionSelector } = AgentPlaygroundVersionBar({
    agentId: AGENT_ID,
    onVersionSelect: () => {},
    isDirty: false,
    isSavingDraft: false,
    isPublishing: false,
    hasDraft: false,
    readOnly: false,
    onSaveDraft: async () => {},
    onPublish: async () => {},
  });

  return versionSelector;
}

function renderVersionSelector() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  server.use(
    http.get(`${BASE_URL}/api/stored/agents/${AGENT_ID}/versions`, () => HttpResponse.json(emptyAgentVersions)),
  );

  return render(
    <MastraReactProvider baseUrl={BASE_URL}>
      <QueryClientProvider client={queryClient}>
        <VersionSelectorHarness />
      </QueryClientProvider>
    </MastraReactProvider>,
  );
}

afterEach(cleanup);

describe('AgentPlaygroundVersionBar', () => {
  describe('when version information receives focus', () => {
    it('shows the version guidance as a tooltip', async () => {
      renderVersionSelector();

      fireEvent.focus(screen.getByRole('button', { name: 'Version information' }));

      expect(
        await screen.findByRole('tooltip', {
          name: /Changes are saved as draft versions/,
        }),
      ).not.toBeNull();
    });
  });
});
