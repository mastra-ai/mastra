import { createContext, useContext, useState } from 'react';
import type { ReactNode } from 'react';
import { createMemoryRouter, RouterProvider } from 'react-router';

export type MemoryRouterEntry = string | { pathname: string; state?: unknown };

// The data router is created once, so its one route renders the latest children through context.
const RouteChildrenContext = createContext<ReactNode>(null);
const RouteChildren = () => useContext(RouteChildrenContext);

export function TestDataRouter({
  initialEntries,
  children,
}: {
  initialEntries?: MemoryRouterEntry[];
  children: ReactNode;
}) {
  const [router] = useState(() => createMemoryRouter([{ path: '*', element: <RouteChildren /> }], { initialEntries }));
  return (
    <RouteChildrenContext.Provider value={children}>
      <RouterProvider router={router} />
    </RouteChildrenContext.Provider>
  );
}
