import { ScrollRestoration } from 'react-router';

import { AuthGuard } from './AuthGuard';

export function RootGuards() {
  return (
    <>
      {/* Data routers keep the window scroll across navigations without this. */}
      <ScrollRestoration />
      <AuthGuard />
    </>
  );
}
