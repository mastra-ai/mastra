import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useDefaultVisibility } from '../use-default-visibility';

const BASE_URL = 'http://localhost:4111';

const createMockResponse = (data: unknown): Response =>
  ({
    ok: true,
    json: () => Promise.resolve(data),
  }) as unknown as Response;

const wrapper = () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: ReactNode }) => (
    <MastraReactProvider baseUrl={BASE_URL}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </MastraReactProvider>
  );
};

describe('useDefaultVisibility', () => {
  let originalFetch: typeof globalThis.fetch;
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
    mockFetch = vi.fn();
    globalThis.fetch = mockFetch as typeof fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it.each([
    ['returns private when auth is enabled', true, 'private'],
    ['returns public when auth is disabled', false, 'public'],
  ] as const)('%s', async (_title, enabled, expected) => {
    mockFetch.mockResolvedValue(createMockResponse({ enabled, capabilities: {} }));

    const { result } = renderHook(() => useDefaultVisibility(), { wrapper: wrapper() });

    await waitFor(() => expect(result.current).toBe(expected));
  });

  it('falls back to public while loading', () => {
    mockFetch.mockReturnValue(new Promise(() => {}));

    const { result } = renderHook(() => useDefaultVisibility(), { wrapper: wrapper() });

    expect(result.current).toBe('public');
  });
});
