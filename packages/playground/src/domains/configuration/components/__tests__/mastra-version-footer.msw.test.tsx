// @vitest-environment jsdom
import { TooltipProvider } from '@mastra/playground-ui/components/Tooltip';
import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { afterEach, describe, expect, it } from 'vitest';

import { MastraVersionFooter } from '../mastra-version-footer';
import {
  currentPackageRegistryResponse,
  deprecatedPackageRegistryResponse,
  systemPackagesWithUpdates,
} from './fixtures/mastra-version-footer';
import { server } from '@/test/msw-server';

const BASE_URL = 'http://localhost:4111';

const renderVersionFooter = () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  return render(
    <MastraReactProvider baseUrl={BASE_URL}>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <MastraVersionFooter />
        </TooltipProvider>
      </QueryClientProvider>
    </MastraReactProvider>,
  );
};

afterEach(() => cleanup());

describe('MastraVersionFooter', () => {
  describe('when installed packages include outdated and deprecated versions', () => {
    it('renders factual status badges and keeps their indicators in the package dialog', async () => {
      server.use(
        http.get(`${BASE_URL}/api/system/packages`, () => HttpResponse.json(systemPackagesWithUpdates)),
        http.get('https://registry.npmjs.org/:packageName', ({ request }) => {
          const packageName = decodeURIComponent(new URL(request.url).pathname.slice(1));
          const response =
            packageName === '@mastra/memory' ? deprecatedPackageRegistryResponse : currentPackageRegistryResponse;
          return HttpResponse.json(response);
        }),
      );

      renderVersionFooter();

      expect(await screen.findByLabelText('1 outdated package')).toBeTruthy();
      expect(await screen.findByLabelText('1 deprecated package')).toBeTruthy();

      fireEvent.click(screen.getByRole('button'));

      const outdatedLabel = await screen.findByText('package outdated');
      const deprecatedLabel = await screen.findByText('package deprecated');
      expect(outdatedLabel.previousElementSibling?.querySelector('[aria-hidden="true"]')).not.toBeNull();
      expect(deprecatedLabel.previousElementSibling?.querySelector('[aria-hidden="true"]')).not.toBeNull();
    });
  });
});
