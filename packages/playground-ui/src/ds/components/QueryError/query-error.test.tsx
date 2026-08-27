// @vitest-environment jsdom
import { MastraReactProvider } from '@mastra/react';
import { cleanup, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it } from 'vitest';

import { QueryError } from './QueryError';

afterEach(cleanup);

/** The session-expired state reaches for the client to build its login URL. */
const withClient = (children: ReactNode) => (
  <MastraReactProvider baseUrl="http://localhost:4111">{children}</MastraReactProvider>
);

describe('QueryError', () => {
  it('offers a way back in when the session has expired', () => {
    render(withClient(<QueryError error={{ status: 401 }} resource="tools" title="Failed to load tools" />));

    expect(screen.getByText('Session Expired')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Log in' })).toBeTruthy();
    expect(screen.queryByText('Failed to load tools')).toBeNull();
  });

  it('names the resource the caller was refused', () => {
    render(withClient(<QueryError error={{ status: 403 }} resource="tools" title="Failed to load tools" />));

    expect(screen.getByText(/permission to access tools/)).toBeTruthy();
    expect(screen.queryByText('Failed to load tools')).toBeNull();
  });

  it('reads a 401 out of the client-js message when there is no status', () => {
    render(withClient(<QueryError error={new Error('HTTP error! status: 401')} title="Failed to load tools" />));

    expect(screen.getByText('Session Expired')).toBeTruthy();
  });

  it('unwraps the server payload for any other failure', () => {
    const error = new Error('HTTP error! status: 500 - {"error":"observability store is unreachable"}');
    render(withClient(<QueryError error={error} title="Failed to load tools" />));

    expect(screen.getByText('Failed to load tools')).toBeTruthy();
    expect(screen.getByText('observability store is unreachable')).toBeTruthy();
  });

  it('falls back to one message when the failure is not an Error', () => {
    render(withClient(<QueryError error={undefined} title="Failed to load tools" />));

    expect(screen.getByText('Something went wrong while fetching the data.')).toBeTruthy();
  });
});
