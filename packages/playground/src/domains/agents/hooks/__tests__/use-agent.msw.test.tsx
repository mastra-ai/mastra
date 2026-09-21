// @vitest-environment jsdom
import { RequestContextProvider, useRequestContext } from '@mastra/playground-ui/domains/request-context';
import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { afterEach, describe, expect, it } from 'vitest';
import { useAgent } from '../use-agent';
import { v2Agent } from '@/domains/agents/components/__tests__/fixtures/composer-model-settings';
import { server } from '@/test/msw-server';

const BASE_URL = 'http://localhost:4111';
function Probe({ agentId }: { agentId?: string }) {
  const { data } = useAgent(agentId);
  const { setRequestContext } = useRequestContext();
  return (
    <>
      <output>{data?.name ?? 'Loading'}</output>
      <button onClick={() => setRequestContext({ locale: 'fr' })}>Save context</button>
    </>
  );
}
function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const tree = (agentId?: string) => (
    <MastraReactProvider baseUrl={BASE_URL}>
      <QueryClientProvider client={client}>
        <RequestContextProvider entityKey="agent:test">
          <Probe agentId={agentId} />
        </RequestContextProvider>
      </QueryClientProvider>
    </MastraReactProvider>
  );
  const rendered = render(tree('a'));
  return { client, navigate: (id?: string) => rendered.rerender(tree(id)) };
}
afterEach(() => {
  cleanup();
  localStorage.clear();
});
describe('useAgent', () => {
  describe('when navigating to an uncached agent', () => {
    it('does not display the previous agent while the new request is pending', async () => {
      let release = () => {};
      const gate = new Promise<void>(resolve => {
        release = resolve;
      });
      server.use(
        http.get(`${BASE_URL}/api/agents/:id`, async ({ params }) => {
          if (params.id === 'b') await gate;
          return HttpResponse.json({ ...v2Agent, name: String(params.id) });
        }),
      );
      const { navigate } = setup();
      await screen.findByText('a');
      navigate('b');
      try {
        expect(screen.getByRole('status').textContent).toBe('Loading');
      } finally {
        release();
      }
      await screen.findByText('b');
    });
  });
  describe('when navigating to a cached agent', () => {
    it('displays that agent instead of the previous agent', async () => {
      server.use(
        http.get(`${BASE_URL}/api/agents/:id`, ({ params }) =>
          HttpResponse.json({ ...v2Agent, name: String(params.id) }),
        ),
      );
      const { client, navigate } = setup();
      await screen.findByText('a');
      client.setQueryData(['agent', 'b', {}], { ...v2Agent, name: 'b' });
      navigate('b');
      expect(screen.getByRole('status').textContent).toBe('b');
    });
  });
  describe('when saving context for the same agent', () => {
    it('keeps its data visible until the contextual response arrives', async () => {
      let release = () => {};
      let calls = 0;
      const gate = new Promise<void>(resolve => {
        release = resolve;
      });
      server.use(
        http.get(`${BASE_URL}/api/agents/a`, async () => {
          calls++;
          if (calls > 1) {
            await gate;
            return HttpResponse.json({ ...v2Agent, name: 'Updated' });
          }
          return HttpResponse.json({ ...v2Agent, name: 'Original' });
        }),
      );
      setup();
      await screen.findByText('Original');
      fireEvent.click(screen.getByText('Save context'));
      try {
        expect(screen.getByRole('status').textContent).toBe('Original');
      } finally {
        release();
      }
      await screen.findByText('Updated');
    });
  });
});
