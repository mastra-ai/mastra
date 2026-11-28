import { ThemeProvider } from '@mastra/playground-ui/components/ThemeProvider';
import { TooltipProvider } from '@mastra/playground-ui/components/Tooltip';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, renderHook, waitFor } from '@testing-library/react';
import type { RenderHookOptions } from '@testing-library/react';
import { forwardRef, useMemo } from 'react';
import type { ReactElement, ReactNode } from 'react';

import { ApiConfigProvider, createApiConfig } from '../../src/api/config';
import { useFactorySessionData } from '../../src/ui/domains/chat/context/RouterSessionHost';
import { SessionHostContext } from '@mastra/playground-ui/domains/factory/session/thread/chat/context/SessionHostContext';
import type {
  SessionHost,
  SessionLinkProps,
} from '@mastra/playground-ui/domains/factory/session/thread/chat/context/SessionHostContext';
import { FactoryPlatformConnect } from '../../src/ui/domains/settings/components/FactoryPlatformConnect';

/**
 * Base URL every test stubs against. `src` is platform-agnostic and
 * takes the base URL via injection, so tests point it at an absolute origin
 * that MSW intercepts (the web app injects `''` for same-origin requests).
 */
export const TEST_BASE_URL = 'http://localhost:4111';

/** The API config every test renders with, built once like the web entry's. */
export const TEST_API = createApiConfig({ baseUrl: TEST_BASE_URL });

/**
 * The host for components rendered without a router: nowhere in particular,
 * plain links, and navigation that goes nowhere. Tests that render inside a
 * router mount `RouterSessionHost` there instead, which takes precedence.
 */
const StaticSessionLink = forwardRef<HTMLAnchorElement, SessionLinkProps>(function StaticSessionLink(
  { returnHere: _returnHere, ...props },
  ref,
) {
  return <a ref={ref} {...props} />;
});

const STATIC_SESSION_HOST: Omit<SessionHost, 'data'> = {
  factoryProjectId: undefined,
  sessionId: undefined,
  threadId: undefined,
  draftSessionId: undefined,
  routeKind: 'none',
  location: { pathname: '/', search: '', state: null },
  LinkComponent: StaticSessionLink,
  navigate: () => {},
  links: {
    settings: section => `/settings/${section}`,
    thread: ({ sessionId, threadId }) => `/workspaces/${sessionId}/threads/${threadId}`,
    userThread: threadId => `/user/threads/${threadId}`,
    newUserSession: () => '/user/new',
    channelThread: threadId => `/threads/${threadId}`,
    knowledgePage: pageId => `/knowledge?page=${pageId}`,
    project: projectId => `/projects/${projectId}`,
    card: workItemId => `/cards/${workItemId}`,
    workItemBoard: () => '/boards/work',
  },
};

/** A session host outside any route, reading Factory's data like the app does. */
function StaticSessionHost({ children }: { children: ReactNode }) {
  const data = useFactorySessionData();
  const host = useMemo<SessionHost>(() => ({ ...STATIC_SESSION_HOST, data }), [data]);
  return <SessionHostContext.Provider value={host}>{children}</SessionHostContext.Provider>;
}

function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
}

function Wrapper({ client, children }: { client: QueryClient; children: ReactNode }) {
  return (
    <ThemeProvider defaultTheme="system" storageKey="mastracode.theme">
      <TooltipProvider delayDuration={0}>
        <QueryClientProvider client={client}>
          <ApiConfigProvider config={TEST_API}>
            <StaticSessionHost>
              <FactoryPlatformConnect>{children}</FactoryPlatformConnect>
            </StaticSessionHost>
          </ApiConfigProvider>
        </QueryClientProvider>
      </TooltipProvider>
    </ThemeProvider>
  );
}

/** Render a component through the real Query + ApiConfig providers. */
export function renderWithProviders(ui: ReactElement, client: QueryClient = makeQueryClient()) {
  return {
    client,
    ...render(ui, { wrapper: ({ children }) => <Wrapper client={client}>{children}</Wrapper> }),
  };
}

/** Render a hook through the real Query + ApiConfig providers. */
export function renderHookWithProviders<Result, Props>(
  hook: (props: Props) => Result,
  options?: Omit<RenderHookOptions<Props>, 'wrapper'> & {
    client?: QueryClient;
    /** Extra providers nested inside the base stack, e.g. a feed stream. */
    inner?: (props: { children: ReactNode }) => ReactElement;
  },
) {
  const client = options?.client ?? makeQueryClient();
  const Inner = options?.inner;
  return {
    client,
    ...renderHook(hook, {
      ...options,
      wrapper: ({ children }) => <Wrapper client={client}>{Inner ? <Inner>{children}</Inner> : children}</Wrapper>,
    }),
  };
}

/**
 * Wait until every in-flight query + mutation in the cache has settled — and
 * stays settled. Query chains (session init → resource resolution → messages)
 * have brief idle gaps between links; a single idle sample can pass in such a
 * gap while a later link is about to remount the transcript subtree and
 * detach nodes the test already queried. Requiring two idle samples separated
 * by a macrotask delay rides out those gaps.
 */
export async function waitForMutationsIdle(client: QueryClient) {
  const assertIdle = () => {
    if (client.isMutating() > 0) throw new Error('mutations still pending');
    if (client.isFetching() > 0) throw new Error('queries still fetching');
  };
  await waitFor(async () => {
    assertIdle();
    await new Promise(resolve => setTimeout(resolve, 50));
    assertIdle();
  });
}

/** The chat page's own header (the sidebar renders its own `banner`). */
export function findPageHeader(): Promise<HTMLElement> {
  return waitFor(() => {
    const header = document.querySelector<HTMLElement>('[data-slot="chat-page-header"] > header');
    if (!header) throw new Error('Page header not rendered');
    return header;
  });
}
