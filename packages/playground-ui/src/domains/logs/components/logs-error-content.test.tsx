// @vitest-environment jsdom
import { MastraReactProvider } from '@mastra/react';
import { cleanup, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it } from 'vitest';

import { LogsErrorContent } from './logs-error-content';

afterEach(cleanup);

/** The session-expired state reaches for the client to build its login URL. */
const withClient = (children: ReactNode) => (
  <MastraReactProvider baseUrl="http://localhost:4111">{children}</MastraReactProvider>
);

describe('LogsErrorContent', () => {
  it('offers a way back in when the session has expired', () => {
    render(withClient(<LogsErrorContent error={{ status: 401 }} resource="logs" errorTitle="Failed to load logs" />));

    expect(screen.getByText('Session Expired')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Log in' })).toBeTruthy();
    expect(screen.queryByText('Failed to load logs')).toBeNull();
  });

  it('names the resource the caller was refused', () => {
    render(withClient(<LogsErrorContent error={{ status: 403 }} resource="logs" errorTitle="Failed to load logs" />));

    expect(screen.getByText(/You don\u2019t have permission to access logs\.|permission to access logs/)).toBeTruthy();
    expect(screen.queryByText('Failed to load logs')).toBeNull();
  });

  it('falls back to the caller title and the error message', () => {
    render(
      withClient(
        <LogsErrorContent error={new Error('connection reset')} resource="logs" errorTitle="Failed to load logs" />,
      ),
    );

    expect(screen.getByText('Failed to load logs')).toBeTruthy();
    expect(screen.getByText('connection reset')).toBeTruthy();
  });

  it('says the error is unknown when it is not an Error at all', () => {
    render(
      withClient(<LogsErrorContent error="something went wrong" resource="logs" errorTitle="Failed to load logs" />),
    );

    expect(screen.getByText('Failed to load logs')).toBeTruthy();
    expect(screen.getByText('Unknown error')).toBeTruthy();
  });

  it('says the error is unknown when there is no error object', () => {
    render(withClient(<LogsErrorContent error={undefined} resource="logs" errorTitle="Failed to load logs" />));

    expect(screen.getByText('Unknown error')).toBeTruthy();
  });

  it('checks for a logs-specific limitation, not any unsupported operation', () => {
    render(
      withClient(
        <LogsErrorContent
          error={new Error('This storage provider does not support listing traces')}
          resource="logs"
          errorTitle="Failed to load logs"
        />,
      ),
    );

    expect(screen.queryByText('Logs are not available with your current storage')).toBeNull();
    expect(screen.getByText('Failed to load logs')).toBeTruthy();
  });

  it('renders an unavailable state when the storage provider cannot list logs', () => {
    render(
      <LogsErrorContent
        error={new Error('This storage provider does not support listing logs')}
        resource="logs"
        errorTitle="Failed to load logs"
      />,
    );

    expect(screen.getByText('Logs are not available with your current storage')).toBeTruthy();
    expect(screen.queryByText('Failed to load logs')).toBeNull();
  });

  it('renders an unavailable state when the observability storage domain is disabled', () => {
    render(
      <LogsErrorContent
        error={new Error('HTTP error! status: 501 - {"error":"Observability storage domain is not available"}')}
        resource="logs"
        errorTitle="Failed to load logs"
      />,
    );

    expect(screen.getByText('Observability storage is not available')).toBeTruthy();
    expect(screen.queryByText('Failed to load logs')).toBeNull();
  });
});
