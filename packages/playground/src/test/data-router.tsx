import { useState } from 'react';
import type { ReactNode } from 'react';
import { createMemoryRouter, RouterProvider } from 'react-router';

export type MemoryRouterEntry = string | { pathname: string; state?: unknown };

/** A memory data router (as Studio's own router is), for UI that needs one, e.g. `useBlocker`. */
export function TestDataRouter({
  initialEntries,
  children,
}: {
  initialEntries?: MemoryRouterEntry[];
  children: ReactNode;
}) {
  const [router] = useState(() => createMemoryRouter([{ path: '*', element: children }], { initialEntries }));
  return <RouterProvider router={router} />;
}
