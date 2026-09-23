// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';

import { server } from '../../../../test/msw-server';
import { TraceIntelligenceProvider } from '../../trace-intelligence-provider';
import { TraceIntelligenceEntityDetail } from '../trace-intelligence-entity-detail';
import { customSignalEntityResponse, emptyThemeSnapshotsResponse, entityIndexResponse } from './fixtures/entity-index';

function TestWrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return (
    <QueryClientProvider client={queryClient}>
      <TraceIntelligenceProvider cacheScope="entity-detail-test">{children}</TraceIntelligenceProvider>
    </QueryClientProvider>
  );
}

describe('TraceIntelligenceEntityDetail', () => {
  describe('when the requested entity does not exist', () => {
    it('renders not found instead of selecting another entity', async () => {
      server.use(http.get('/api/learning/entities', () => HttpResponse.json(entityIndexResponse)));

      render(<TraceIntelligenceEntityDetail entityType="agent" entityId="missing-agent" />, {
        wrapper: TestWrapper,
      });

      expect(await screen.findByText('Trace Intelligence entity not found')).toBeTruthy();
      expect(screen.queryByText('support-agent')).not.toBeTruthy();
    });
  });

  describe('when the selected entity has a custom signal catalog', () => {
    it('requests analysis using the custom signals in catalog order', async () => {
      let requestedSignalNames: string | null = null;
      server.use(
        http.get('/api/learning/entities', () => HttpResponse.json(customSignalEntityResponse)),
        http.get('/api/learning/entities/custom-agent/theme-snapshots', ({ request }) => {
          requestedSignalNames = new URL(request.url).searchParams.get('signalNames');
          return HttpResponse.json(emptyThemeSnapshotsResponse);
        }),
      );

      render(<TraceIntelligenceEntityDetail entityType="agent" entityId="custom-agent" />, {
        wrapper: TestWrapper,
      });

      expect(
        await screen.findByRole('heading', { name: 'Understand what drives every agent interaction' }),
      ).toBeTruthy();
      expect(requestedSignalNames).toBe('tool_usage,response_quality');
      expect(screen.getAllByText('Tool usage')).toHaveLength(2);
      expect(screen.getByText('How effectively the agent uses tools.')).toBeTruthy();
      expect(screen.getAllByText('Response quality')).toHaveLength(2);
      expect(screen.queryByText('Goal')).not.toBeTruthy();
    });
  });
});
