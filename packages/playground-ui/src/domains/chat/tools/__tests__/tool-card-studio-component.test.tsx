// @vitest-environment jsdom
import type { ToolStudioComponentProps } from '@mastra/core/tools';
import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { ComponentType, ReactNode } from 'react';
import { useState } from 'react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ToolStudioComponentsProvider } from '../studio-components/studio-components-context';
import { ToolCard } from '../tool-card';
import type { ToolCardProps } from '../tool-card';
import { agentWithStudioComponent, weatherCardComponentId } from './fixtures/studio-component';
import { ChatAgentContext } from '@/domains/chat/context/chat-context';
import { ToolCallProvider } from '@/domains/chat/context/tool-call-context';
import { server } from '@/test/msw-server';

const BASE_URL = 'http://localhost:4111';

type LoadComponent = (id: string) => Promise<ComponentType<ToolStudioComponentProps>>;

const WeatherCard = ({ toolName, input, output, state }: ToolStudioComponentProps) => (
  <section aria-label="Weather card">
    <p>{toolName}</p>
    <p>{JSON.stringify(input)}</p>
    <p>{JSON.stringify(output)}</p>
    <p>{state}</p>
  </section>
);

const BrokenCard = (): ReactNode => {
  throw new Error('Card exploded');
};

const queryClients = new Set<QueryClient>();
let agentRequests = 0;

beforeEach(() => {
  agentRequests = 0;
  server.use(
    http.get(`${BASE_URL}/api/mcp/v0/servers`, () => HttpResponse.json({ servers: [], totalCount: 0 })),
    http.get(`${BASE_URL}/api/agents/test-agent`, () => {
      agentRequests += 1;
      return HttpResponse.json(agentWithStudioComponent);
    }),
  );
});

afterEach(async () => {
  cleanup();
  for (const queryClient of queryClients) queryClient.clear();
  queryClients.clear();
  await new Promise(resolve => setTimeout(resolve, 0));
});

const Providers = ({ children, loadComponent }: { children: ReactNode; loadComponent?: LoadComponent }) => {
  const [queryClient] = useState(() => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    queryClients.add(client);
    return client;
  });
  const chat = (
    <ChatAgentContext.Provider value={{ agentId: 'test-agent' }}>
      <ToolCallProvider
        approveToolcall={() => {}}
        declineToolcall={() => {}}
        approveToolcallGenerate={() => {}}
        declineToolcallGenerate={() => {}}
        approveNetworkToolcall={() => {}}
        declineNetworkToolcall={() => {}}
        isRunning={false}
        toolCallApprovals={{}}
        networkToolCallApprovals={{}}
      >
        {children}
      </ToolCallProvider>
    </ChatAgentContext.Provider>
  );
  return (
    <MastraReactProvider baseUrl={BASE_URL}>
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          {loadComponent ? (
            <ToolStudioComponentsProvider loadComponent={loadComponent}>{chat}</ToolStudioComponentsProvider>
          ) : (
            chat
          )}
        </MemoryRouter>
      </QueryClientProvider>
    </MastraReactProvider>
  );
};

const weatherCall = (over: Partial<ToolCardProps> = {}): ToolCardProps => ({
  toolName: 'getWeather',
  input: { city: 'Paris' },
  output: { temperature: 21 },
  toolCallId: 'call-1',
  state: 'output-available',
  metadata: { mode: 'stream' },
  ...over,
});

const renderToolCard = (props: ToolCardProps, loadComponent?: LoadComponent) =>
  render(<ToolCard {...props} />, {
    wrapper: ({ children }) => <Providers loadComponent={loadComponent}>{children}</Providers>,
  });

describe('ToolCard studio component', () => {
  describe('when the agent tool has a studio component', () => {
    it('renders the custom component with the call props', async () => {
      const loadComponent = vi.fn<LoadComponent>(async () => WeatherCard);
      renderToolCard(weatherCall(), loadComponent);

      const card = await screen.findByRole('region', { name: 'Weather card' });
      expect(card.textContent).toContain('getWeather');
      expect(card.textContent).toContain('{"city":"Paris"}');
      expect(card.textContent).toContain('{"temperature":21}');
      expect(card.textContent).toContain('output-available');
      expect(loadComponent).toHaveBeenCalledWith(weatherCardComponentId);
    });
  });

  describe('when the studio component fails to load', () => {
    it('falls back to the tool badge', async () => {
      const onError = vi.spyOn(console, 'error').mockImplementation(() => {});
      renderToolCard(weatherCall(), async () => {
        throw new Error('Failed to fetch module');
      });

      await vi.waitFor(() => expect(onError).toHaveBeenCalled());
      expect(screen.getByTestId('tool-badge').textContent).toContain('GetWeather');
    });
  });

  describe('when the studio component throws while rendering', () => {
    it('falls back to the tool badge', async () => {
      const onError = vi.spyOn(console, 'error').mockImplementation(() => {});
      renderToolCard(weatherCall(), async () => BrokenCard);

      await vi.waitFor(() => expect(onError).toHaveBeenCalled());
      expect(screen.getByTestId('tool-badge').textContent).toContain('GetWeather');
    });
  });

  describe('when the call is waiting for approval', () => {
    it('renders the tool badge with approval controls', async () => {
      const loadComponent = vi.fn<LoadComponent>(async () => WeatherCard);
      renderToolCard(
        weatherCall({
          output: undefined,
          state: 'input-available',
          metadata: {
            mode: 'stream',
            requireApprovalMetadata: {
              'call-1': { toolCallId: 'call-1', toolName: 'getWeather', args: { city: 'Paris' } },
            },
          },
        }),
        loadComponent,
      );

      expect(await screen.findByRole('button', { name: 'Approve getWeather' })).not.toBeNull();
      await vi.waitFor(() => expect(agentRequests).toBe(1));
      expect(loadComponent).not.toHaveBeenCalled();
    });
  });

  describe('when the agent tool has no studio component', () => {
    it('renders the tool badge', async () => {
      const loadComponent = vi.fn<LoadComponent>(async () => WeatherCard);
      renderToolCard(weatherCall({ toolName: 'searchDocs' }), loadComponent);

      expect(await screen.findByText('SearchDocs')).not.toBeNull();
      await vi.waitFor(() => expect(agentRequests).toBe(1));
      expect(loadComponent).not.toHaveBeenCalled();
    });
  });

  describe('when no studio components provider is mounted', () => {
    it('renders the tool badge', () => {
      renderToolCard(weatherCall());

      expect(screen.getByTestId('tool-badge').textContent).toContain('GetWeather');
      expect(agentRequests).toBe(0);
    });
  });
});
