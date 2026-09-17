// @vitest-environment jsdom
import { TooltipProvider } from '@mastra/playground-ui/components/Tooltip';
import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, describe, expect, it } from 'vitest';

import { EditLayoutWrapper } from '../edit-layout';
import {
  AGENT_ID,
  codeAgent,
  systemPackages,
  versionAccess,
  versionsList,
} from './fixtures/edit-layout-production-state';
import { SchemaRequestContextProvider } from '@/domains/request-context/context/schema-request-context';
import { server } from '@/test/msw-server';

const BASE_URL = 'http://localhost:4111';

const createQueryClient = () =>
  new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

const renderEditLayout = () =>
  render(
    <MastraReactProvider baseUrl={BASE_URL}>
      <QueryClientProvider client={createQueryClient()}>
        <MemoryRouter initialEntries={[`/cms/agents/${AGENT_ID}/edit/instruction-blocks`]}>
          <TooltipProvider>
            <SchemaRequestContextProvider>
              <Routes>
                <Route path="/cms/agents/:agentId/edit" element={<EditLayoutWrapper />}>
                  <Route path="instruction-blocks" element={<div>Agent editor</div>} />
                </Route>
              </Routes>
            </SchemaRequestContextProvider>
          </TooltipProvider>
        </MemoryRouter>
      </QueryClientProvider>
    </MastraReactProvider>,
  );

afterEach(() => cleanup());

describe('EditLayoutWrapper', () => {
  describe('when a code-defined agent has known versions but its stored-agent lookup fails', () => {
    it('exposes the unknown Production state and recovery action', async () => {
      server.use(
        http.get(`${BASE_URL}/api/agents/${AGENT_ID}`, () => HttpResponse.json(codeAgent)),
        http.get(`${BASE_URL}/api/stored/agents/${AGENT_ID}/versions`, () => HttpResponse.json(versionsList)),
        http.get(`${BASE_URL}/api/stored/agents/${AGENT_ID}`, () =>
          HttpResponse.json({ error: 'stored-agent lookup unavailable' }, { status: 503 }),
        ),
        http.get(`${BASE_URL}/api/system/packages`, () => HttpResponse.json(systemPackages)),
        http.get(`${BASE_URL}/api/auth/capabilities`, () => HttpResponse.json(versionAccess)),
        http.get(`${BASE_URL}/api/editor/builder/settings`, () => HttpResponse.json({ enabled: false })),
      );

      renderEditLayout();

      expect(await screen.findByText('Version history')).not.toBeNull();
      fireEvent.click(await screen.findByRole('button', { name: 'Manage labels' }));
      expect(
        await screen.findByText('Production state could not be verified. Production changes remain disabled.'),
      ).not.toBeNull();
      expect(screen.getByText('Version history')).not.toBeNull();
      expect(screen.getByRole('button', { name: 'Manage labels', hidden: true })).not.toBeNull();
      expect(screen.getByRole('button', { name: 'Retry Production state' })).not.toBeNull();
      expect(screen.queryByText('No Production version is set.')).toBeNull();
    });
  });
});
