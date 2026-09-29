import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { AgentMemoryConfig } from '../agent-memory-config';
import {
  memoryConfigWithDefaults,
  memoryConfigWithDisabledFeatures,
  memoryConfigWithNumericRange,
  memoryConfigWithPartialRecall,
  memoryConfigWithReadableRecall,
  memoryConfigWithThresholds,
  memoryConfigWithUnsupportedRecall,
  memoryNotConfigured,
} from './fixtures/memory-config';
import { server } from '@/test/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '@/test/render';

describe('AgentMemoryConfig', () => {
  describe('when memory includes explicit context limits', () => {
    it('keeps every general, recall, and observational setting visible', async () => {
      server.use(http.get(`${TEST_BASE_URL}/api/memory/config`, () => HttpResponse.json(memoryConfigWithThresholds)));
      renderWithProviders(<AgentMemoryConfig agentId="agent-1" />);

      fireEvent.click(await screen.findByRole('button', { name: 'Observational Memory' }));

      expect(
        screen.getAllByRole('term').map(term => [term.textContent?.trim(), term.nextElementSibling?.textContent]),
      ).toEqual([
        ['Status', 'Enabled'],
        ['Last Messages', '0'],
        ['Auto-generate Titles', 'Enabled'],
        ['Status', 'Enabled'],
        ['Scope', 'resource'],
        ['Top K Results', '4'],
        ['Message Range', '0 before, 2 after'],
        ['Status', 'Enabled'],
        ['Scope', 'thread'],
        ['Message Tokens', '30,000 tokens'],
        ['Observation Tokens', '4,000–8,000 tokens'],
        ['Observation Model', 'openai/gpt-4o-mini'],
        ['Reflection Model', 'openai/gpt-4o'],
      ]);
    });
  });

  describe('when optional memory settings are omitted', () => {
    it('shows defaults without inventing a message limit or model', async () => {
      server.use(http.get(`${TEST_BASE_URL}/api/memory/config`, () => HttpResponse.json(memoryConfigWithDefaults)));
      renderWithProviders(<AgentMemoryConfig agentId="agent-1" />);

      fireEvent.click(await screen.findByRole('button', { name: 'Observational Memory' }));

      expect(screen.getAllByText('Default')).toHaveLength(3);
      expect(screen.getByText('1 before, 1 after')).toBeTruthy();
      expect(screen.queryByText('Observation Model')).toBeNull();
      expect(screen.queryByText('Reflection Model')).toBeNull();
    });
  });

  describe('when memory features are disabled', () => {
    it('distinguishes disabled recent messages from a zero-message limit', async () => {
      server.use(
        http.get(`${TEST_BASE_URL}/api/memory/config`, () => HttpResponse.json(memoryConfigWithDisabledFeatures)),
      );
      renderWithProviders(<AgentMemoryConfig agentId="agent-1" />);

      await screen.findByText('Last Messages');

      expect(screen.getAllByRole('definition').map(value => value.textContent)).toEqual([
        'Enabled',
        'Disabled',
        'Disabled',
      ]);
      expect(screen.queryByRole('button', { name: 'Semantic Recall' })).toBeNull();
      expect(screen.queryByRole('button', { name: 'Observational Memory' })).toBeNull();
    });
  });

  describe('when semantic recall uses a symmetric numeric range', () => {
    it('preserves its scope, result count, and zero range', async () => {
      server.use(http.get(`${TEST_BASE_URL}/api/memory/config`, () => HttpResponse.json(memoryConfigWithNumericRange)));
      renderWithProviders(<AgentMemoryConfig agentId="agent-1" />);

      expect(await screen.findByText('0 before, 0 after')).toBeTruthy();
      expect(screen.getByText('thread')).toBeTruthy();
      expect(screen.getByText('8')).toBeTruthy();
      expect(screen.getByText('20')).toBeTruthy();
    });
  });

  describe('when no memory is configured', () => {
    it('shows the empty state without claiming memory is enabled', async () => {
      server.use(http.get(`${TEST_BASE_URL}/api/memory/config`, () => HttpResponse.json(memoryNotConfigured)));
      renderWithProviders(<AgentMemoryConfig agentId="agent-1" />);

      expect(await screen.findByText('No memory configuration available')).toBeTruthy();
      expect(screen.queryByText('Enabled')).toBeNull();
    });
  });

  describe('when a memory configuration refresh fails', () => {
    it('keeps the previously loaded settings visible', async () => {
      server.use(http.get(`${TEST_BASE_URL}/api/memory/config`, () => HttpResponse.json(memoryConfigWithThresholds)));
      const { queryClient } = renderWithProviders(<AgentMemoryConfig agentId="agent-1" />);
      await screen.findByText('Last Messages');

      server.use(http.get(`${TEST_BASE_URL}/api/memory/config`, () => new HttpResponse(null, { status: 500 })));
      await act(async () => {
        await queryClient.refetchQueries({ queryKey: ['memory', 'config', 'agent-1'] });
      });
      await waitFor(() =>
        expect(
          queryClient.getQueryCache().find({ queryKey: ['memory', 'config', 'agent-1'], exact: false })?.state.status,
        ).toBe('error'),
      );

      expect(screen.getByText('Last Messages')).toBeTruthy();
      expect(screen.getByText('0 before, 2 after')).toBeTruthy();
    });
  });

  describe('when semantic recall has an unsupported response shape', () => {
    it('keeps the remaining memory settings visible', async () => {
      server.use(
        http.get(`${TEST_BASE_URL}/api/memory/config`, () => HttpResponse.json(memoryConfigWithUnsupportedRecall)),
      );
      renderWithProviders(<AgentMemoryConfig agentId="agent-1" />);

      fireEvent.click(await screen.findByRole('button', { name: 'Observational Memory' }));

      expect(screen.getByText('Last Messages')).toBeTruthy();
      expect(screen.getByText('30,000 tokens')).toBeTruthy();
      expect(screen.getByText('Unavailable')).toBeTruthy();
    });
  });

  describe('when semantic recall includes a readable value outside the current config type', () => {
    it('preserves the supplied value and the remaining recall settings', async () => {
      server.use(
        http.get(`${TEST_BASE_URL}/api/memory/config`, () => HttpResponse.json(memoryConfigWithReadableRecall)),
      );
      renderWithProviders(<AgentMemoryConfig agentId="agent-1" />);

      expect(await screen.findByText('automatic')).toBeTruthy();
      expect(screen.getByText('thread')).toBeTruthy();
      expect(screen.getByText('0 before, 2 after')).toBeTruthy();
      expect(screen.queryByText('Unavailable')).toBeNull();
    });
  });

  describe('when only some semantic recall values cannot be displayed', () => {
    it('keeps the readable fields and identifies the unavailable values', async () => {
      server.use(
        http.get(`${TEST_BASE_URL}/api/memory/config`, () => HttpResponse.json(memoryConfigWithPartialRecall)),
      );
      renderWithProviders(<AgentMemoryConfig agentId="agent-1" />);

      expect(await screen.findByText('0 before, Unavailable after')).toBeTruthy();
      expect(screen.getByText('thread')).toBeTruthy();
      expect(screen.getByText('Unavailable')).toBeTruthy();
      expect(screen.queryByText('Configuration')).toBeNull();
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
