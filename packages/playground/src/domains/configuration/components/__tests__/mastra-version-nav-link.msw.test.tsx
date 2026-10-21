// @vitest-environment jsdom
import { TooltipProvider } from '@mastra/playground-ui/components/Tooltip';
import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { afterEach, describe, expect, it } from 'vitest';

import { MastraVersionNavLink } from '../mastra-version-nav-link';
import {
  currentPackageRegistryResponse,
  deprecatedPackageRegistryResponse,
  outdatedPackageRegistryResponse,
  systemPackagesWithUpdates,
} from './fixtures/mastra-version-nav-link';
import type { NpmRegistryResponse } from './fixtures/mastra-version-nav-link';
import { server } from '@/test/msw-server';

const BASE_URL = 'http://localhost:4111';

const renderVersionNavLink = () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  return render(
    <MastraReactProvider baseUrl={BASE_URL}>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <ul>
            <MastraVersionNavLink />
          </ul>
        </TooltipProvider>
      </QueryClientProvider>
    </MastraReactProvider>,
  );
};

const mockRegistry = (responses: Record<string, NpmRegistryResponse>) =>
  http.get('https://registry.npmjs.org/:packageName', ({ request }) => {
    const packageName = decodeURIComponent(new URL(request.url).pathname.slice(1));
    return HttpResponse.json(responses[packageName]);
  });

afterEach(() => cleanup());

describe('MastraVersionNavLink', () => {
  describe('when installed packages include outdated and deprecated versions', () => {
    it('flags the row and lists both in the popover with an update command', async () => {
      server.use(
        http.get(`${BASE_URL}/api/system/packages`, () => HttpResponse.json(systemPackagesWithUpdates)),
        mockRegistry({
          '@mastra/core': outdatedPackageRegistryResponse,
          '@mastra/memory': deprecatedPackageRegistryResponse,
        }),
      );

      renderVersionNavLink();

      const row = await screen.findByRole('button', { name: /v1\.0\.0/ });
      expect(await screen.findByText('Update')).toBeTruthy();

      fireEvent.click(row);

      expect(await screen.findByText('1 deprecated, 1 update available')).toBeTruthy();
      expect(screen.getByText('pnpm add @mastra/core@latest @mastra/memory@latest')).toBeTruthy();
    });
  });

  describe('when every package is current', () => {
    it('shows no update badge and says it is up to date', async () => {
      server.use(
        http.get(`${BASE_URL}/api/system/packages`, () => HttpResponse.json(systemPackagesWithUpdates)),
        mockRegistry({
          '@mastra/core': currentPackageRegistryResponse,
          '@mastra/memory': currentPackageRegistryResponse,
        }),
      );

      renderVersionNavLink();

      fireEvent.click(await screen.findByRole('button', { name: /v1\.0\.0/ }));

      expect(await screen.findByText('Up to date')).toBeTruthy();
      expect(screen.queryByText('Update')).toBeNull();
      expect(screen.queryByText('Update with')).toBeNull();
    });
  });
});
