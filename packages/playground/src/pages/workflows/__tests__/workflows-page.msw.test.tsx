// @vitest-environment jsdom
import type { GetWorkflowResponse, WorkflowBuilderSettingsResponse } from '@mastra/client-js';
import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { AnchorHTMLAttributes } from 'react';
import { forwardRef } from 'react';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it } from 'vitest';

import Workflows from '../index';
import { rbacCapabilities } from '@/domains/agent-builder/hooks/__tests__/fixtures/auth';
import type { AuthCapabilities } from '@/domains/auth/types';
import { LinkComponentProvider } from '@/lib/framework';
import type { LinkComponentProviderProps } from '@/lib/framework';
import { server } from '@/test/msw-server';

const StubLink = forwardRef<HTMLAnchorElement, AnchorHTMLAttributes<HTMLAnchorElement> & { to?: string }>(
  ({ children, to, href, ...props }, ref) => (
    <a ref={ref} href={to ?? href} {...props}>
      {children}
    </a>
  ),
);
StubLink.displayName = 'StubLink';

const paths = {
  workflowLink: (workflowId: string) => `/workflows/${workflowId}`,
} as unknown as LinkComponentProviderProps['paths'];

const BASE_URL = 'http://localhost:4111';

const storedWorkflow: GetWorkflowResponse = {
  name: 'stored-workflow',
  description: '',
  steps: {},
  allSteps: {},
  stepGraph: [],
  inputSchema: '',
  outputSchema: '',
  stateSchema: '',
  origin: 'stored',
} as GetWorkflowResponse;

function serve({
  workflows,
  capabilities,
  settings = { enabled: true },
}: {
  workflows: Record<string, GetWorkflowResponse>;
  capabilities: AuthCapabilities;
  settings?: WorkflowBuilderSettingsResponse;
}) {
  server.use(
    http.get(`${BASE_URL}/api/workflows`, () => HttpResponse.json(workflows)),
    http.get(`${BASE_URL}/api/auth/capabilities`, () => HttpResponse.json(capabilities)),
    http.get(`${BASE_URL}/api/editor/workflow-builder/settings`, () => HttpResponse.json(settings)),
  );
}

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <MastraReactProvider baseUrl={BASE_URL}>
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <LinkComponentProvider Link={StubLink} navigate={() => {}} paths={paths}>
            <Workflows />
          </LinkComponentProvider>
        </MemoryRouter>
      </QueryClientProvider>
    </MastraReactProvider>,
  );
}

const writerCaps = rbacCapabilities(['stored-workflows:read', 'stored-workflows:write', 'workflows:execute']);
const readerCaps = rbacCapabilities(['stored-workflows:read']);

afterEach(() => cleanup());

describe('Workflows page', () => {
  describe('when workflows exist and the user can write', () => {
    it('offers a Create workflow action pointing at the builder', async () => {
      serve({ workflows: { 'stored-workflow': storedWorkflow }, capabilities: writerCaps });

      renderPage();

      const link = await screen.findByRole('link', { name: /create workflow/i });
      expect(link.getAttribute('href')).toBe('/workflow-builder/create');
    });
  });

  describe('when workflows exist and the user is read-only', () => {
    it('hides the Create workflow action', async () => {
      serve({ workflows: { 'stored-workflow': storedWorkflow }, capabilities: readerCaps });

      renderPage();

      await waitFor(() => expect(screen.getByRole('link', { name: /schedules/i })).not.toBeNull());
      await waitFor(() => expect(screen.queryByRole('link', { name: /create workflow/i })).toBeNull());
    });
  });

  describe('when no workflows exist and the user can write', () => {
    it('offers a Create workflow action in the empty state', async () => {
      serve({ workflows: {}, capabilities: writerCaps });

      renderPage();

      const link = await screen.findByRole('link', { name: /create workflow/i });
      expect(link.getAttribute('href')).toBe('/workflow-builder/create');
    });
  });

  describe('when no workflows exist and the user is read-only', () => {
    it('shows the empty state without a Create workflow action', async () => {
      serve({ workflows: {}, capabilities: readerCaps });

      renderPage();

      await waitFor(() => expect(screen.getByText('No Workflows yet')).not.toBeNull());
      expect(screen.queryByRole('link', { name: /create workflow/i })).toBeNull();
    });
  });
});
