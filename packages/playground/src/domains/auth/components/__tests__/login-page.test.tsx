// @vitest-environment jsdom
import type * as PlaygroundUi from '@mastra/playground-ui';
import { TooltipProvider } from '@mastra/playground-ui';
import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import React from 'react';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { Login } from '@/pages/login';
import { SignUp } from '@/pages/signup';
import { server } from '@/test/msw-server';

vi.mock('@mastra/playground-ui', async () => {
  const actual = await vi.importActual<typeof PlaygroundUi>('@mastra/playground-ui');
  return {
    ...actual,
    toast: { success: vi.fn(), error: vi.fn() },
    usePlaygroundStore: () => ({ requestContext: undefined }),
  };
});

const BASE_URL = 'http://localhost:4111';

type Capabilities = {
  enabled: boolean;
  login: {
    type: 'credentials' | 'sso' | 'both';
    description?: string;
    signUpEnabled?: boolean;
    sso?: { text?: string };
  } | null;
};

const credentialsCapabilities: Capabilities = {
  enabled: true,
  login: { type: 'credentials' },
};

const ssoCapabilities: Capabilities = {
  enabled: true,
  login: { type: 'sso', sso: { text: 'Continue with SSO' } },
};

const bothCapabilities: Capabilities = {
  enabled: true,
  login: { type: 'both', sso: { text: 'Continue with SSO' } },
};

function mockCapabilities(capabilities: Capabilities) {
  server.use(http.get(`${BASE_URL}/api/auth/capabilities`, () => HttpResponse.json(capabilities)));
}

function renderRoute(initialEntry: string, ui: React.ReactNode) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  return render(
    <MastraReactProvider baseUrl={BASE_URL}>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <MemoryRouter initialEntries={[initialEntry]}>{ui}</MemoryRouter>
        </TooltipProvider>
      </QueryClientProvider>
    </MastraReactProvider>,
  );
}

const renderLogin = (path = '/login') => renderRoute(path, <Login />);
const renderSignUp = (path = '/signup') => renderRoute(path, <SignUp />);

describe('LoginPage UI parity for /login and /signup', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders the login-page testid on the outer container for /login', async () => {
    mockCapabilities(credentialsCapabilities);
    renderLogin();

    const root = await screen.findByTestId('login-page');
    expect(root).toBeTruthy();
  });

  it('renders the login-page testid on the outer container for /signup', async () => {
    mockCapabilities(credentialsCapabilities);
    renderSignUp();

    const root = await screen.findByTestId('login-page');
    expect(root).toBeTruthy();
  });

  it('does not wrap content in a bordered card on either route', async () => {
    mockCapabilities(credentialsCapabilities);
    const { unmount } = renderLogin();

    const loginRoot = await screen.findByTestId('login-page');
    const loginInner = loginRoot.firstElementChild as HTMLElement;
    expect(loginInner.className).not.toMatch(/rounded-lg/);
    expect(loginInner.className).not.toMatch(/border-border1/);
    expect(loginInner.className).not.toMatch(/bg-surface2/);
    expect(loginInner.className).not.toMatch(/\bp-8\b/);

    unmount();
    cleanup();

    mockCapabilities(credentialsCapabilities);
    renderSignUp();
    const signUpRoot = await screen.findByTestId('login-page');
    const signUpInner = signUpRoot.firstElementChild as HTMLElement;
    expect(signUpInner.className).not.toMatch(/rounded-lg/);
    expect(signUpInner.className).not.toMatch(/border-border1/);
    expect(signUpInner.className).not.toMatch(/bg-surface2/);
    expect(signUpInner.className).not.toMatch(/\bp-8\b/);
  });

  it('shows the sign in heading on /login by default', async () => {
    mockCapabilities(credentialsCapabilities);
    renderLogin();

    expect(await screen.findByRole('heading', { name: 'Sign in to Mastra Studio' })).toBeTruthy();
  });

  it('shows the create account heading on /signup', async () => {
    mockCapabilities(credentialsCapabilities);
    renderSignUp();

    expect(await screen.findByRole('heading', { name: 'Create your account' })).toBeTruthy();
  });

  it('uses the same outer container className on /login and /signup', async () => {
    mockCapabilities(credentialsCapabilities);
    const { unmount } = renderLogin();
    const loginRoot = await screen.findByTestId('login-page');
    const loginOuterClass = loginRoot.className;
    const loginInnerClass = (loginRoot.firstElementChild as HTMLElement).className;

    unmount();
    cleanup();

    mockCapabilities(credentialsCapabilities);
    renderSignUp();
    const signUpRoot = await screen.findByTestId('login-page');
    const signUpOuterClass = signUpRoot.className;
    const signUpInnerClass = (signUpRoot.firstElementChild as HTMLElement).className;

    expect(signUpOuterClass).toBe(loginOuterClass);
    expect(signUpInnerClass).toBe(loginInnerClass);
  });

  it('renders only the credentials form when capability is credentials-only', async () => {
    mockCapabilities(credentialsCapabilities);
    renderLogin();

    expect(await screen.findByLabelText('Email')).toBeTruthy();
    expect(screen.getByLabelText('Password')).toBeTruthy();
    expect(screen.queryByText('or continue with')).toBeNull();
  });

  it('renders only the SSO button when capability is sso-only', async () => {
    mockCapabilities(ssoCapabilities);
    renderLogin();

    expect(await screen.findByRole('button', { name: 'Continue with SSO' })).toBeTruthy();
    expect(screen.queryByLabelText('Email')).toBeNull();
    expect(screen.queryByText('or continue with')).toBeNull();
  });

  it('renders form, divider and SSO button when capability is both', async () => {
    mockCapabilities(bothCapabilities);
    renderLogin();

    expect(await screen.findByLabelText('Email')).toBeTruthy();
    expect(screen.getByText('or continue with')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Continue with SSO' })).toBeTruthy();
  });

  it('renders the description slot when login.description is set', async () => {
    mockCapabilities({
      enabled: true,
      login: { type: 'credentials', description: 'Restricted access' },
    });
    renderLogin();

    expect(await screen.findByText('Restricted access')).toBeTruthy();
  });

  it('renders the error banner slot from ?error_description on /login', async () => {
    mockCapabilities(credentialsCapabilities);
    renderLogin('/login?error_description=oops');

    await waitFor(() => {
      expect(screen.getByText('oops')).toBeTruthy();
    });
  });
});
