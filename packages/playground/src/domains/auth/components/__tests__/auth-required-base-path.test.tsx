// @vitest-environment jsdom
import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { PublicAuthCapabilities } from '../../types';
import { AuthRequired } from '../auth-required';
import type { AuthRequiredProps } from '../auth-required';
import { server } from '@/test/msw-server';

const BASE_URL = 'http://localhost:4111';

const credentialsCapabilities: PublicAuthCapabilities = {
  enabled: true,
  login: { type: 'credentials' },
};

function stubLocationHref() {
  const hrefSetter = vi.fn();
  const originalLocation = window.location;
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: new Proxy(originalLocation, {
      set(_target, prop, value) {
        if (prop === 'href') {
          hrefSetter(value);
        }
        return true;
      },
      get(target, prop) {
        // @ts-expect-error indexed access
        return target[prop];
      },
    }),
  });
  return {
    hrefSetter,
    restore: () => {
      Object.defineProperty(window, 'location', { configurable: true, value: originalLocation });
    },
  };
}

const renderAuthRequired = (props: Omit<AuthRequiredProps, 'children'> = {}) => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <MastraReactProvider baseUrl={BASE_URL}>
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <AuthRequired {...props}>
            <div>protected content</div>
          </AuthRequired>
        </MemoryRouter>
      </QueryClientProvider>
    </MastraReactProvider>,
  );
};

afterEach(() => {
  cleanup();
  delete window.MASTRA_STUDIO_BASE_PATH;
});

describe('AuthRequired', () => {
  describe('when the studio is served from a custom base path and the user is unauthenticated', () => {
    it('sends the Sign in button to /login under the studio base path', async () => {
      window.MASTRA_STUDIO_BASE_PATH = '/studio';
      server.use(http.get(`${BASE_URL}/api/auth/capabilities`, () => HttpResponse.json(credentialsCapabilities)));
      const { hrefSetter, restore } = stubLocationHref();

      renderAuthRequired();
      fireEvent.click(await screen.findByRole('button', { name: 'Sign in' }));

      const target = new URL(hrefSetter.mock.calls[0][0]);
      expect(target.pathname).toBe('/studio/login');
      restore();
    });

    it('sends the Sign up link to /signup under the studio base path', async () => {
      window.MASTRA_STUDIO_BASE_PATH = '/studio';
      server.use(http.get(`${BASE_URL}/api/auth/capabilities`, () => HttpResponse.json(credentialsCapabilities)));
      const { hrefSetter, restore } = stubLocationHref();

      renderAuthRequired();
      fireEvent.click(await screen.findByRole('button', { name: 'Sign up' }));

      const target = new URL(hrefSetter.mock.calls[0][0]);
      expect(target.pathname).toBe('/studio/signup');
      restore();
    });
  });

  describe('when custom absolute authentication URLs are configured', () => {
    it('preserves the external login URL', async () => {
      window.MASTRA_STUDIO_BASE_PATH = '/studio';
      server.use(http.get(`${BASE_URL}/api/auth/capabilities`, () => HttpResponse.json(credentialsCapabilities)));
      const { hrefSetter, restore } = stubLocationHref();

      renderAuthRequired({ loginUrl: 'https://auth.example.com/login' });
      fireEvent.click(await screen.findByRole('button', { name: 'Sign in' }));

      expect(hrefSetter.mock.calls[0][0]).toBe(
        `https://auth.example.com/login?redirect=${encodeURIComponent(window.location.href)}`,
      );
      restore();
    });

    it('preserves the external signup URL', async () => {
      window.MASTRA_STUDIO_BASE_PATH = '/studio';
      server.use(http.get(`${BASE_URL}/api/auth/capabilities`, () => HttpResponse.json(credentialsCapabilities)));
      const { hrefSetter, restore } = stubLocationHref();

      renderAuthRequired({ signupUrl: 'https://auth.example.com/signup' });
      fireEvent.click(await screen.findByRole('button', { name: 'Sign up' }));

      expect(hrefSetter.mock.calls[0][0]).toBe(
        `https://auth.example.com/signup?redirect=${encodeURIComponent(window.location.href)}`,
      );
      restore();
    });
  });

  describe('when the configured login URL already includes the studio base path', () => {
    it('does not prefix the login URL again', async () => {
      window.MASTRA_STUDIO_BASE_PATH = '/studio';
      server.use(http.get(`${BASE_URL}/api/auth/capabilities`, () => HttpResponse.json(credentialsCapabilities)));
      const { hrefSetter, restore } = stubLocationHref();

      renderAuthRequired({ loginUrl: '/studio/login' });
      fireEvent.click(await screen.findByRole('button', { name: 'Sign in' }));

      const target = new URL(hrefSetter.mock.calls[0][0]);
      expect(target.pathname).toBe('/studio/login');
      restore();
    });
  });

  describe('when a relative login URL is configured', () => {
    it('resolves the login URL under the studio base path', async () => {
      window.MASTRA_STUDIO_BASE_PATH = '/studio';
      server.use(http.get(`${BASE_URL}/api/auth/capabilities`, () => HttpResponse.json(credentialsCapabilities)));
      const { hrefSetter, restore } = stubLocationHref();

      renderAuthRequired({ loginUrl: 'login?mode=signup#form' });
      fireEvent.click(await screen.findByRole('button', { name: 'Sign in' }));

      const target = new URL(hrefSetter.mock.calls[0][0]);
      expect(target.pathname).toBe('/studio/login');
      expect(target.searchParams.get('mode')).toBe('signup');
      expect(target.hash).toBe('#form');
      restore();
    });
  });

  describe('when the studio is served from the root and the user is unauthenticated', () => {
    it('sends the Sign in button to /login', async () => {
      server.use(http.get(`${BASE_URL}/api/auth/capabilities`, () => HttpResponse.json(credentialsCapabilities)));
      const { hrefSetter, restore } = stubLocationHref();

      renderAuthRequired();
      fireEvent.click(await screen.findByRole('button', { name: 'Sign in' }));

      const target = new URL(hrefSetter.mock.calls[0][0]);
      expect(target.pathname).toBe('/login');
      restore();
    });
  });
});
