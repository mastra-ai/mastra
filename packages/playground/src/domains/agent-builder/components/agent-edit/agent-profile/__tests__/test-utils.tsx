import type { BuilderSettingsResponse, ChannelPlatformInfo, StoredAgentResponse } from '@mastra/client-js';
import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { useState } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { MemoryRouter, Route, Routes } from 'react-router';

import { AgentColorProvider } from '../../../../contexts/agent-color-context';
import { AgentPrimitivesProvider, useAgentPrimitives } from '../../../../contexts/agent-primitives-context';
import { WizardProvider } from '../../../../contexts/wizard-context';
import type { AgentBuilderEditFormValues } from '../../../../schemas';
import { storedAgentToFormValues } from '../../../../services/stored-agent-to-form-values';
import {
  TEST_AGENT_ID,
  authCapabilities,
  buildBuilderSettings,
  buildStoredAgent,
  currentUser,
  emptyWorkspaces,
  noDependents,
  noPlatforms,
} from './fixtures/builder';
import { server } from '@/test/msw-server';

export const BASE_URL = 'http://localhost:4111';
export { TEST_AGENT_ID };

interface StepHandlerOptions {
  settings?: BuilderSettingsResponse;
  storedAgent?: StoredAgentResponse;
  platforms?: ChannelPlatformInfo[];
}

/**
 * Registers the network responses backing the real provider stack the step
 * tests render: builder settings (feature flags), auth (permissions + current
 * user), the stored agent, workspaces, and channel platforms. Per-test
 * overrides still go through `server.use(...)` as usual.
 */
export const registerStepHandlers = ({
  settings = buildBuilderSettings(),
  storedAgent = buildStoredAgent(),
  platforms = noPlatforms,
}: StepHandlerOptions = {}) => {
  server.use(
    http.get(`${BASE_URL}/api/editor/builder/settings`, () => HttpResponse.json(settings)),
    http.get(`${BASE_URL}/api/auth/capabilities`, () => HttpResponse.json(authCapabilities)),
    http.get(`${BASE_URL}/api/auth/me`, () => HttpResponse.json(currentUser)),
    http.get(`${BASE_URL}/api/stored/agents/${TEST_AGENT_ID}`, () => HttpResponse.json(storedAgent)),
    http.get(`${BASE_URL}/api/stored/agents/${TEST_AGENT_ID}/dependents`, () => HttpResponse.json(noDependents)),
    http.get(`${BASE_URL}/api/stored/workspaces`, () => HttpResponse.json(emptyWorkspaces)),
    http.get(`${BASE_URL}/api/channels/platforms`, () => HttpResponse.json(platforms)),
  );
};

/**
 * Mirrors `EditPageGate` + `EditPageForm`: waits for the agent primitives to
 * be ready, then seeds a `react-hook-form` provider once from the fetched
 * stored agent, so steps reading form state (e.g. the library step watching
 * `visibility`) work as in the app.
 */
const StepFormProvider = ({ children }: { children: ReactNode }) => {
  const { isReady } = useAgentPrimitives();
  if (!isReady) return null;
  return <ReadyStepForm>{children}</ReadyStepForm>;
};

const ReadyStepForm = ({ children }: { children: ReactNode }) => {
  const { storedAgent } = useAgentPrimitives();
  const [defaultValues] = useState(() => storedAgentToFormValues(storedAgent));
  const formMethods = useForm<AgentBuilderEditFormValues>({ defaultValues });
  return <FormProvider {...formMethods}>{children}</FormProvider>;
};

interface RenderStepOptions {
  /** Extra routes rendered next to the edit route (e.g. a /view probe). */
  extraRoutes?: ReactNode;
}

/**
 * Renders a profile step inside the real provider stack (client SDK, React
 * Query, router, agent color, agent primitives, wizard) so tests exercise the
 * same data flow as the app — driven by MSW, not module mocks. Call
 * `registerStepHandlers()` first so the providers' queries resolve.
 */
export const renderStep = (ui: ReactNode, { extraRoutes }: RenderStepOptions = {}) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  const tree = (
    <MastraReactProvider baseUrl={BASE_URL}>
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[`/agent-builder/agents/${TEST_AGENT_ID}/edit`]}>
          <Routes>
            <Route
              path="/agent-builder/agents/:id/edit"
              element={
                <AgentColorProvider agentId={TEST_AGENT_ID}>
                  <AgentPrimitivesProvider agentId={TEST_AGENT_ID}>
                    <StepFormProvider>
                      <WizardProvider initialStep="ready">{ui}</WizardProvider>
                    </StepFormProvider>
                  </AgentPrimitivesProvider>
                </AgentColorProvider>
              }
            />
            {extraRoutes}
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    </MastraReactProvider>
  );

  const result = render(tree);
  return {
    ...result,
    /** Re-renders the exact same tree in place (no remount) to assert mount-only effects. */
    rerenderStep: () => result.rerender(tree),
  };
};

/**
 * Flushes pending microtasks/timers so React Query settles its fetches. Runs
 * several rounds because the readiness gate (`StepFormProvider`) only mounts
 * the step once every provider query has resolved, which takes more than one
 * fetch round-trip.
 */
export const flush = () =>
  act(async () => {
    for (let round = 0; round < 10; round++) {
      await new Promise(resolve => setTimeout(resolve, 0));
    }
  });
