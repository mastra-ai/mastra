/**
 * BDD coverage for the provider-aware /signin page.
 *
 * Drives the real route table (SignInGate → SignInPage) through a memory
 * router with MSW stubbing `/auth/me` and the better-auth credential
 * endpoints. WorkOS deploys keep the hosted-login redirect button; better-auth
 * deploys get the email/password form posting to `/auth/api/*`.
 */
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { server } from '../../../../../../../e2e/web-ui/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '../../../../../../../e2e/web-ui/render';
import { navigateAfterSignIn, redirectToLogin } from '../../services/auth';
import type * as AuthService from '../../services/auth';
import { createAppRoutes } from '../../../../router';
import { safeReturnTo } from '../SignInPage';

// jsdom's `window.location.assign` is unforgeable (cannot be spied on), so the
// service-level navigation helpers are stubbed instead; `fetchAuthState` and
// the credential POST helpers stay real so MSW sees the actual requests.
vi.mock('../../services/auth', async importOriginal => {
  const actual = await importOriginal<typeof AuthService>();
  return { ...actual, redirectToLogin: vi.fn(), navigateAfterSignIn: vi.fn() };
});

const AUTH_ME_URL = `${TEST_BASE_URL}/auth/me`;

afterEach(() => {
  vi.mocked(redirectToLogin).mockClear();
  vi.mocked(navigateAfterSignIn).mockClear();
});

function stubAuthMe(body: Record<string, unknown>) {
  server.use(http.get(AUTH_ME_URL, () => HttpResponse.json({ authenticated: false, user: null, ...body })));
}

function renderSignIn(initialEntry = '/signin') {
  const router = createMemoryRouter(createAppRoutes(), { initialEntries: [initialEntry] });
  renderWithProviders(<RouterProvider router={router} />);
  return router;
}

describe('SignInPage', () => {
  it('renders the Mastra Factory wordmark', async () => {
    stubAuthMe({ provider: 'workos' });
    renderSignIn();

    const wordmark = await screen.findByLabelText('Mastra Factory');
    expect(wordmark.textContent).toContain('█▀▀ ▄▀█ █▀▀ ▀█▀ █▀█ █▀█ █▄█');
    expect(screen.queryByLabelText('Mastra Code')).not.toBeInTheDocument();
  });

  describe('given a WorkOS (hosted-login) deploy', () => {
    it('renders the hosted sign-in button and redirects to the login route', async () => {
      stubAuthMe({ provider: 'workos' });
      renderSignIn('/signin?returnTo=%2Ffactory%2Fboard');

      const button = await screen.findByRole('button', { name: 'Sign in' });
      expect(screen.queryByLabelText('Email')).not.toBeInTheDocument();

      await userEvent.click(button);
      expect(redirectToLogin).toHaveBeenCalledWith(TEST_BASE_URL, '/factory/board');
    });
  });

  describe('given a better-auth (self-hosted) deploy', () => {
    it('renders the email/password form instead of the hosted button', async () => {
      stubAuthMe({ provider: 'better-auth' });
      renderSignIn();

      expect(await screen.findByLabelText('Email')).toBeInTheDocument();
      expect(screen.getByLabelText('Password')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Sign in' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'New here? Sign up' })).toBeInTheDocument();
    });

    it('signs in with credentials and navigates to returnTo', async () => {
      stubAuthMe({ provider: 'better-auth' });
      const posted = vi.fn();
      server.use(
        http.post(`${TEST_BASE_URL}/auth/api/sign-in/email`, async ({ request }) => {
          posted(await request.json());
          return HttpResponse.json({ user: { id: 'user_1' } });
        }),
      );
      renderSignIn('/signin?returnTo=%2Ffactory%2Fboard');

      await userEvent.type(await screen.findByLabelText('Email'), 'ada@example.com');
      await userEvent.type(screen.getByLabelText('Password'), 'hunter22!');
      await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));

      await waitFor(() => expect(navigateAfterSignIn).toHaveBeenCalledWith('/factory/board'));
      expect(posted).toHaveBeenCalledWith({ email: 'ada@example.com', password: 'hunter22!' });
    });

    it('surfaces the server error message on failed sign-in', async () => {
      stubAuthMe({ provider: 'better-auth' });
      server.use(
        http.post(`${TEST_BASE_URL}/auth/api/sign-in/email`, () =>
          HttpResponse.json({ message: 'Invalid email or password' }, { status: 401 }),
        ),
      );
      renderSignIn();

      await userEvent.type(await screen.findByLabelText('Email'), 'ada@example.com');
      await userEvent.type(screen.getByLabelText('Password'), 'wrong');
      await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));

      expect(await screen.findByRole('alert')).toHaveTextContent('Invalid email or password');
      expect(navigateAfterSignIn).not.toHaveBeenCalled();
    });

    it('signs up with name + credentials through the sign-up endpoint', async () => {
      stubAuthMe({ provider: 'better-auth' });
      const posted = vi.fn();
      server.use(
        http.post(`${TEST_BASE_URL}/auth/api/sign-up/email`, async ({ request }) => {
          posted(await request.json());
          return HttpResponse.json({ user: { id: 'user_2' } });
        }),
      );
      renderSignIn();

      await userEvent.click(await screen.findByRole('button', { name: 'New here? Sign up' }));
      await userEvent.type(screen.getByLabelText('Name'), 'Ada Lovelace');
      await userEvent.type(screen.getByLabelText('Email'), 'ada@example.com');
      await userEvent.type(screen.getByLabelText('Password'), 'hunter22!');
      await userEvent.click(screen.getByRole('button', { name: 'Sign up' }));

      await waitFor(() => expect(navigateAfterSignIn).toHaveBeenCalledWith('/'));
      expect(posted).toHaveBeenCalledWith({ name: 'Ada Lovelace', email: 'ada@example.com', password: 'hunter22!' });
    });

    it('hides the sign-up affordance when the server disables sign-up', async () => {
      stubAuthMe({ provider: 'better-auth', signUpDisabled: true });
      renderSignIn();

      expect(await screen.findByLabelText('Email')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'New here? Sign up' })).not.toBeInTheDocument();
    });
  });

  describe('returnTo sanitization', () => {
    it.each([
      ['/factory/board?x=1#frag', '/factory/board?x=1#frag'],
      ['//attacker.example', '/'],
      // Browsers normalize `/\` to `//` — an encoded backslash must not
      // become a protocol-relative cross-origin redirect.
      ['/\\attacker.example', '/'],
      ['/\\/attacker.example', '/'],
      ['https://attacker.example/x', '/'],
      ['javascript:alert(1)', '/'],
      [undefined, '/'],
    ])('resolves %s to %s against the page origin', (raw, expected) => {
      expect(safeReturnTo(raw)).toBe(expected);
    });
  });
});
