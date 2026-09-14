import { fireEvent, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { AgentMemoryConfig } from '../agent-memory-config';
import { memoryConfigWithThresholds } from './fixtures/memory-config';
import { server } from '@/test/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '@/test/render';

describe('AgentMemoryConfig', () => {
  describe('when memory includes explicit context limits', () => {
    it('shows the configured observational memory thresholds', async () => {
      server.use(http.get(`${TEST_BASE_URL}/api/memory/config`, () => HttpResponse.json(memoryConfigWithThresholds)));
      renderWithProviders(<AgentMemoryConfig agentId="agent-1" />);

      fireEvent.click(await screen.findByRole('button', { name: 'Observational Memory' }));

      expect(await screen.findByText('30,000 tokens')).toBeTruthy();
      expect(screen.getByText('4,000–8,000 tokens')).toBeTruthy();
    });

    it('preserves a zero-message semantic recall boundary', async () => {
      server.use(http.get(`${TEST_BASE_URL}/api/memory/config`, () => HttpResponse.json(memoryConfigWithThresholds)));
      renderWithProviders(<AgentMemoryConfig agentId="agent-1" />);

      expect(await screen.findByText('0 before, 2 after')).toBeTruthy();
    });
  });

  describe('when loading memory configuration fails', () => {
    it('allows the user to retry and read the configuration', async () => {
      server.use(http.get(`${TEST_BASE_URL}/api/memory/config`, () => new HttpResponse(null, { status: 500 })));
      renderWithProviders(<AgentMemoryConfig agentId="agent-1" />);

      const retry = await screen.findByRole('button', { name: 'Retry' });
      server.use(http.get(`${TEST_BASE_URL}/api/memory/config`, () => HttpResponse.json(memoryConfigWithThresholds)));
      fireEvent.click(retry);

      expect(await screen.findByText('Last Messages')).toBeTruthy();
      await waitFor(() => expect(screen.queryByRole('button', { name: 'Retry' })).toBeNull());
    });
  });
});
