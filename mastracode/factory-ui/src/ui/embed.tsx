/**
 * Entry for hosts that render Factory inside their own app (Platform).
 *
 * The host mounts `createFactoryEmbedRoutes()` under one of its routes and wraps
 * that route's element in `<FactoryEmbedProvider>`. Factory then talks to the
 * host's proxy (`baseUrl`), keeps its links under `root`, and portals its
 * navigation into the host's sidebar instead of drawing its own.
 */
import { useMemo, useState } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { createBrowserRouter } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import type { ReactNode } from 'react';
import type { RouteObject } from 'react-router';

import { ApiConfigProvider } from '../api/config';
import { createQueryClient } from '../query-client';
import { RootGuards } from './domains/auth/components/RootGuards';
import { RouteErrorPage } from './layouts/RouteErrorPage';
import { setAppRoot } from './lib/app-root';
import { FactoryEmbedContext } from './lib/embed';
import { createAppChildRoutes } from './router';

export { useCreateFactoryMutation, useFactoriesQuery } from '../hooks/useFactories';

export interface FactoryEmbedProviderProps {
  /** Path the routes are mounted under, e.g. `/acme/my-project/factory`. */
  root: string;
  /** Proxy that forwards to the Factory server. */
  baseUrl: string;
  fetchImpl?: typeof fetch;
  sidebarContainer: HTMLElement | null;
  children: ReactNode;
}

export function FactoryEmbedProvider({
  root,
  baseUrl,
  fetchImpl,
  sidebarContainer,
  children,
}: FactoryEmbedProviderProps) {
  // Set during render so the first child render already builds host-relative links.
  setAppRoot(root);
  const embed = useMemo(() => ({ sidebarContainer }), [sidebarContainer]);
  return (
    <ApiConfigProvider baseUrl={baseUrl} fetchImpl={fetchImpl}>
      <FactoryEmbedContext.Provider value={embed}>{children}</FactoryEmbedContext.Provider>
    </ApiConfigProvider>
  );
}

export function createFactoryEmbedRoutes(): RouteObject[] {
  return [{ element: <RootGuards />, errorElement: <RouteErrorPage />, children: createAppChildRoutes() }];
}

export type FactoryEmbedAppProps = Omit<FactoryEmbedProviderProps, 'children'>;

/**
 * Self-contained embed: Factory's own router (React Router v8) mounted at `root`.
 * Use when the host runs a different router major, so route objects can't be shared.
 */
export function FactoryEmbedApp(props: FactoryEmbedAppProps) {
  const [queryClient] = useState(createQueryClient);
  const [router] = useState(() => createBrowserRouter([{ path: props.root, children: createFactoryEmbedRoutes() }]));
  return (
    <QueryClientProvider client={queryClient}>
      <FactoryEmbedProvider {...props}>
        <RouterProvider router={router} />
      </FactoryEmbedProvider>
    </QueryClientProvider>
  );
}
